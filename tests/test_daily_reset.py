"""Tests for recognising meters that reset every day."""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Iterable
from datetime import datetime, timedelta
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper import candidates as candidates_module
from custom_components.energy_flow_mapper import daily_reset
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.daily_reset import (
    async_daily_check,
    async_daily_resetting,
    resets_daily,
)

from .common import MockConfigEntry, WebSocketGenerator

ZURICH = "Europe/Zurich"
START = datetime.fromisoformat("2026-11-19T00:00:00+01:00")

type Rows = dict[str, list[dict[str, Any]]]


def hourly(value: Callable[[datetime], float], hours: int = 72) -> list[Any]:
    """Return hourly (start, state) pairs from START on."""
    return [
        (when, value(when))
        for when in (START + timedelta(hours=hour) for hour in range(hours))
    ]


def daily_total(reset_hour: int) -> Callable[[datetime], float]:
    """Return a meter that counts 0.5 kWh per hour and resets at `reset_hour`."""

    def value(when: datetime) -> float:
        return 0.5 * ((when.hour - reset_hour) % 24)

    return value


def test_resets_daily_midnight() -> None:
    """A meter that falls to 0 every midnight resets daily."""
    assert resets_daily(hourly(daily_total(0)))


def test_resets_daily_morning_wakeup() -> None:
    """An inverter that starts again at 07:00 every morning resets daily."""

    def inverter(when: datetime) -> float:
        # Counts from 07:00 to 17:00, keeps the day's value until next morning.
        return 0.8 * min(max(when.hour - 7, 0), 10) if when.hour >= 7 else 8.0

    states = hourly(inverter)
    assert states[7][1] == 0  # the drop is at 07:00, not at midnight
    assert resets_daily(states)


def test_lifetime_meter_not_daily() -> None:
    """A meter that only grows does not reset daily."""
    assert not resets_daily(
        hourly(lambda when: 1000 + (when - START).total_seconds() / 3600)
    )
    assert not resets_daily([])


def test_single_reset_not_daily() -> None:
    """One drop in three days is a replaced meter, not a daily reset."""
    states = [
        (when, value + (0 if when.day < 21 else -1200))
        for when, value in hourly(
            lambda when: 1200 + (when - START).total_seconds() / 3600
        )
    ]
    assert not resets_daily(states)


def test_several_drops_on_one_day_count_once() -> None:
    """Drops count per day: two drops on the same day are not daily."""
    values = [10.0, 0.1, 5.0, 0.2, 6.0, *[7.0] * 10]
    states = [(START + timedelta(hours=hour), v) for hour, v in enumerate(values)]
    assert not resets_daily(states)


def test_small_fall_and_zero_meter_not_daily() -> None:
    """A fall to half or more of the hour before and a meter at 0 are no resets."""
    small = [
        (START + timedelta(days=day, hours=hour), v)
        for day in range(3)
        for hour, v in enumerate((10.0, 5.0))
    ]
    assert not resets_daily(small)
    assert not resets_daily(hourly(lambda when: 0.0))


def test_resets_daily_large_first_hour() -> None:
    """A night boiler: 3 of 14 kWh in the first hour after the reset is daily."""

    def boiler(when: datetime) -> float:
        # 3 kWh per hour from 00:00 to 04:00, then 2 kWh more until 12:00.
        return min(3.0 * (when.hour + 1), 12.0) + (2.0 if when.hour >= 12 else 0.0)

    states = hourly(boiler)
    assert states[23][1] == 14.0
    assert states[24][1] == 3.0
    assert resets_daily(states)


def test_net_meter_through_zero_not_daily() -> None:
    """A net meter whose value passes 0 at its usual pace is not daily."""

    def net(when: datetime) -> float:
        # Grows at night, falls below 0 with the solar export during the day.
        return 4.0 - 0.8 * abs(when.hour - 12)

    states = hourly(net)
    assert min(value for _, value in states) < 0
    assert 0.0 in {value for _, value in states}  # it lands on 0 every day
    assert not resets_daily(states)


