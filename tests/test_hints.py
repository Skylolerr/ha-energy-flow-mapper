"""Tests for the hints of the panel (solar circuits, daily sums, power sensors)."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper import candidates as candidates_module
from custom_components.energy_flow_mapper import energy_access, stats_probe
from custom_components.energy_flow_mapper import hints as hints_module
from custom_components.energy_flow_mapper.candidates import async_stats_info
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.device_rules import Method
from custom_components.energy_flow_mapper.hints import (
    HintCode,
    Readings,
    Watched,
    async_hints,
    async_sum_members,
    async_watch,
    returned_sensor,
    sum_members,
)
from custom_components.energy_flow_mapper.solar_setup import (
    gross_energy_template,
    gross_power_template,
    solar_power_template,
)
from custom_components.energy_flow_mapper.stats_probe import read_downtimes

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import ENERGY_PREFS, _meter

type Rows = dict[str, list[dict[str, Any]]]

SOLAR = {"type": "solar", "stat_energy_from": "sensor.solar_energy"}


class FakeRecorder:
    """Run executor jobs like the recorder does."""

    keep_days = 10

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance like get_instance would return it."""
        self.hass = hass

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        """Run the job directly."""
        return func(*args)


@pytest.fixture
def downtimes() -> list[tuple[float, float]]:
    """Return the downtimes of Home Assistant the fake recorder reports."""
    return []


@pytest.fixture
def statistics(
    hass: HomeAssistant,
    monkeypatch: pytest.MonkeyPatch,
    downtimes: list[tuple[float, float]],
) -> tuple[list[tuple[Any, ...]], Rows]:
    """Fake the recorder; return the calls made to it and its rows."""
    calls: list[tuple[Any, ...]] = []
    data: Rows = {}

    def fake(*args: Any) -> Rows:
        calls.append(args)
        _, start, end, ids, period, *_ = args
        # 5-minute rows only exist for the last days: keep their window.
        return {
            stat: [
                row
                for row in data[stat]
                if period != "5minute"
                or start.timestamp() <= row["start"] < end.timestamp()
            ]
            for stat in ids
            if stat in data
        }

    def fake_downtimes(hass: HomeAssistant, since: float) -> list[tuple[float, float]]:
        return list(downtimes)

    monkeypatch.setattr(stats_probe, "statistics_during_period", fake)
    monkeypatch.setattr(stats_probe, "read_downtimes", fake_downtimes)
    monkeypatch.setattr(stats_probe, "get_instance", FakeRecorder)
    hass.config.components.add("recorder")
    return calls, data


def changes(*values: float | None) -> list[dict[str, Any]]:
    """Return hourly statistics rows with these changes."""
    return [
        {"start": 1_700_000_000 + 3600 * i, "change": v} for i, v in enumerate(values)
    ]


def _device(hass: HomeAssistant, name: str) -> str:
    entry = MockConfigEntry(domain="shelly")
    entry.add_to_hass(hass)
    return (
        dr.async_get(hass)
        .async_get_or_create(config_entry_id=entry.entry_id, identifiers={("x", name)})
        .id
    )


def _entity(
    hass: HomeAssistant,
    entity_id: str,
    device_id: str | None,
    *,
    platform: str = "shelly",
    unique_id: str | None = None,
    translation_key: str | None = None,
    name: str | None = None,
    device_class: str = "energy",
    unit: str = "kWh",
    disabled: bool = False,
) -> None:
    """Register an entity; an enabled one gets a state too."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        platform,
        unique_id or entity_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        original_name=name,
        translation_key=translation_key,
        unit_of_measurement=unit,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )
    if not disabled:
        hass.states.async_set(
            entity_id,
            "1.0",
            {
                "device_class": device_class,
                "unit_of_measurement": unit,
                "state_class": "total_increasing"
                if device_class in ("energy", "water", "gas")
                else "measurement",
            },
        )


def _shelly(
    hass: HomeAssistant, name: str, *, returned_disabled: bool
) -> tuple[str, str]:
    """Create a Shelly with a meter and a returned sensor; return their IDs."""
    device_id = _device(hass, name)
    meter = f"sensor.{name}_energy"
    returned = f"sensor.{name}_energy_returned"
    _entity(hass, meter, device_id, unique_id=f"aabb-{name}-switch:0-energy")
    _entity(
        hass,
        returned,
        device_id,
        unique_id=f"aabb-{name}-switch:0-ret_energy",
        translation_key="energy_returned",
        disabled=returned_disabled,
    )
    return meter, returned


async def _hints(
    hass: HomeAssistant, prefs: dict[str, Any], daily: set[str] | None = None
) -> list[dict[str, Any]]:
    return await async_hints(hass, prefs, async_stats_info(hass, prefs), daily or set())


def _prefs(
    devices: list[dict[str, Any]],
    sources: list[dict[str, Any]] | None = None,
    water: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "energy_sources": [SOLAR] if sources is None else sources,
        "device_consumption": devices,
        "device_consumption_water": water or [],
    }


async def test_returned_hint_disabled_with_children(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A Pro EM channel with a disabled returned sensor and children gets a hint."""
    calls, _ = statistics
    meter, returned = _shelly(hass, "pro_em", returned_disabled=True)
    prefs = _prefs(
        [
            {"stat_consumption": meter},
            {"stat_consumption": "sensor.heat_pump", "included_in_stat": meter},
        ]
    )
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.RETURNED_ENERGY,
            "stat": meter,
            "kind": "electricity",
            "data": {"entity_id": returned, "disabled": True},
        }
    ]
    # A disabled sensor has no statistics to read.
    assert calls == []