def test_lifetime_net_meter_drifting_through_zero_not_daily() -> None:
    """A lifetime net meter near 0: +0.2 kWh an hour, -0.5 while exporting."""
    value, states = -1.0, []
    for hour in range(72):
        when = START + timedelta(hours=hour)
        value += -0.5 if 10 <= when.hour < 16 else 0.2
        states.append((when, round(value, 3)))
    assert min(v for _, v in states) < 0 < max(v for _, v in states)
    assert not resets_daily(states)


def test_daily_net_meter_resets_daily() -> None:
    """A per-day net meter goes below 0 at noon and back to about 0 at midnight."""
    day = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.0, 0.5, -0.2, -0.8, -1.0, -0.9]
    day += [-0.7, -0.4, 0.0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.0, 2.2, 2.4]
    assert resets_daily(hourly(lambda when: day[when.hour]))
    # A day that ends below 0 falls back to 0 from below.
    assert resets_daily(hourly(lambda when: -0.3 * when.hour))


def test_daily_meter_with_a_stray_negative_value_is_daily() -> None:
    """One value below 0 (a glitch) does not hide a daily meter."""
    daily = hourly(daily_total(0))
    daily[30] = (daily[30][0], -0.1)
    assert resets_daily(daily)


class FakeRecorder:
    """Run executor jobs like the recorder does."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance like get_instance would return it."""
        self.hass = hass

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        """Run the job directly."""
        return func(*args)


def rows(states: Iterable[tuple[datetime, float | None]]) -> list[dict[str, Any]]:
    """Return statistics rows (timestamps) for (start, state) pairs."""
    return [{"start": when.timestamp(), "state": state} for when, state in states]


@pytest.fixture
def statistics(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> tuple[list[tuple[Any, ...]], Rows]:
    """Fake the recorder; return the calls made to it and its rows."""
    calls: list[tuple[Any, ...]] = []
    data: Rows = {}

    def fake(*args: Any) -> Rows:
        calls.append(args)
        return {stat: data[stat] for stat in args[3] if stat in data}

    monkeypatch.setattr(daily_reset, "statistics_during_period", fake)
    monkeypatch.setattr(daily_reset, "get_instance", FakeRecorder)
    hass.config.components.add("recorder")
    return calls, data


async def test_daily_resetting_reads_hourly_states_at_once(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """One query reads the hourly states of all entity statistics."""
    await hass.config.async_set_time_zone(ZURICH)
    calls, data = statistics
    data["sensor.daily"] = rows(hourly(daily_total(0)))
    # Missing states (unavailable meter) are skipped.
    data["sensor.gaps"] = rows(
        (when, None if when.hour == 0 else value)
        for when, value in hourly(daily_total(0))
    )
    data["sensor.lifetime"] = rows(hourly(lambda when: 1000 + when.hour))
    stats = ["sensor.daily", "sensor.gaps", "sensor.lifetime", "sensor.none", "a:b"]
    before = dt_util.utcnow()
    assert await async_daily_resetting(hass, stats) == {"sensor.daily", "sensor.gaps"}
    assert len(calls) == 1
    _, start, end, ids, period, units, types = calls[0]
    assert ids == {"sensor.daily", "sensor.gaps", "sensor.lifetime", "sensor.none"}
    assert (period, units, types) == ("hour", None, {"state"})
    assert end >= before
    assert end - start == timedelta(days=3)
    await async_daily_resetting(hass, ["sensor.daily"], days=5)
    assert calls[1][2] - calls[1][1] == timedelta(days=5)


async def test_daily_resetting_without_query(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
) -> None:
    """No statistics to read, or no recorder: nothing is asked."""
    calls, _ = statistics
    assert await async_daily_resetting(hass, []) == set()
    assert await async_daily_resetting(hass, ["portal:x"]) == set()
    hass.config.components.remove("recorder")
    assert await async_daily_resetting(hass, ["sensor.daily"]) == set()
    assert calls == []


def _utility_meter(hass: HomeAssistant, entity_id: str, cycle: str) -> None:
    entry = MockConfigEntry(domain="utility_meter", options={"cycle": cycle})
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "utility_meter",
        entity_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )


async def test_utility_meter_daily_cycle(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A utility meter with a daily cycle is daily without statistics."""
    calls, _ = statistics
    _utility_meter(hass, "sensor.daily_meter", "daily")
    _utility_meter(hass, "sensor.monthly_meter", "monthly")
    other = MockConfigEntry(domain="test", options={"cycle": "daily"})
    other.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", "test", "x", suggested_object_id="other", config_entry=other
    )
    stats = ["sensor.daily_meter", "sensor.monthly_meter", "sensor.other"]
    assert await async_daily_resetting(hass, stats) == {"sensor.daily_meter"}
    # The daily utility meter needs no statistics.
    assert calls[0][3] == {"sensor.monthly_meter", "sensor.other"}
    hass.config.components.remove("recorder")
    assert await async_daily_resetting(hass, stats) == {"sensor.daily_meter"}


@pytest.mark.usefixtures("sensors", "loaded_entry")
async def test_get_includes_daily_reset(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`get` flags every statistic and every candidate, from one query.

    Only the meters of devices and sources are read: free meters (here a daily
    one) and power sensors stay false.
    """
    calls, data = statistics

    async def no_external(hass: HomeAssistant, **kwargs: Any) -> list[Any]:
        return []

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", no_external)
    data["sensor.kitchen_energy"] = rows(hourly(daily_total(7)))
    data["sensor.attic_energy"] = rows(hourly(daily_total(0)))
    data["sensor.main_energy"] = rows(hourly(lambda when: 5000 + when.hour))
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/get"})
    response = await client.receive_json()
    assert response["success"], response
    result = response["result"]
    stats = result["stats"]
    assert all(isinstance(info["daily_reset"], bool) for info in stats.values())
    assert {stat for stat, info in stats.items() if info["daily_reset"]} == {
        "sensor.kitchen_energy"
    }
    lists = ("candidates", "water_candidates", "gas_candidates")
    flags = {c["stat"]: c["daily_reset"] for key in lists for c in result[key]}
    assert flags == {
        "sensor.attic_energy": False,
        "sensor.printer_energy": False,
        "sensor.water_meter": False,
        "sensor.gas_meter": False,
    }
    assert len(calls) == 1
    meters = {
        device["stat_consumption"] for device in result["prefs"]["device_consumption"]
    } | {
        source[key]
        for source in result["prefs"]["energy_sources"]
        for key in ("stat_energy_from", "stat_energy_to")
        if source.get(key)
    }
    assert calls[0][3] == meters


async def test_daily_resetting_survives_a_failing_recorder(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A failing or slow recorder only loses the statistics part, not `get`."""
    _utility_meter(hass, "sensor.daily_meter", "daily")

    def fail(*args: Any) -> Rows:
        raise RuntimeError("database is locked")

    monkeypatch.setattr(daily_reset, "statistics_during_period", fail)
    stats = ["sensor.daily_meter", "sensor.kitchen"]
    with caplog.at_level("DEBUG", logger=daily_reset.__name__):
        assert await async_daily_resetting(hass, stats) == {"sensor.daily_meter"}
    assert "database is locked" in caplog.text

    class SlowRecorder(FakeRecorder):
        async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
            await asyncio.sleep(1)

    monkeypatch.setattr(daily_reset, "get_instance", SlowRecorder)
    monkeypatch.setattr(daily_reset, "QUERY_TIMEOUT", 0.01)
    assert await async_daily_resetting(hass, stats) == {"sensor.daily_meter"}


async def test_daily_check_says_when_it_could_not_run(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The setup's check is None (unknown) when the recorder fails.

    Without a recorder there are no statistics to wait for: only the utility
    meters are daily, as known.
    """
    _, data = statistics
    _utility_meter(hass, "sensor.daily_meter", "daily")
    data["sensor.kitchen"] = rows(hourly(daily_total(0)))
    stats = ["sensor.daily_meter", "sensor.kitchen"]
    assert await async_daily_check(hass, stats) == {
        "sensor.daily_meter",
        "sensor.kitchen",
    }

    def fail(*args: Any) -> Rows:
        raise RuntimeError("database is locked")

    monkeypatch.setattr(daily_reset, "statistics_during_period", fail)
    assert await async_daily_check(hass, stats) is None
    # Only utility meters: nothing to read, so nothing can fail.
    assert await async_daily_check(hass, ["sensor.daily_meter"]) == {
        "sensor.daily_meter"
    }
    hass.config.components.remove("recorder")
    assert await async_daily_check(hass, stats) == {"sensor.daily_meter"}