async def test_no_returned_hint_disabled_without_children(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A Shelly plug with a disabled returned sensor and no children: no hint."""
    calls, _ = statistics
    meter, _ = _shelly(hass, "plug", returned_disabled=True)
    assert await _hints(hass, _prefs([{"stat_consumption": meter}])) == []
    assert calls == []


async def test_returned_hint_enabled_and_counting(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """An enabled returned sensor that counted energy lately gets a hint."""
    calls, data = statistics
    meter, returned = _shelly(hass, "balcony", returned_disabled=False)
    other, other_returned = _shelly(hass, "fridge", returned_disabled=False)
    data[returned] = changes(0.0, None, 0.3, 0.0)
    data[other_returned] = changes(0.0, 0.0)
    prefs = _prefs([{"stat_consumption": meter}, {"stat_consumption": other}])
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.RETURNED_ENERGY,
            "stat": meter,
            "kind": "electricity",
            "data": {"entity_id": returned, "disabled": False},
        }
    ]
    # One query for all returned sensors, of the hourly changes of 3 days.
    assert len(calls) == 1
    _, start, end, ids, period, units, types = calls[0]
    assert ids == {returned, other_returned}
    assert (period, units, types) == (
        "hour",
        {"energy": "kWh", "power": "W"},
        {"change"},
    )
    assert (end - start).days == 3


async def test_no_returned_hint_enabled_but_zero(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An enabled returned sensor that counted nothing gives no hint."""
    _, data = statistics
    meter, returned = _shelly(hass, "plug", returned_disabled=False)
    prefs = _prefs(
        [
            {"stat_consumption": meter},
            {"stat_consumption": "sensor.lamp", "included_in_stat": meter},
        ]
    )
    data[returned] = changes(0.0, 0.0, None)
    assert await _hints(hass, prefs) == []
    # No statistics at all: no hint either.
    data.clear()
    assert await _hints(hass, prefs) == []

    # A failing recorder only loses the hint.
    def fail(*args: Any) -> Rows:
        raise RuntimeError("database is locked")

    monkeypatch.setattr(stats_probe, "statistics_during_period", fail)
    assert await _hints(hass, prefs) == []
    hass.config.components.remove("recorder")
    assert await _hints(hass, prefs) == []


async def test_no_returned_hint_without_solar(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Without a solar source, a returned sensor gives no hint and no query."""
    calls, data = statistics
    meter, _ = _shelly(hass, "pro_em", returned_disabled=True)
    plug, plug_returned = _shelly(hass, "plug", returned_disabled=False)
    data[plug_returned] = changes(1.0)
    devices = [
        {"stat_consumption": meter},
        {"stat_consumption": "sensor.heat_pump", "included_in_stat": meter},
        {"stat_consumption": plug},
    ]
    grid = {"type": "grid", "stat_energy_from": "sensor.grid_import"}
    assert await _hints(hass, _prefs(devices, [grid])) == []
    assert calls == []
    # Water devices never get it, even with a solar source.
    assert await _hints(hass, _prefs([], water=devices)) == []
    assert calls == []


async def test_returned_sensor_detection(hass: HomeAssistant) -> None:
    """Returned sensors are found by translation key, Shelly key or name."""
    device_id = _device(hass, "meter")
    _entity(hass, "sensor.meter", device_id)
    # Not returned sensors: power, another key, the meter's own entity.
    _entity(
        hass,
        "sensor.returned_power",
        device_id,
        device_class="power",
        unit="W",
        translation_key="energy_returned",
    )
    _entity(hass, "sensor.consumed", device_id, translation_key="energy_consumed")
    assert returned_sensor(hass, "sensor.meter") is None
    for key in (
        "energy_returned",
        "energy_returned_with_channel_name",
        "energy_exported",
        "energy_return",
    ):
        other_device = _device(hass, key)
        _entity(hass, f"sensor.{key}_meter", other_device)
        _entity(hass, f"sensor.{key}", other_device, translation_key=key, disabled=True)
        assert returned_sensor(hass, f"sensor.{key}_meter") == (f"sensor.{key}", True)
    _entity(
        hass,
        "sensor.a_back",
        device_id,
        translation_key="energy_returned",
        disabled=True,
    )
    assert returned_sensor(hass, "sensor.meter") == ("sensor.a_back", True)
    # An enabled sensor comes first, then by entity ID.
    _entity(
        hass, "sensor.z_grid_export", device_id, platform="test", name="Grid Export"
    )
    assert returned_sensor(hass, "sensor.meter") == ("sensor.z_grid_export", False)

    # A Shelly entity whose registry entry has no translation key yet.
    other = _device(hass, "em")
    _entity(hass, "sensor.em_energy", other)
    _entity(
        hass, "sensor.em_back", other, unique_id="aabb-em1data:0-total_act_ret_energy"
    )
    assert returned_sensor(hass, "sensor.em_energy") == ("sensor.em_back", False)
    _entity(hass, "sensor.x_named", other, platform="test", name="Energy returned")
    assert returned_sensor(hass, "sensor.em_energy") == ("sensor.em_back", False)

    # No device, not in the registry.
    _entity(hass, "sensor.loose", None)
    assert returned_sensor(hass, "sensor.loose") is None
    assert returned_sensor(hass, "sensor.unknown") is None


async def test_no_returned_hint_when_returned_is_used(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A returned sensor already in the settings is counted: no hint."""
    calls, data = statistics
    # A plug measures a balcony inverter: its returned energy is the solar
    # production, its consumed energy a device (the inverter's standby).
    plug, plug_returned = _shelly(hass, "balcony", returned_disabled=False)
    data[plug_returned] = changes(0.5, 0.8)
    # A Pro EM channel whose returned energy is the grid export.
    pro_em, pro_em_returned = _shelly(hass, "pro_em", returned_disabled=True)
    prefs = _prefs(
        [
            {"stat_consumption": plug},
            {"stat_consumption": pro_em},
            {"stat_consumption": "sensor.heat_pump", "included_in_stat": pro_em},
        ],
        [
            {"type": "solar", "stat_energy_from": plug_returned},
            {
                "type": "grid",
                "stat_energy_from": "sensor.grid_import",
                "stat_energy_to": pro_em_returned,
            },
        ],
    )
    assert await _hints(hass, prefs) == []
    # Nothing left to read.
    assert calls == []
    assert returned_sensor(hass, plug, exclude={plug_returned}) is None
    assert returned_sensor(hass, plug) == (plug_returned, False)


async def test_returned_hint_any_sensor_qualifies(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """An enabled sensor that counts nothing does not hide a disabled one."""
    _, data = statistics
    meter, enabled = _shelly(hass, "pro_3em", returned_disabled=False)
    device_id = er.async_get(hass).async_get(meter).device_id
    _entity(
        hass,
        "sensor.pro_3em_phase_a_returned",
        device_id,
        unique_id="aabb-pro_3em-emdata:0-a_total_act_ret_energy",
        translation_key="energy_returned",
        disabled=True,
    )
    data[enabled] = changes(0.0, 0.0)
    prefs = _prefs(
        [
            {"stat_consumption": meter},
            {"stat_consumption": "sensor.wallbox", "included_in_stat": meter},
        ]
    )
    # The enabled sensor still comes first for the solar setup.
    assert returned_sensor(hass, meter) == (enabled, False)
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.RETURNED_ENERGY,
            "stat": meter,
            "kind": "electricity",
            "data": {"entity_id": "sensor.pro_3em_phase_a_returned", "disabled": True},
        }
    ]
    # When the enabled one counts, it is named.
    data[enabled] = changes(0.0, 0.2)
    assert (await _hints(hass, prefs))[0]["data"] == {
        "entity_id": enabled,
        "disabled": False,
    }


def _group_sum(
    hass: HomeAssistant, entity_id: str, members: list[str], kind: str = "sum"
) -> str:
    entry = MockConfigEntry(
        domain="group",
        options={"group_type": "sensor", "type": kind, "entities": members},
    )
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "group",
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )
    return entry.entry_id


async def test_daily_in_sum_hint(hass: HomeAssistant) -> None:
    """A group sum mixing daily and other meters gets a hint, device or source."""
    entry_id = _group_sum(hass, "sensor.house", ["sensor.day", "sensor.life"])
    solar_entry = _group_sum(hass, "sensor.pv", ["sensor.pv_day", "sensor.pv_life"])
    _group_sum(hass, "sensor.days", ["sensor.day", "sensor.pv_day"])
    _group_sum(hass, "sensor.highest", ["sensor.day", "sensor.life"], kind="max")
    light = MockConfigEntry(domain="group", options={"group_type": "light"})
    light.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", "test", "x", suggested_object_id="other_group", config_entry=light
    )
    no_group = MockConfigEntry(domain="test")
    no_group.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", "test", "y", suggested_object_id="plain", config_entry=no_group
    )
    assert sum_members(hass, "sensor.house") == ["sensor.day", "sensor.life"]
    for stat in ("sensor.highest", "sensor.other_group", "sensor.plain", "x:y"):
        assert sum_members(hass, stat) is None

    prefs = _prefs(
        [
            {"stat_consumption": "sensor.house"},
            {"stat_consumption": "sensor.days"},
            {"stat_consumption": "sensor.highest"},
            {"stat_consumption": "sensor.other_group"},
            {"stat_consumption": "sensor.plain"},
        ],
        [{"type": "solar", "stat_energy_from": "sensor.pv"}],
    )
    assert async_sum_members(hass, prefs) == {
        "sensor.day",
        "sensor.life",
        "sensor.pv_day",
        "sensor.pv_life",
    }
    daily = {"sensor.day", "sensor.pv_day"}
    assert await _hints(hass, prefs, daily) == [
        {
            "code": HintCode.DAILY_IN_SUM,
            "stat": "sensor.house",
            "kind": "electricity",
            "data": {
                "entry_id": entry_id,
                "members": ["sensor.day", "sensor.life"],
                "daily": ["sensor.day"],
            },
        },
        {
            "code": HintCode.DAILY_IN_SUM,
            "stat": "sensor.pv",
            "kind": "electricity",
            "data": {
                "entry_id": solar_entry,
                "members": ["sensor.pv_day", "sensor.pv_life"],
                "daily": ["sensor.pv_day"],
            },
        },
    ]
    # Nothing daily: no hint.
    assert await _hints(hass, prefs) == []


async def test_power_available_hint_device_and_source(hass: HomeAssistant) -> None:
    """A device or source without a power sensor whose device has one."""
    plug = _device(hass, "plug")
    _entity(hass, "sensor.plug_energy", plug)
    _entity(hass, "sensor.plug_power", plug, device_class="power", unit="W")
    main = _device(hass, "main")
    _entity(hass, "sensor.main_energy", main)
    _entity(hass, "sensor.main_power", main, device_class="power", unit="W")
    bare = _device(hass, "bare")
    _entity(hass, "sensor.bare_energy", bare)
    inverter = _device(hass, "inverter")
    _entity(hass, "sensor.pv_energy", inverter)
    _entity(hass, "sensor.pv_power", inverter, device_class="power", unit="W")
    grid_meter = _device(hass, "grid")
    _entity(hass, "sensor.grid_in", grid_meter)
    _entity(hass, "sensor.grid_out", grid_meter)
    _entity(hass, "sensor.grid_power", grid_meter, device_class="power", unit="W")
    battery = _device(hass, "battery")
    _entity(hass, "sensor.bat_out", battery)
    _entity(hass, "sensor.bat_power", battery, device_class="power", unit="W")
    tap = _device(hass, "tap")
    _entity(hass, "sensor.tap_water", tap, device_class="water", unit="L")
    _entity(hass, "sensor.tap_flow", tap, device_class="volume_flow_rate", unit="L/min")
    prefs = _prefs(
        [
            {"stat_consumption": "sensor.plug_energy"},
            {"stat_consumption": "sensor.main_energy", "stat_rate": "sensor.x"},
            {"stat_consumption": "sensor.bare_energy"},
            {"stat_consumption": "sensor.loose_energy"},
        ],
        [
            {"type": "solar", "stat_energy_from": "sensor.pv_energy"},
            # Export only: the export's device counts.
            {"type": "grid", "stat_energy_to": "sensor.grid_out"},
            {
                "type": "battery",
                "stat_energy_from": "sensor.bat_out",
                "power_config": {"stat_rate_inverted": "sensor.bat_power"},
            },
            {"type": "solar", "stat_energy_from": "sensor.main_energy"},
            {"type": "other", "stat_energy_from": "sensor.plug_energy"},
        ],
        [{"stat_consumption": "sensor.tap_water"}],
    )

    def power(stat: str, entity_id: str, kind: str = "electricity", **extra: str):
        return {
            "code": HintCode.POWER_AVAILABLE,
            "stat": stat,
            "kind": kind,
            "data": {"entity_id": entity_id, **extra},
        }

    hints = await _hints(hass, prefs)
    assert hints == [
        power("sensor.plug_energy", "sensor.plug_power"),
        power("sensor.tap_water", "sensor.tap_flow", "water"),
        power("sensor.pv_energy", "sensor.pv_power", role="production"),
        power("sensor.grid_out", "sensor.grid_power", role="export"),
        power("sensor.main_energy", "sensor.main_power", role="production"),
    ]


@pytest.fixture
def energy_prefs() -> dict[str, Any]:
    """Return the test preferences plus a plug without power and a group sum."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"] += [
        {"stat_consumption": "sensor.printer_energy"},
        {"stat_consumption": "sensor.house_sum"},
        {"stat_consumption": "sensor.balcony_energy"},
    ]
    return prefs


@pytest.mark.usefixtures("sensors", "loaded_entry")
async def test_get_returns_hints(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`get` returns the hints; sum members join the one daily query."""
    calls, data = statistics

    async def no_external(hass: HomeAssistant, **kwargs: Any) -> list[Any]:
        return []

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", no_external)
    # The member `sensor.day_meter` is neither used nor a candidate.
    entry_id = _group_sum(
        hass, "sensor.house_sum", ["sensor.day_meter", "sensor.garage_energy"]
    )
    data["sensor.day_meter"] = [
        {"start": float(_hour_base() + 3600 * h), "state": 0.5 * (h % 24)}
        for h in range(72)
    ]
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/get"})
    response = await client.receive_json()
    assert response["success"], response
    assert response["result"]["hints"] == [
        {
            "code": "power_available",
            "stat": "sensor.printer_energy",
            "kind": "electricity",
            "data": {"entity_id": "sensor.printer_power"},
        },
        {
            "code": "daily_in_sum",
            "stat": "sensor.house_sum",
            "kind": "electricity",
            "data": {
                "entry_id": entry_id,
                "members": ["sensor.day_meter", "sensor.garage_energy"],
                "daily": ["sensor.day_meter"],
            },
        },
    ]
    # One 5-minute query; the meters without 5-minute rows are read hourly.
    assert [call[4] for call in calls] == ["5minute", "hour"]
    assert "sensor.day_meter" in calls[0][3]
    assert "sensor.day_meter" not in calls[1][3]


@pytest.mark.usefixtures("sensors", "loaded_entry")
async def test_get_reads_daily_and_returned_at_once(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Both recorder queries of `get` run at the same time, not one after the other."""
    calls, data = statistics
    events: list[str] = []

    class OrderedRecorder(FakeRecorder):
        async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
            events.append("start")
            await asyncio.sleep(0)
            events.append("end")
            return func(*args)

    async def no_external(hass: HomeAssistant, **kwargs: Any) -> list[Any]:
        return []

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", no_external)
    monkeypatch.setattr(stats_probe, "get_instance", OrderedRecorder)
    _, returned = _shelly(hass, "balcony", returned_disabled=False)
    data[returned] = changes(0.4)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/get"})
    response = await client.receive_json()
    assert response["success"], response
    # Daily resets (5-minute, then hourly for the meters without 5-minute
    # rows) and returned energy: the first two start before either ends.
    assert [call[4] for call in calls] == ["5minute", "hour", "hour"]
    assert events[:2] == ["start", "start"]
    assert {
        "code": "returned_energy",
        "stat": "sensor.balcony_energy",
        "kind": "electricity",
        "data": {"entity_id": returned, "disabled": False},
    } in response["result"]["hints"]


async def test_returned_hint_needs_0_01_kwh(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Counted lately means at least 0.01 kWh (read in kWh) in the last days."""
    calls, data = statistics
    meter, returned = _shelly(hass, "balcony", returned_disabled=False)
    prefs = _prefs([{"stat_consumption": meter}])
    data[returned] = changes(0.004, 0.005)
    assert await _hints(hass, prefs) == []
    data[returned] = changes(0.004, 0.006)
    assert [hint["code"] for hint in await _hints(hass, prefs)] == [
        HintCode.RETURNED_ENERGY
    ]
    # The recorder converts the changes to kWh.
    assert calls[-1][5] == {"energy": "kWh", "power": "W"}


# --- Safety net: the gross meters of the solar setup ---------------------

DRAWN, RETURNED = "sensor.drawn", "sensor.returned"
CIRCUIT_POWER, PV_POWER, PV_ENERGY = (
    "sensor.circuit_power",
    "sensor.pv_power",
    "sensor.pv_energy",
)
GROSS, GROSS_POWER = "sensor.gross", "sensor.gross_power"
TERM, TERM_POWER = "sensor.pv_term", "sensor.pv_term_power"
SAFETY_CODES = (
    HintCode.GROSS_OFF,
    HintCode.GROSS_UNKNOWN,
    HintCode.SOLAR_TERM_SHORT,
    HintCode.SOLAR_TERM_HIGH,
)
WATCH_TYPES = ({"change", "mean", "state"}, {"state", "mean"})


def _helper(
    hass: HomeAssistant, domain: str, entity_id: str, options: dict[str, Any]
) -> str:
    """Add a helper config entry with its sensor entity; return the entry ID."""
    entry = MockConfigEntry(domain=domain, options=options)
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        domain,
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )
    return entry.entry_id


def _setup(
    hass: HomeAssistant,
    method: str = "em",
    *,
    with_power: bool = True,
    counter: bool = False,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Build a gross meter as the solar setup does; return prefs and records.

    EM / Net: the meter (and returned) + the solar term, our integral of our
    solar power template, or with `counter` the solar's own energy counter.
    From power: our integral of our gross power template.
    """
    for entity_id in (DRAWN, RETURNED, PV_ENERGY):
        _meter(hass, entity_id)
    for entity_id in (CIRCUIT_POWER, PV_POWER):
        _meter(
            hass, entity_id, device_class="power", unit="W", state_class="measurement"
        )
    records: dict[str, dict[str, Any]] = {}
    template_entry = _helper(
        hass,
        "template",
        TERM_POWER,
        {"template_type": "sensor", "state": solar_power_template(PV_POWER)},
    )
    records[template_entry] = {"kind": "solar_power", "power": PV_POWER}
    term_entry = _helper(hass, "integration", TERM, {"source": TERM_POWER})
    records[term_entry] = {
        "kind": "solar_energy",
        "power": PV_POWER,
        "template": template_entry,
    }
    power_entry: str | None = None
    if with_power:
        power_entry = _helper(
            hass,
            "template",
            GROSS_POWER,
            {
                "template_type": "sensor",
                "state": gross_power_template(CIRCUIT_POWER, PV_POWER),
            },
        )
        records[power_entry] = {"kind": "gross_power", "stat": DRAWN, "method": method}
    if method == "power":
        gross_entry = _helper(hass, "integration", GROSS, {"source": GROSS_POWER})
    else:
        solar = PV_ENERGY if counter else TERM
        gross_entry = _helper(
            hass,
            "template",
            GROSS,
            {
                "template_type": "sensor",
                "state": gross_energy_template(Method(method), DRAWN, solar, RETURNED),
            },
        )
    records[gross_entry] = {
        "kind": "gross_energy",
        "stat": DRAWN,
        "method": method,
        "power": power_entry,
    }
    device: dict[str, Any] = {"stat_consumption": GROSS}
    if with_power:
        device["stat_rate"] = GROSS_POWER
    prefs = _prefs(
        [device],
        [{"type": "solar", "stat_energy_from": PV_ENERGY, "stat_rate": PV_POWER}],
    )
    return prefs, records


def _hour_base() -> int:
    """Return the start of the hour three days ago (UTC timestamp)."""
    return (int(dt_util.utcnow().timestamp()) // 3600 - 72) * 3600


def _hourly(key: str, values: list[Any], base: int) -> list[dict[str, Any]]:
    return [
        {"start": float(base + 3600 * i), key: value}
        for i, value in enumerate(values)
        if value is not None
    ]


def _local_iso(timestamp: float) -> str:
    return dt_util.as_local(dt_util.utc_from_timestamp(timestamp)).isoformat()


async def _watch_hints(
    hass: HomeAssistant, prefs: dict[str, Any], records: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    """Return the safety-net hints only."""
    watched = await async_watch(hass, prefs, records)
    hints = await async_hints(
        hass, prefs, async_stats_info(hass, prefs), set(), Readings(set(), watched)
    )
    return [hint for hint in hints if hint["code"] in SAFETY_CODES]


def _gross_off(
    hour: float, direction: str, method: str = "em", **data: Any
) -> dict[str, Any]:
    return {
        "code": HintCode.GROSS_OFF,
        "stat": GROSS,
        "kind": "electricity",
        "data": {
            "direction": direction,
            "hour": _local_iso(hour),
            "method": method,
            **data,
        },
    }


async def test_gross_off_on_fall_and_on_jump(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A step against the gross power, either way, names the input that fell."""
    calls, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    hour = base + 3600 * 5
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 10, base)
    # The drawn counter fell back to 0: the gross meter fell with it.
    data[GROSS] = _hourly("change", [1, 1, 1, 1, 1, -40, 1, 1, 1, 1], base)
    data[DRAWN] = _hourly("state", [10, 11, 12, 13, 14, 0, 1, 2, 3, 4], base)
    data[RETURNED] = _hourly("state", [5.0] * 10, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            hour,
            "fall",
            change_kwh=-40.0,
            power_kwh=1.0,
            input=DRAWN,
            cause="input",
        )
    ]
    hourly = next(call for call in calls if call[4] == "hour")
    assert hourly[3] == {GROSS, GROSS_POWER, DRAWN, RETURNED, TERM, PV_ENERGY}
    assert hourly[5] == {"energy": "kWh", "power": "W"}
    assert hourly[6] == {"change", "mean", "state"}
    # A reset stays: a week of hourly statistics.
    assert (hourly[2] - hourly[1]).days == 7
    # The returned counter fell back to 0: the gross meter jumped.
    data[GROSS] = _hourly("change", [1, 1, 1, 1, 1, 6, 1, 1, 1, 1], base)
    data[DRAWN] = _hourly("state", [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], base)
    data[RETURNED] = _hourly("state", [5, 5, 5, 5, 5, 0, 0, 0, 0, 0], base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            hour, "jump", change_kwh=6.0, power_kwh=1.0, input=RETURNED, cause="input"
        )
    ]
    # A wrong sign: nothing fell, so no input is named; the latest hour wins.
    data[GROSS] = _hourly("change", [1, 1, 3, 1, 1, 3, 1, 1, 1, 1], base)
    data[RETURNED] = _hourly("state", [5.0] * 10, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(hour, "jump", change_kwh=3.0, power_kwh=1.0, cause="sign")
    ]
    # Less than the power and nothing fell, while the solar term counted less
    # than the solar itself in that hour: the solar term lost energy.
    data[GROSS] = _hourly("change", [1, 1, 1, 1, 1, 0.2, 1, 1, 1, 1], base)
    data[TERM] = _hourly("change", [2, 2, 2, 2, 2, 1.0, 2, 2, 2, 2], base)
    data[PV_ENERGY] = _hourly("change", [2.0] * 10, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(hour, "fall", change_kwh=0.2, power_kwh=1.0, cause="solar_term")
    ]
    # The term counted all: the gross power has the wrong sign.
    data[TERM] = _hourly("change", [2.0] * 10, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(hour, "fall", change_kwh=0.2, power_kwh=1.0, cause="sign")
    ]


async def test_gross_off_cause_of_an_inverted_power(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """EM while exporting: the gross power says 3.5 kW, the meter 0.5 kWh."""
    _, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    data[GROSS] = _hourly("change", [0.5] * 5, base)
    data[GROSS_POWER] = _hourly("mean", [3500.0] * 5, base)
    data[TERM] = _hourly("change", [3.0] * 5, base)
    data[PV_ENERGY] = _hourly("change", [3.0] * 5, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(base + 3 * 3600, "fall", change_kwh=0.5, power_kwh=3.5, cause="sign")
    ]


async def test_gross_off_cause_of_a_solar_dropout(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A 45-minute solar dropout while exporting takes the hour below 0."""
    _, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    # 3 kW solar, 0.5 kW load; held 10 minutes, then 35 minutes at 0.
    data[GROSS] = _hourly("change", [0.5, 0.5, -1.25, 0.5, 0.5], base)
    data[GROSS_POWER] = _hourly("mean", [500.0] * 5, base)
    data[TERM] = _hourly("change", [3.0, 3.0, 1.25, 3.0, 3.0], base)
    data[PV_ENERGY] = _hourly("change", [3.0] * 5, base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            base + 7200, "fall", change_kwh=-1.25, power_kwh=0.5, cause="solar_term"
        )
    ]


async def test_gross_off_without_power_only_on_fall(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Without a gross power only a fall below -0.5 kWh counts."""
    _, data = statistics
    prefs, records = _setup(hass, "net", with_power=False, counter=True)
    base = _hour_base()
    data[GROSS] = _hourly("change", [0.2, 0.2, -0.9, 0.0, 0.2], base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(base + 7200, "fall", "net", change_kwh=-0.9)
    ]
    # A jump, or a lag dip the next hour makes up, is no fall.
    data[GROSS] = _hourly("change", [0.2, 0.2, 9.0, 0.2, 0.2], base)
    assert await _watch_hints(hass, prefs, records) == []
    data[GROSS] = _hourly("change", [0.2, 0.2, -0.9, 1.1, 0.2], base)
    assert await _watch_hints(hass, prefs, records) == []
    # A load that stops is no fall either.
    data[GROSS] = _hourly("change", [3.0, 3.0, 0.0, 0.0, 0.0], base)
    assert await _watch_hints(hass, prefs, records) == []


async def test_gross_off_quiet_when_matching(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Matching hours, small or shifted differences and gaps give no hint."""
    _, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [3000.0, 3000.0, 200.0, 0.0, 3000.0], base)
    # Within 30 % of 3 kWh, within 0.5 kWh of 0.2 and 0 kWh.
    data[GROSS] = _hourly("change", [3.8, 2.2, 0.6, -0.4, 3.0], base)
    assert await _watch_hints(hass, prefs, records) == []
    # A lag: one hour counts late what the next counts early.
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 5, base)
    data[GROSS] = _hourly("change", [1, 1, -0.5, 2.5, 1], base)
    assert await _watch_hints(hass, prefs, records) == []
    # A step at the edge of the window, or next to a missing hour, waits.
    data[GROSS] = _hourly("change", [-9, 1, 1, None, -9, 1, 9], base)
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 7, base)
    assert await _watch_hints(hass, prefs, records) == []
    # No power mean in an hour: only a fall counts there.
    data[GROSS_POWER] = _hourly("mean", [1000.0, 1000.0, None, 1000.0], base)
    data[GROSS] = _hourly("change", [1, 1, 6, 1], base)
    assert await _watch_hints(hass, prefs, records) == []
    # A missing statistic, no recorder: no hint.
    data.clear()
    assert await _watch_hints(hass, prefs, records) == []
    hass.config.components.remove("recorder")
    assert await _watch_hints(hass, prefs, records) == []


@pytest.mark.parametrize(
    ("changes", "means", "with_power", "found"),
    [
        # A 1.0 kWh counter reset on a 2 kW circuit.
        ([2, 2, 1, 2, 2], [2000.0] * 5, True, 1.0),
        # A 2.5 kWh reset on a 5 kW heat pump.
        ([5, 5, 2.5, 5, 5], [5000.0] * 5, True, 2.5),
        # A 2 kWh reset on a 1 kW circuit, without a gross power.
        ([1, 1, -1, 1, 1], [], False, -1.0),
        # The solar term lags 5 minutes at 8 kW: 0.67 kWh move one hour on.
        ([0.3, 0.3, 0.3 - 0.667, 0.3 + 0.667, 0.3], [300.0] * 5, True, None),
    ],
)
async def test_gross_off_judges_by_the_hour(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    changes: list[float],
    means: list[float],
    with_power: bool,
    found: float | None,
) -> None:
    """Both windows around an hour are judged by the hour's own threshold."""
    _, data = statistics
    prefs, records = _setup(hass, with_power=with_power)
    base = _hour_base()
    data[GROSS] = _hourly("change", changes, base)
    data[GROSS_POWER] = _hourly("mean", means, base)
    hints = await _watch_hints(hass, prefs, records)
    assert [hint["data"]["change_kwh"] for hint in hints] == (
        [] if found is None else [found]
    )


async def test_gross_off_falls_with_its_power(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A gross meter never falls, even when its power agrees (a wrong invert)."""
    _, data = statistics
    prefs, records = _setup(hass, "power")
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [500.0, -400.0, -400.0, -400.0, 500.0], base)
    data[GROSS] = _hourly("change", [0.5, -0.4, -0.4, -0.4, 0.5], base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            base + 7200,
            "fall",
            "power",
            change_kwh=-0.4,
            power_kwh=-0.4,
            cause="sign",
        )
    ]


async def test_gross_off_from_power(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """From power: the integral is compared with the power it integrates."""
    _, data = statistics
    prefs, records = _setup(hass, "power")
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [500.0] * 4, base)
    data[GROSS] = _hourly("change", [0.5, 0.5, -3.0, 0.5], base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(base + 7200, "fall", "power", change_kwh=-3.0, power_kwh=0.5)
    ]


@pytest.mark.parametrize("method", ["power", "em"])
@pytest.mark.parametrize("hours", [1, 2, 3])
async def test_gross_off_skips_a_downtime(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
    method: str,
    hours: int,
) -> None:
    """Home Assistant off: the recorder fills the hours with the last values.

    The power's mean stays at 1.5 kW, the energy does not change; EM catches
    up when its counters are read again, From power does not.
    """
    _, data = statistics
    prefs, records = _setup(hass, method)
    base = _hour_base()
    catch_up = 1.5 * hours if method == "em" else 0.0
    data[GROSS] = _hourly(
        "change", [1.5, 1.5, *[0.0] * hours, 1.5 + catch_up, 1.5, 1.5], base
    )
    data[GROSS_POWER] = _hourly("mean", [1500.0] * (hours + 5), base)
    # Off from 02:00 until 2 minutes into the hour of the start.
    downtimes.append((base + 7200.0, base + 3600.0 * (2 + hours) + 120))
    assert await _watch_hints(hass, prefs, records) == []
    # Without knowing about it, the flat hours look like a fall (EM makes up a
    # single hour by itself).
    downtimes.clear()
    assert [hint["code"] for hint in await _watch_hints(hass, prefs, records)] == (
        [] if method == "em" and hours == 1 else [HintCode.GROSS_OFF]
    )


async def test_gross_off_skips_a_power_cut(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
) -> None:
    """A power cut longer than 1 h, the counters back without catching up."""
    _, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    data[GROSS] = _hourly("change", [1.5, 1.5, 0.3, 0.0, 0.0, 0.9, 1.5, 1.5], base)
    data[GROSS_POWER] = _hourly("mean", [1500.0] * 8, base)
    downtimes.append((base + 7200.0 + 720, base + 3600.0 * 5 + 1800))
    assert await _watch_hints(hass, prefs, records) == []


async def test_gross_off_reports_a_reset_in_a_power_cut(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
) -> None:
    """A plug that starts again at 0 after a power cut that took HA down too.

    The recorder fills a downtime flat and never makes a counter fall, so a
    fallen input is sure evidence even next to a downtime.
    """
    _, data = statistics
    prefs, records = _setup(hass, "plug")
    base = _hour_base()
    data[GROSS] = _hourly("change", [1, 1, 0, 0, 1 - 150, 1, 1, 1], base)
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 8, base)
    data[DRAWN] = _hourly("state", [100, 101, 101, 101, 0.5, 1.5, 2.5, 3.5], base)
    downtimes.append((base + 7200.0, base + 4 * 3600.0 + 300))
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            base + 4 * 3600,
            "fall",
            "plug",
            change_kwh=-149.0,
            power_kwh=1.0,
            input=DRAWN,
            cause="input",
        )
    ]


async def test_gross_off_net_export_is_no_reset(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
) -> None:
    """A Net meter that falls through export is no reset, also next to a restart.

    4 kW solar, 1 kW load: HA is off for 30 minutes, the Net meter books the
    export meanwhile and the solar term nothing (the solar-term check sees
    that loss).
    """
    _, data = statistics
    prefs, records = _setup(hass, "net")
    base = _hour_base()
    data[GROSS] = _hourly("change", [1, 1, -1.0, 1, 1], base)
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 5, base)
    data[DRAWN] = _hourly("state", [100, 97, 94, 91, 88], base)
    downtimes.append((base + 7200.0 + 600, base + 7200.0 + 2400))
    assert await _watch_hints(hass, prefs, records) == []


async def test_gross_off_net_with_an_inverted_power(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Net exporting with a gross power of the wrong sign: `sign`, not `input`."""
    _, data = statistics
    prefs, records = _setup(hass, "net")
    base = _hour_base()
    data[GROSS] = _hourly("change", [1.0] * 5, base)
    data[GROSS_POWER] = _hourly("mean", [-2000.0] * 5, base)
    data[DRAWN] = _hourly("state", [100, 97, 94, 91, 88], base)
    assert await _watch_hints(hass, prefs, records) == [
        _gross_off(
            base + 3 * 3600,
            "jump",
            "net",
            change_kwh=1.0,
            power_kwh=-2.0,
            cause="sign",
        )
    ]


async def test_gross_off_short_restart_masks_nothing(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
) -> None:
    """A routine 2-minute restart leaves the hours around it checked."""
    _, data = statistics
    prefs, records = _setup(hass, "power")
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [500.0] * 4, base)
    data[GROSS] = _hourly("change", [0.5, 0.5, -3.0, 0.5], base)
    downtimes.append((base + 7200.0 + 600, base + 7200.0 + 720))
    assert [hint["code"] for hint in await _watch_hints(hass, prefs, records)] == [
        HintCode.GROSS_OFF
    ]


async def test_watch_without_downtimes(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Unreadable downtimes: no gross hints, the solar term is still checked."""
    _, data = statistics
    # The real reader, without a recorder database behind it.
    monkeypatch.setattr(stats_probe, "read_downtimes", read_downtimes)
    prefs, records = _setup(hass)
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 4, base)
    data[GROSS] = _hourly("change", [1, 1, -9, 1], base)
    start, end = _day()
    data[TERM] = _day_rows(8.0, start, end)
    data[PV_ENERGY] = _day_rows(10.0, start, end)
    assert [hint["code"] for hint in await _watch_hints(hass, prefs, records)] == [
        HintCode.SOLAR_TERM_SHORT
    ]


async def test_watch_reads_only_what_the_recorder_keeps(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Downtimes older than `keep_days` are purged: no older hours are read."""
    calls, _ = statistics

    class ShortRecorder(FakeRecorder):
        keep_days = 3

    monkeypatch.setattr(stats_probe, "get_instance", ShortRecorder)
    prefs, records = _setup(hass)
    await _watch_hints(hass, prefs, records)
    hourly = next(call for call in calls if call[4] == "hour")
    assert (hourly[2] - hourly[1]).days == 3


def _last_row(now: float) -> float:
    """Return the start of the last 5-minute row compiled by `now`."""
    return now // 300 * 300 - 300


def _five_minutes(key: str, minutes: list[int], now: float) -> list[dict[str, Any]]:
    """Return 5-minute rows that start `minutes` before the last one."""
    last = _last_row(now)
    return [{"start": last - 60 * m, key: 1.0} for m in sorted(minutes, reverse=True)]


def _unknown(start: float, minutes: int, **data: Any) -> dict[str, Any]:
    return {
        "code": HintCode.GROSS_UNKNOWN,
        "stat": GROSS,
        "kind": "electricity",
        "data": {"hour": _local_iso(start), "minutes": minutes, **data},
    }


EVERY = list(range(0, 600, 5))
# No rows from 300 minutes before the last one until 210 minutes before:
# 90 minutes without a value.
GAP = [m for m in EVERY if not 210 < m < 305]


async def test_gross_unknown_gap(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    freezer: FrozenDateTimeFactory,
) -> None:
    """More than 1 h without a value in the last day names the input."""
    calls, data = statistics
    freezer.move_to("2026-11-23 12:02:30+00:00")
    prefs, records = _setup(hass)
    now = dt_util.utcnow().timestamp()
    last = _last_row(now)
    data[GROSS] = _five_minutes("state", GAP, now)
    data[DRAWN] = _five_minutes("state", GAP, now)
    data[RETURNED] = _five_minutes("state", EVERY, now)
    data[TERM] = _five_minutes("state", EVERY, now)
    gap_start = last - 60 * 305 + 300
    assert await _watch_hints(hass, prefs, records) == [
        _unknown(gap_start, 90, input=DRAWN)
    ]
    short = next(call for call in calls if call[4] == "5minute")
    assert short[3] == {GROSS, DRAWN, RETURNED, TERM}
    assert short[6] == {"state", "mean"}
    assert (short[2] - short[1]).days == 1
    # Both inputs had values: the input is unknown.
    data[DRAWN] = _five_minutes("state", EVERY, now)
    assert await _watch_hints(hass, prefs, records) == [_unknown(gap_start, 90)]
    # 55 minutes are no gap.
    data[GROSS] = _five_minutes("state", [m for m in EVERY if not 240 < m < 300], now)
    assert await _watch_hints(hass, prefs, records) == []
    # Unknown right now, for the last two hours.
    data[GROSS] = _five_minutes("state", [m for m in EVERY if m >= 120], now)
    since = last - 60 * 120 + 300
    assert await _watch_hints(hass, prefs, records) == [
        _unknown(since, int((now - since) // 60))
    ]
    # No rows of the gross meter at all: nothing to tell.
    data.pop(GROSS)
    assert await _watch_hints(hass, prefs, records) == []


async def test_gross_unknown_while_everything_is_out(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    downtimes: list[tuple[float, float]],
    freezer: FrozenDateTimeFactory,
) -> None:
    """Everything out while Home Assistant runs is a gap; its downtime is not."""
    _, data = statistics
    freezer.move_to("2026-11-23 12:02:30+00:00")
    prefs, records = _setup(hass)
    now = dt_util.utcnow().timestamp()
    gap_start = _last_row(now) - 60 * 305 + 300
    for entity_id in (GROSS, DRAWN, RETURNED, TERM):
        data[entity_id] = _five_minutes("state", GAP, now)
    assert [
        hint["data"]["minutes"] for hint in await _watch_hints(hass, prefs, records)
    ] == [90]
    # Off for 50 of the 90 minutes: 40 minutes without a value are left.
    downtimes.append((gap_start + 600, gap_start + 3600))
    assert await _watch_hints(hass, prefs, records) == []
    # Just started: the missing statistics are not compiled yet.
    downtimes.clear()
    data[GROSS] = _five_minutes("state", [m for m in EVERY if m >= 120], now)
    downtimes.append((_last_row(now) - 60 * 120 + 400, now - 300))
    assert await _watch_hints(hass, prefs, records) == []


async def test_gross_unknown_from_power_watches_its_power(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    freezer: FrozenDateTimeFactory,
) -> None:
    """From power: the integral keeps its rows, the gross power has the gap."""
    calls, data = statistics
    freezer.move_to("2026-11-23 12:02:30+00:00")
    prefs, records = _setup(hass, "power")
    now = dt_util.utcnow().timestamp()
    gap_start = _last_row(now) - 60 * 305 + 300
    data[GROSS] = _five_minutes("state", EVERY, now)
    data[GROSS_POWER] = _five_minutes("mean", GAP, now)
    data[CIRCUIT_POWER] = _five_minutes("mean", GAP, now)
    data[PV_POWER] = _five_minutes("mean", EVERY, now)
    assert await _watch_hints(hass, prefs, records) == [
        _unknown(gap_start, 90, input=CIRCUIT_POWER)
    ]
    short = next(call for call in calls if call[4] == "5minute")
    assert short[3] == {GROSS, GROSS_POWER, CIRCUIT_POWER, PV_POWER}
    # Both powers out: the circuit's is named, not the solar's.
    data[PV_POWER] = _five_minutes("mean", GAP, now)
    assert await _watch_hints(hass, prefs, records) == [
        _unknown(gap_start, 90, input=CIRCUIT_POWER)
    ]


async def test_gross_unknown_skips_the_solar_counter_at_night(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    freezer: FrozenDateTimeFactory,
) -> None:
    """A gross meter on the solar's own counter pauses while the inverter sleeps."""
    _, data = statistics
    freezer.move_to("2026-11-23 12:02:30+00:00")
    prefs, records = _setup(hass, "net", with_power=False, counter=True)
    now = dt_util.utcnow().timestamp()
    # 15 hours of rows; the inverter was offline for 8 of them.
    full = list(range(0, 900, 5))
    night = [m for m in full if not 120 < m < 605]
    data[GROSS] = _five_minutes("state", night, now)
    data[PV_ENERGY] = _five_minutes("state", night, now)
    data[DRAWN] = _five_minutes("state", full, now)
    assert await _watch_hints(hass, prefs, records) == []
    # The net meter was out too: a gap, and it is named.
    data[DRAWN] = _five_minutes("state", night, now)
    hints = await _watch_hints(hass, prefs, records)
    assert [(hint["code"], hint["data"].get("input")) for hint in hints] == [
        (HintCode.GROSS_UNKNOWN, DRAWN)
    ]


def _day() -> tuple[float, float]:
    """Return the start and end of yesterday (local) as UTC timestamps."""
    today = dt_util.start_of_local_day()
    return (
        dt_util.start_of_local_day(today.date() - timedelta(days=1)).timestamp(),
        today.timestamp(),
    )


def _day_rows(total: float, start: float, end: float) -> list[dict[str, Any]]:
    """Return hourly change rows over [start, end) that add up to `total`."""
    hours = int((end - start) // 3600)
    return [{"start": start + 3600 * i, "change": total / hours} for i in range(hours)]


def _term_hint(
    code: HintCode, term: float, source: float, stat: str = PV_ENERGY
) -> dict[str, Any]:
    day_start, _ = _day()
    return {
        "code": code,
        "stat": stat,
        "kind": "electricity",
        "data": {
            "role": "production",
            "entity_id": TERM,
            "day": dt_util.as_local(dt_util.utc_from_timestamp(day_start))
            .date()
            .isoformat(),
            "term_kwh": term,
            "source_kwh": source,
        },
    }


async def test_solar_term_against_its_source(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """The solar term's day is compared with the solar's own statistic."""
    _, data = statistics
    prefs, records = _setup(hass)
    start, end = _day()
    # Equal: no hint. Rows outside the day do not count.
    data[TERM] = [
        {"start": start - 3600, "change": 5.0},
        *_day_rows(10.0, start, end),
        {"start": end, "change": 5.0},
    ]
    data[PV_ENERGY] = _day_rows(10.0, start, end)
    assert await _watch_hints(hass, prefs, records) == []
    # 2 kWh short on a 10 kWh day (more than 15 %).
    data[TERM] = _day_rows(8.0, start, end)
    assert await _watch_hints(hass, prefs, records) == [
        _term_hint(HintCode.SOLAR_TERM_SHORT, 8.0, 10.0)
    ]
    # Higher by the same margin.
    data[TERM] = _day_rows(12.0, start, end)
    assert await _watch_hints(hass, prefs, records) == [
        _term_hint(HintCode.SOLAR_TERM_HIGH, 12.0, 10.0)
    ]
    # A dull day: within 0.5 kWh.
    data[TERM] = _day_rows(0.6, start, end)
    data[PV_ENERGY] = _day_rows(1.0, start, end)
    assert await _watch_hints(hass, prefs, records) == []


async def test_solar_term_without_statistics(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A missing statistic, or a term made during the day, gives no hint."""
    _, data = statistics
    prefs, records = _setup(hass)
    start, end = _day()
    data[TERM] = _day_rows(8.0, start, end)
    assert await _watch_hints(hass, prefs, records) == []
    data[PV_ENERGY] = _day_rows(10.0, start, end)
    data[TERM] = _day_rows(4.0, start + 6 * 3600, end)
    assert await _watch_hints(hass, prefs, records) == []
    data.pop(TERM)
    assert await _watch_hints(hass, prefs, records) == []


async def test_solar_term_in_a_half_hour_time_zone(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Hourly rows start at :30 local time in India; the day is still checked."""
    _, data = statistics
    await hass.config.async_set_time_zone("Asia/Kolkata")
    prefs, records = _setup(hass)
    start, end = _day()
    first = start + 1800
    data[TERM] = _day_rows(8.0, first, end)
    data[PV_ENERGY] = _day_rows(10.0, first, end)
    assert await _watch_hints(hass, prefs, records) == [
        _term_hint(HintCode.SOLAR_TERM_SHORT, 8.0, 10.0)
    ]


async def test_solar_term_finds_its_source(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A solar without its power in the settings is found by pairing."""
    _, data = statistics
    prefs, records = _setup(hass)
    inverter = _device(hass, "inverter")
    _entity(hass, "sensor.inv_energy", inverter, platform="test")
    er.async_get(hass).async_update_entity(PV_POWER, device_id=inverter)
    solar = prefs["energy_sources"][0]
    del solar["stat_rate"]
    solar["stat_energy_from"] = "sensor.inv_energy"
    start, end = _day()
    data[TERM] = _day_rows(8.0, start, end)
    data["sensor.inv_energy"] = _day_rows(10.0, start, end)
    assert await _watch_hints(hass, prefs, records) == [
        _term_hint(HintCode.SOLAR_TERM_SHORT, 8.0, 10.0, "sensor.inv_energy")
    ]
    # A solar with another power is not the term's.
    solar["stat_rate"] = "sensor.other_power"
    assert await _watch_hints(hass, prefs, records) == []


async def test_watch_never_breaks_hints(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failing check only loses its hint; meters that are not ours are skipped."""
    calls, data = statistics
    prefs, records = _setup(hass)
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 4, base)
    data[GROSS] = _hourly("change", [1, 1, -9, 1], base)
    # Not ours: a plain meter and a helper without a record.
    _helper(hass, "template", "sensor.other", {"template_type": "sensor", "state": "1"})
    prefs["device_consumption"] += [
        {"stat_consumption": DRAWN},
        {"stat_consumption": "sensor.other"},
    ]
    assert [hint["code"] for hint in await _watch_hints(hass, prefs, records)] == [
        HintCode.GROSS_OFF
    ]

    def fail(*args: Any) -> Any:
        raise RuntimeError("broken")

    monkeypatch.setattr(hints_module, "_gross_off", fail)
    assert await _watch_hints(hass, prefs, records) == []
    # A failing recorder query.
    monkeypatch.setattr(stats_probe, "read_downtimes", fail)
    assert await _watch_hints(hass, prefs, records) == []
    monkeypatch.setattr(hints_module, "_gross_meters", fail)
    assert await _watch_hints(hass, prefs, records) == []
    # Without any gross meter nothing is read.
    calls.clear()
    assert await async_watch(hass, prefs, {}) == Watched()
    assert calls == []


async def _get(hass_ws_client: WebSocketGenerator, hass: HomeAssistant) -> Any:
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/get"})
    response = await client.receive_json()
    assert response["success"], response
    return response["result"]


@pytest.fixture
async def watched_setup(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Give `get` a gross meter of ours in the settings."""

    async def no_external(hass: HomeAssistant, **kwargs: Any) -> list[Any]:
        return []

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", no_external)
    prefs, records = _setup(hass)
    helpers = loaded_entry.runtime_data.helpers
    for entry_id, record in records.items():
        await helpers.async_add(entry_id, record)

    async def get_prefs(hass: HomeAssistant) -> dict[str, Any]:
        return deepcopy(prefs)

    monkeypatch.setattr(energy_access, "async_get_prefs", get_prefs)


@pytest.mark.usefixtures("sensors", "watched_setup")
async def test_get_watches_gross_meters(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
) -> None:
    """`get` finds the gross meters by the created helpers' records."""
    _, data = statistics
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 4, base)
    data[GROSS] = _hourly("change", [1, 1, -9, 1], base)
    result = await _get(hass_ws_client, hass)
    assert {
        "code": "gross_off",
        "stat": GROSS,
        "kind": "electricity",
        "data": {
            "direction": "fall",
            "hour": _local_iso(base + 7200),
            "method": "em",
            "change_kwh": -9.0,
            "power_kwh": 1.0,
        },
    } in result["hints"]


@pytest.mark.usefixtures("sensors", "watched_setup")
async def test_get_reads_the_safety_net_once_in_5_minutes(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    freezer: FrozenDateTimeFactory,
) -> None:
    """A second `get` within 5 minutes uses the safety net's last reading."""
    calls, data = statistics
    base = _hour_base()
    data[GROSS_POWER] = _hourly("mean", [1000.0] * 4, base)
    data[GROSS] = _hourly("change", [1, 1, -9, 1], base)

    def watch_queries() -> int:
        return sum(1 for call in calls if call[6] in WATCH_TYPES)

    await _get(hass_ws_client, hass)
    assert watch_queries() == 2
    freezer.tick(timedelta(minutes=4))
    result = await _get(hass_ws_client, hass)
    assert watch_queries() == 2
    assert HintCode.GROSS_OFF in [hint["code"] for hint in result["hints"]]
    freezer.tick(timedelta(minutes=2))
    await _get(hass_ws_client, hass)
    assert watch_queries() == 4


async def test_power_hint_skips_another_channels_power(hass: HomeAssistant) -> None:
    """On a multi-channel meter the hint never names another channel's power."""
    iotawatt = _device(hass, "iotawatt")

    def channel(entity_id: str, unique_id: str, device_class: str = "energy") -> None:
        _entity(
            hass,
            entity_id,
            iotawatt,
            platform="iotawatt",
            unique_id=unique_id,
            device_class=device_class,
            unit="kWh" if device_class == "energy" else "W",
        )

    channel("sensor.input_1_wh", "abc-input-1-WattHours")
    channel("sensor.input_2_wh", "abc-input-2-WattHours")
    channel("sensor.input_2_w", "abc-input-2-Watts", "power")
    prefs = _prefs(
        [
            {"stat_consumption": "sensor.input_1_wh"},
            {"stat_consumption": "sensor.input_2_wh", "stat_rate": "sensor.input_2_w"},
        ]
    )
    assert await _hints(hass, prefs) == []
    # Its own channel's power is named.
    channel("sensor.input_1_w", "abc-input-1-Watts", "power")
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.POWER_AVAILABLE,
            "stat": "sensor.input_1_wh",
            "kind": "electricity",
            "data": {"entity_id": "sensor.input_1_w"},
        }
    ]
