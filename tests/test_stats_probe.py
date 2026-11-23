"""Tests for what the statistics say about energy and power sensors.

The table tests use the series of the device research and the reviews: an
OpenDTU `YieldDay` that starts again at sunrise, a daily EV meter that charges
right after midnight, lifetime net meters near 0 with a midday export, a
lifetime meter with one glitch, utility meters and `last_reset`.
"""

from __future__ import annotations

import asyncio
import random
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper import stats_probe
from custom_components.energy_flow_mapper.stats_probe import (
    Reason,
    StatsEvidence,
    async_probe,
    periodic_from_series,
    sign_evidence,
)

from .common import MockConfigEntry

ZURICH = "Europe/Zurich"
START = datetime.fromisoformat("2026-11-19T00:00:00+01:00")
HOUR = 60
FIVE = 5

type Rate = Callable[[datetime], float]
type Rows = dict[str, list[dict[str, Any]]]


def accumulate(
    rate: Rate, start: float, step: int = HOUR, hours: int = 72
) -> list[tuple[datetime, float]]:
    """Return (start, state) rows of a meter that counts `rate` kWh an hour.

    The state of a row is the value at its end, as in the statistics.
    """
    value, states = start, []
    for index in range(hours * 60 // step):
        when = START + timedelta(minutes=step * index)
        value += rate(when) * step / 60
        states.append((when, round(value, 4)))
    return states


def power_of(
    rate: Rate, step: int = HOUR, hours: int = 72
) -> list[tuple[datetime, datetime, float]]:
    """Return (start, end, mean W) rows of the power behind `rate`."""
    return [
        (when, when + timedelta(minutes=step), rate(when) * 1000)
        for when in (
            START + timedelta(minutes=step * index)
            for index in range(hours * 60 // step)
        )
    ]


def balanced(hours: int) -> tuple[dict[int, float], float]:
    """Return a flat export of `hours` hours that carries the loads of the day."""
    night = 0.15
    per = night * (24 - hours) / hours
    first = 13 - hours // 2
    return dict.fromkeys(range(first, first + hours), -per), night


# Lifetime net meters of a circuit with a balcony solar: the loads draw all
# day, the solar exports at midday, and the days balance out near 0.
PROFILES: dict[str, tuple[dict[int, float], float]] = {
    "flat 2 h": balanced(2),
    "flat 3 h": balanced(3),
    "flat 4 h": balanced(4),
    "bell 3 h": ({11: -0.8, 12: -1.6, 13: -0.8}, 3.2 / 21),
    "bell 4 h": ({11: -0.6, 12: -1.2, 13: -1.2, 14: -0.6}, 3.6 / 20),
    "ramp 6 h": ({10: -0.3, 11: -0.6, 12: -0.7, 13: -0.7, 14: -0.6, 15: -0.3}, 0.15),
}
STARTS = [tenth / 10 for tenth in range(1, 61)]


def net_rate(profile: str) -> Rate:
    export, night = PROFILES[profile]
    return lambda when: export.get(when.hour, night)


def opendtu(when: datetime) -> float:
    """YieldDay in kWh: 0 when the inverter wakes at 07:00, 2.1 kWh at night."""
    hours = when.hour + when.minute / 60
    if hours < 7:
        return 2.1
    return round(min((hours - 7) * 0.21, 2.1), 4)


def opendtu_power(when: datetime) -> float:
    """Inverter power in kW: a little at sunrise, 0.21 kW over the day."""
    return 0.21 if 7 <= when.hour < 17 else 0.0


def ev(when: datetime) -> float:
    """Return a daily EV meter: 7 kWh an hour from 00:00 to 02:00, 0 at midnight."""
    return 7.0 * min(when.hour + (when.minute + 5) / 60, 2.0)


def ev_power(when: datetime) -> float:
    return 7.0 if when.hour < 2 else 0.0


def five_minute(value: Callable[[datetime], float]) -> list[tuple[datetime, float]]:
    return [
        (when, value(when))
        for when in (START + timedelta(minutes=5 * index) for index in range(864))
    ]


# --- The rule ------------------------------------------------------------------


@pytest.mark.parametrize("night_rows", [True, False])
def test_periodic_opendtu_sunrise(night_rows: bool) -> None:
    """YieldDay falls from the day's value to 0 at 07:00, not at midnight.

    At night the inverter sleeps: it keeps its value, or sends nothing.
    """
    series = [
        (when, value)
        for when, value in five_minute(opendtu)
        if night_rows or 7 <= when.hour < 17
    ]
    periodic, drops = periodic_from_series(series)
    assert periodic
    assert {(when.hour, when.minute, after) for when, _, after in drops} == {
        (7, 0, 0.0)
    }
    assert drops[-1][1] == (2.1 if night_rows else pytest.approx(2.0825))
    assert {when.date() for when, _, _ in drops} == {
        (START + timedelta(days=day)).date() for day in range(1, 3)
    } | ({START.date()} if night_rows else set())


def test_periodic_midnight_ev_with_last_reset() -> None:
    """A daily EV meter that charges right after midnight.

    In hourly states it never falls by half (14 -> 7); the 5-minute states
    show the reset (14 -> 0.58). The `last_reset` of such a meter makes it
    certain (see `test_last_reset_changed_certain`).
    """
    periodic, drops = periodic_from_series(five_minute(ev))
    assert periodic
    assert drops[0][1:] == (14.0, pytest.approx(0.5833, abs=1e-3))
    hourly = [(when, ev(when + timedelta(minutes=55))) for when, _ in accumulate(ev, 0)]
    assert not periodic_from_series(hourly)[0]


@pytest.mark.parametrize("step", [HOUR, FIVE])
@pytest.mark.parametrize("profile", ["flat 3 h", "bell 3 h"])
def test_not_periodic_net_near_zero_3h_export(profile: str, step: int) -> None:
    """A lifetime net meter near 0 with 3 hours of export is not periodic.

    Every start from 0.1 to 6.0 kWh: the export hours land near 0 at the same
    time every day, but they are the meter's usual falls.
    """
    rate = net_rate(profile)
    wrong = [
        start
        for start in STARTS
        if periodic_from_series(accumulate(rate, start, step))[0]
    ]
    assert wrong == []


@pytest.mark.parametrize("step", [HOUR, FIVE])
@pytest.mark.parametrize("profile", list(PROFILES))
def test_not_periodic_net_near_zero_explained_by_power(profile: str, step: int) -> None:
    """With the meter's own power, an export fall is explained: never a reset.

    This includes the 2-hour export, which the shape alone cannot tell from a
    reset on hourly states (both export hours land near 0).
    """
    rate = net_rate(profile)
    power = power_of(rate, step)
    wrong = [
        start
        for start in STARTS
        if periodic_from_series(accumulate(rate, start, step), power)[0]
    ]
    assert wrong == []
    # The shape alone: the 2-hour export on hourly states is the known limit.
    if (profile, step) == ("flat 2 h", HOUR):
        assert any(
            periodic_from_series(accumulate(rate, start, step))[0] for start in STARTS
        )


def test_periodic_reset_not_explained_by_power() -> None:
    """A reset while the power is 0 or positive is a reset, power or not."""
    opendtu_rows = power_of(opendtu_power, FIVE)
    periodic, drops = periodic_from_series(five_minute(opendtu), opendtu_rows)
    assert periodic
    assert len(drops) == 3
    periodic, drops = periodic_from_series(five_minute(ev), power_of(ev_power, FIVE))
    assert periodic
    assert len(drops) == 2


FALL_BACK = datetime(2026, 10, 23, 22, 0, tzinfo=UTC)  # 3 days with 2026-10-25
NORMAL = datetime(2026, 11, 18, 23, 0, tzinfo=UTC)


def net_meter(
    profile: str,
    start: float,
    step: int,
    *,
    first: datetime = NORMAL,
    resolution: float | None = None,
    lag: int = 0,
    sign: Callable[[float], float] = lambda watts: watts,
) -> tuple[list[tuple[datetime, float]], list[tuple[datetime, datetime, float]]]:
    """Return the states and power rows of a lifetime net meter near 0.

    Times are Europe/Zurich, built in UTC (so the night the clocks go back has
    two 02:00 hours). The meter reports with `resolution` kWh and up to `lag`
    seconds late (a fixed pseudo-random share per row); `sign` turns the
    power into an unsigned or reversed one.
    """
    zone = dt_util.get_time_zone(ZURICH)
    assert zone is not None
    export, night = PROFILES[profile]
    rng = random.Random(0)  # noqa: S311 - a fixed pattern, not security
    value, states, power = start, [], []
    for index in range(72 * 60 // step):
        begin = first + timedelta(minutes=step * index)
        rate = export.get(begin.astimezone(zone).hour, night)
        value += rate * step / 60
        reported = value - rate * lag / 3600 * rng.random()
        if resolution:
            reported = round(reported / resolution) * resolution
        states.append((begin.astimezone(zone), round(reported, 6)))
        power.append(
            (
                begin.astimezone(zone),
                (begin + timedelta(minutes=step)).astimezone(zone),
                sign(rate * 1000),
            )
        )
    return states, power


def _wrong(profile: str, step: int, **kwargs: Any) -> list[float]:
    """Return the starts (0.1 to 6.0 kWh) a net meter near 0 is taken as periodic."""
    return [
        start
        for start in STARTS
        if periodic_from_series(*net_meter(profile, start, step, **kwargs))[0]
    ]


@pytest.mark.parametrize("step", [HOUR, FIVE])
@pytest.mark.parametrize("profile", list(PROFILES))
async def test_power_windows_in_utc_on_the_fall_back_night(
    hass: HomeAssistant, profile: str, step: int
) -> None:
    """The night the clocks go back: windows are UTC, local times would shift 1 h.

    In local times the shortest 5-minute step is -55 minutes (02:55 -> 02:00).
    """
    await hass.config.async_set_time_zone(ZURICH)
    assert _wrong(profile, step, first=FALL_BACK) == []
    states, _ = net_meter(profile, 1.0, step, first=FALL_BACK)
    hours = stats_probe._hourly(states, last=True)
    assert len(hours) == 72
    # The two 02:00 hours stay apart.
    assert [when.hour for when, _ in hours].count(2) == 4


@pytest.mark.parametrize(
    ("resolution", "lag"),
    [(0.01, 0), (0.01, 60), (0.001, 60), (0.001, 120), (0.001, 240)],
)
@pytest.mark.parametrize("step", [HOUR, FIVE])
def test_power_check_allows_resolution_and_lag(
    resolution: float, lag: int, step: int
) -> None:
    """Near 0, a meter's resolution and its update lag outweigh 30 % of a fall.

    The fall is explained within the shape rule's margin too, and within the
    step widened by one row (a meter that reports late).
    """
    for profile in PROFILES:
        assert _wrong(profile, step, resolution=resolution, lag=lag) == [], profile


@pytest.mark.parametrize("step", [HOUR, FIVE])
@pytest.mark.parametrize(
    "sign", [abs, lambda watts: -watts], ids=["unsigned", "reversed"]
)
def test_unsigned_or_reversed_power_is_not_trusted(
    sign: Callable[[float], float], step: int
) -> None:
    """A power that disagrees with the meter's steps does not explain its falls.

    The falls of that direction go to the shape rule: never periodic, apart
    from the 2-hour export on hourly states (the known shape limit). Resets of
    daily meters, whose power agrees with every step, are still found.
    """
    for profile in PROFILES:
        wrong = _wrong(profile, step, sign=sign)
        if (profile, step) == ("flat 2 h", HOUR):
            shape = [
                start
                for start in STARTS
                if periodic_from_series(net_meter(profile, start, step)[0])[0]
            ]
            assert wrong == shape
        else:
            assert wrong == [], profile
    assert periodic_from_series(five_minute(ev), power_of(ev_power, FIVE))[0]
    assert periodic_from_series(five_minute(opendtu), power_of(opendtu_power, FIVE))[0]


def per_day_meter(
    rate: Rate, step: int
) -> tuple[list[tuple[datetime, float]], list[tuple[datetime, datetime, float]]]:
    """Return a per-day net meter (0 at midnight) and its power, from START."""
    value, states, power = 0.0, [], []
    for index in range(72 * 60 // step):
        when = START + timedelta(minutes=step * index)
        if when.hour == 0 and when.minute == 0:
            value = 0.0
        value += rate(when) * step / 60
        states.append((when, round(value, 4)))
        power.append((when, when + timedelta(minutes=step), rate(when) * 1000))
    return states, power


@pytest.mark.parametrize(
    ("step", "load", "export", "day_end"),
    [(HOUR, 0.5, 1.6, -1.1), (HOUR, 1.5, 3.2, -3.1), (FIVE, 0.5, 1.4, -0.1)],
)
def test_power_of_the_falls_sign_does_not_hide_a_reset(
    step: int, load: float, export: float, day_end: float
) -> None:
    """A per-day net meter ends the day below 0 and resets while importing.

    The import right after midnight has the reset's sign but is a fraction of
    it: the power never explains a fall the shape rule takes for a reset.
    """

    def rate(when: datetime) -> float:
        if 10 <= when.hour < 15:
            return -export
        return load if 17 <= when.hour < 23 else 0.3

    states, power = per_day_meter(rate, step)
    assert states[24 * 60 // step - 1][1] == pytest.approx(day_end)
    assert periodic_from_series(states)[0]
    assert periodic_from_series(states, power)[0]


@pytest.mark.parametrize("step", [HOUR, FIVE])
def test_battery_export_at_midnight_does_not_hide_a_reset(step: int) -> None:
    """A per-day net meter at 2 kWh resets while a battery exports 0.5 kW."""

    def rate(when: datetime) -> float:
        if when.hour >= 22 or when.hour < 2:
            return -0.5
        return -1.0 if 10 <= when.hour < 15 else 0.6

    states, power = per_day_meter(rate, step)
    assert states[24 * 60 // step - 1][1] == pytest.approx(2.0)
    assert periodic_from_series(states, power)[0]


def test_power_explains_a_fall_only_when_it_matches() -> None:
    """The power's energy must have the fall's sign and be within 30 % of it."""
    series = [
        (START + timedelta(days=day, hours=hour), value)
        for day in range(3)
        for hour, value in enumerate((10.0, 2.0, 3.0))
    ]
    end = timedelta(hours=1)

    def power(kw: float) -> list[tuple[datetime, datetime, float]]:
        return [
            (
                START + timedelta(days=day, hours=1),
                START + timedelta(days=day, hours=1) + end,
                kw * 1000,
            )
            for day in range(3)
        ]

    # A fall of 8 kWh: -8 kWh of power explains it, -6 (25 % off) too.
    assert not periodic_from_series(series, power(-8.0))[0]
    assert not periodic_from_series(series, power(-6.0))[0]
    # -5 kWh is 37.5 % off, +8 kWh the wrong direction: resets.
    assert periodic_from_series(series, power(-5.0))[0]
    assert periodic_from_series(series, power(8.0))[0]
    # No power rows inside the step: the shape decides (a reset here).
    assert periodic_from_series(series, [])[0]


def test_without_power_float_noise_does_not_decide() -> None:
    """A fall equal to twice the usual fall is no reset, also with float noise.

    The jump must be larger than 2 x the p90 by more than `JUMP_TOLERANCE`.
    """
    values: list[float] = []
    for _ in range(3):
        values += [2.4, 1.6, 0.0, 0.8, 1.6, 2.4, 1.6]
    for noise in (0.0, 1e-12, 1e-9, 0.0005):
        series = [
            (START + timedelta(hours=8 * index), value + (noise if value else 0.0))
            for index, value in enumerate(values)
        ]
        assert not periodic_from_series(series)[0], noise
    # Clearly larger than twice the usual fall: a reset.
    values = []
    for _ in range(3):
        values += [2.4, 1.9, 0.0, 0.8, 1.6, 2.4, 2.4]
    series = [
        (START + timedelta(hours=8 * index), value)
        for index, value in enumerate(values)
    ]
    assert periodic_from_series(series)[0]


def test_not_periodic_lifetime_glitch_once() -> None:
    """A lifetime meter that shows 0 once is not periodic; the drop is kept."""
    series = [
        (when, 1000 + 0.3 * (when - START).total_seconds() / 3600)
        for when, _ in five_minute(lambda when: 0.0)
    ]
    series[400] = (series[400][0], 0.0)
    periodic, drops = periodic_from_series(series)
    assert not periodic
    assert drops == [(series[400][0], series[399][1], 0.0)]


def test_periodic_rule_edge_cases() -> None:
    """Too few states, a flat meter and a meter below 0 that resets daily."""
    assert periodic_from_series([]) == (False, [])
    assert periodic_from_series([(START, 3.0)]) == (False, [])
    flat = [(START + timedelta(hours=hour), 0.0) for hour in range(72)]
    assert periodic_from_series(flat) == (False, [])
    below = [(START + timedelta(hours=hour), -0.3 * (hour % 24)) for hour in range(72)]
    periodic, drops = periodic_from_series(below)
    assert periodic
    assert [(when.hour, before, after) for when, before, after in drops] == [
        (0, pytest.approx(-6.9), 0.0),
        (0, pytest.approx(-6.9), 0.0),
    ]


def test_sign_evidence_never_negative_is_unverified() -> None:
    """A power that never went below 0 says nothing about its sign."""
    assert not sign_evidence([])
    assert not sign_evidence([(START, 0.0), (START + timedelta(hours=1), 350.0)])
    assert sign_evidence([(START, 120.0), (START + timedelta(hours=1), -0.5)])


# --- Reading the statistics ------------------------------------------------------


class FakeRecorder:
    """Run executor jobs like the recorder does."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance like get_instance would return it."""
        self.hass = hass

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        """Run the job directly."""
        return func(*args)


def energy_rows(
    states: list[tuple[datetime, float]],
    step: int = FIVE,
    last_reset: Callable[[datetime], datetime | None] | None = None,
) -> list[dict[str, Any]]:
    return [
        {
            "start": when.timestamp(),
            "end": (when + timedelta(minutes=step)).timestamp(),
            "state": value,
            "last_reset": (
                reset.timestamp()
                if last_reset is not None and (reset := last_reset(when)) is not None
                else None
            ),
        }
        for when, value in states
    ]


def power_rows(
    rows: list[tuple[datetime, datetime, float]], low: float = 0.0
) -> list[dict[str, Any]]:
    return [
        {
            "start": start.timestamp(),
            "end": end.timestamp(),
            "mean": mean,
            "min": min(mean, low),
        }
        for start, end, mean in rows
    ]


@pytest.fixture
async def recorder(
    hass: HomeAssistant,
    monkeypatch: pytest.MonkeyPatch,
    freezer: FrozenDateTimeFactory,
) -> tuple[list[tuple[Any, ...]], Rows, Rows]:
    """Fake the recorder: the calls, the 5-minute rows and the hourly rows."""
    await hass.config.async_set_time_zone(ZURICH)
    calls: list[tuple[Any, ...]] = []
    short: Rows = {}
    hourly: Rows = {}

    def fake(*args: Any) -> Rows:
        calls.append(args)
        data = short if args[4] == "5minute" else hourly
        return {stat: data[stat] for stat in args[3] if stat in data}

    monkeypatch.setattr(stats_probe, "statistics_during_period", fake)
    monkeypatch.setattr(stats_probe, "get_instance", FakeRecorder)
    # The window ends with the rows, so 5-minute rows from START cover it.
    freezer.move_to(START + timedelta(days=3))
    hass.config.components.add("recorder")
    return calls, short, hourly


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


async def test_probe_reads_five_minute_first(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """One 5-minute query for all, then one hourly query for the uncovered ones.

    Energy comes in kWh and power in W; the sparkline is hourly.
    """
    calls, short, hourly = recorder
    short["sensor.dtu_yield_day"] = energy_rows(five_minute(opendtu))
    short["sensor.dtu_power"] = power_rows(power_of(opendtu_power, FIVE))
    # Short-term rows that start late (short retention) and none at all.
    short["sensor.late"] = energy_rows(five_minute(opendtu)[-12:])
    hourly["sensor.late"] = energy_rows(
        [(when, 1000.0 + index) for index, (when, _) in enumerate(accumulate(ev, 0))],
        HOUR,
    )
    hourly["sensor.hourly_only"] = energy_rows(
        [(when, ev(when + timedelta(minutes=55))) for when, _ in accumulate(ev, 0)],
        HOUR,
    )
    stats = {
        "sensor.dtu_yield_day",
        "sensor.dtu_power",
        "sensor.late",
        "sensor.hourly_only",
        "sensor.nothing",
        "external:stat",
    }
    evidence = await async_probe(
        hass, stats, power_of={"sensor.dtu_yield_day": "sensor.dtu_power"}
    )
    assert evidence is not None
    assert len(calls) == 2
    _, start, end, ids, period, units, types = calls[0]
    assert period == "5minute"
    assert units == {"energy": "kWh", "power": "W"}
    assert types == {"state", "last_reset", "mean", "min"}
    assert end - start == timedelta(days=3)
    assert ids == {
        "sensor.dtu_yield_day",
        "sensor.dtu_power",
        "sensor.late",
        "sensor.hourly_only",
        "sensor.nothing",
    }
    assert calls[1][3:5] == (
        {"sensor.late", "sensor.hourly_only", "sensor.nothing"},
        "hour",
    )
    assert calls[1][5:] == calls[0][5:]

    dtu = evidence["sensor.dtu_yield_day"]
    assert (dtu.periodic, dtu.certain, dtu.reason) == (True, False, Reason.DROPS)
    assert len(dtu.drops) == 3
    assert not dtu.went_negative
    assert len(dtu.series) == 72
    # The hourly point is the last state of the hour.
    assert dtu.series[8] == (dt_util.as_local(START + timedelta(hours=8)), 0.4025)
    power = evidence["sensor.dtu_power"]
    assert (power.periodic, power.certain, power.reason) == (None, False, None)
    assert not power.went_negative
    assert power.series[8][1] == pytest.approx(210.0)
    assert evidence["sensor.late"].periodic is False
    assert evidence["sensor.late"].series[0][1] == 1000.0
    # Hourly states hide the EV's reset (14 -> 7).
    assert evidence["sensor.hourly_only"].periodic is False
    nothing = evidence["sensor.nothing"]
    assert (nothing.periodic, nothing.reason, nothing.series) == (
        None,
        Reason.NO_DATA,
        [],
    )
    assert evidence["external:stat"].reason == Reason.NO_DATA


async def test_probe_power_rows_not_longer_than_the_energy_rows(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """5-minute power adds up to hourly steps; hourly power is not split.

    - Hourly energy of a 2-hour export, 5-minute power: explained, not periodic
      (the shape alone takes the two export hours for resets).
    - 5-minute energy of a 3-hour bell, hourly power: the shape decides, not
      periodic. Booking the hour's power onto the 5-minute step at the full
      hour would take an export step near 0 for a reset.
    """
    _, short, hourly = recorder
    flat = net_rate("flat 2 h")
    hourly["sensor.flat"] = energy_rows(accumulate(flat, 1.2), HOUR)
    short["sensor.flat_power"] = power_rows(power_of(flat, FIVE))
    bell = net_rate("bell 3 h")
    short["sensor.bell"] = energy_rows(accumulate(bell, 0.6, FIVE))
    hourly["sensor.bell_power"] = power_rows(power_of(bell, HOUR))
    stats = {"sensor.flat", "sensor.bell"}
    assert (evidence := await async_probe(hass, stats)) is not None
    assert evidence["sensor.flat"].periodic is True
    powers = {"sensor.flat": "sensor.flat_power", "sensor.bell": "sensor.bell_power"}
    assert (evidence := await async_probe(hass, stats, power_of=powers)) is not None
    assert evidence["sensor.flat"].periodic is False
    assert evidence["sensor.bell"].periodic is False


async def test_probe_power_went_negative(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """A power whose minimum went below 0 once is signed; mean alone counts too."""
    _, short, _ = recorder
    rows = power_rows(power_of(lambda when: 0.3, FIVE))
    rows[100]["min"] = -12.0
    short["sensor.circuit_power"] = rows
    short["sensor.mean_only"] = [
        {"start": START.timestamp(), "end": START.timestamp() + 300, "mean": -5.0}
    ]
    evidence = await async_probe(hass, {"sensor.circuit_power", "sensor.mean_only"})
    assert evidence is not None
    assert evidence["sensor.circuit_power"].went_negative
    assert evidence["sensor.mean_only"].went_negative


async def test_probe_units_converted(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """Values are used in the units asked for: kWh and W.

    The recorder converts them (`units` of `statistics_during_period`, the
    same on 2026.10 and 2026.11, see `test_probe_units_with_the_recorder`).
    """
    calls, short, _ = recorder
    short["sensor.wh_meter"] = energy_rows(
        [(START + timedelta(minutes=5 * i), 0.001 * i) for i in range(864)]
    )
    evidence = await async_probe(hass, {"sensor.wh_meter"})
    assert evidence is not None
    assert calls[0][5] == {"energy": "kWh", "power": "W"}
    assert evidence["sensor.wh_meter"].series[-1][1] == pytest.approx(0.863)


async def test_last_reset_changed_certain(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """A `last_reset` that changes inside the window: periodic for certain.

    The midnight EV meter (Emporia, Tibber: `total` with `last_reset`).
    """
    _, short, _ = recorder

    def midnight(when: datetime) -> datetime:
        local = dt_util.as_local(when)
        return local.replace(hour=0, minute=0, second=0, microsecond=0)

    short["sensor.ev_today"] = energy_rows(five_minute(ev), last_reset=midnight)
    # The same meter without visible drops (a reset hidden in a gap).
    short["sensor.flat_today"] = energy_rows(
        five_minute(lambda when: 5.0), last_reset=midnight
    )
    evidence = await async_probe(hass, {"sensor.ev_today", "sensor.flat_today"})
    assert evidence is not None
    ev_today = evidence["sensor.ev_today"]
    assert (ev_today.periodic, ev_today.certain, ev_today.reason) == (
        True,
        True,
        Reason.LAST_RESET,
    )
    assert len(ev_today.drops) == 2
    flat = evidence["sensor.flat_today"]
    assert (flat.periodic, flat.certain, flat.reason) == (True, True, Reason.LAST_RESET)


async def test_last_reset_constant_not_certain(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """A `last_reset` that never changes says nothing: the shape decides."""
    _, short, _ = recorder
    since = START - timedelta(days=400)
    short["sensor.lifetime"] = energy_rows(
        [(when, 500 + 0.01 * index) for index, (when, _) in enumerate(five_minute(ev))],
        last_reset=lambda when: since,
    )
    short["sensor.daily"] = energy_rows(
        five_minute(opendtu), last_reset=lambda when: since
    )
    evidence = await async_probe(hass, {"sensor.lifetime", "sensor.daily"})
    assert evidence is not None
    lifetime = evidence["sensor.lifetime"]
    assert (lifetime.periodic, lifetime.certain, lifetime.reason) == (
        False,
        False,
        None,
    )
    daily = evidence["sensor.daily"]
    assert (daily.periodic, daily.certain, daily.reason) == (True, False, Reason.DROPS)


async def test_periodic_weekly_utility_meter_certain(
    hass: HomeAssistant, recorder: tuple[list[tuple[Any, ...]], Rows, Rows]
) -> None:
    """A utility meter with any cycle but `none` is periodic for certain."""
    _, short, _ = recorder
    _utility_meter(hass, "sensor.weekly", "weekly")
    _utility_meter(hass, "sensor.lifetime_meter", "none")
    short["sensor.weekly"] = energy_rows(five_minute(lambda when: 3.0))
    evidence = await async_probe(
        hass, {"sensor.weekly", "sensor.lifetime_meter", "sensor.monthly"}
    )
    assert evidence is not None
    weekly = evidence["sensor.weekly"]
    assert (weekly.periodic, weekly.certain, weekly.reason) == (
        True,
        True,
        Reason.UTILITY_METER,
    )
    assert len(weekly.series) == 72
    assert evidence["sensor.lifetime_meter"].periodic is None
    _utility_meter(hass, "sensor.monthly", "monthly")
    hass.config.components.remove("recorder")
    evidence = await async_probe(hass, {"sensor.monthly", "sensor.other"})
    assert evidence is not None
    assert evidence["sensor.monthly"].certain
    assert evidence["sensor.monthly"].periodic
    assert evidence["sensor.other"].reason == Reason.NO_DATA


async def test_probe_recorder_failure_returns_none(
    hass: HomeAssistant,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A failing or slow recorder: None (unknown), never a guess.

    Not with the frozen clock of `recorder`: the timeout needs time to pass.
    """

    def fail(*args: Any) -> Rows:
        raise RuntimeError("database is locked")

    monkeypatch.setattr(stats_probe, "statistics_during_period", fail)
    monkeypatch.setattr(stats_probe, "get_instance", FakeRecorder)
    hass.config.components.add("recorder")
    with caplog.at_level("DEBUG", logger=stats_probe.__name__):
        assert await async_probe(hass, {"sensor.kitchen"}) is None
    assert "database is locked" in caplog.text

    class SlowRecorder(FakeRecorder):
        async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
            await asyncio.sleep(1)

    monkeypatch.setattr(stats_probe, "get_instance", SlowRecorder)
    monkeypatch.setattr(stats_probe, "QUERY_TIMEOUT", 0.01)
    assert await async_probe(hass, {"sensor.kitchen"}) is None
    # Nothing to read: nothing can fail.
    assert await async_probe(hass, {"portal:x"}) == {
        "portal:x": StatsEvidence(
            periodic=None,
            certain=False,
            reason=Reason.NO_DATA,
            drops=[],
            went_negative=False,
            series=[],
        )
    }


def test_evidence_as_dict() -> None:
    """The WebSocket form: ISO times, drops as objects, series as pairs."""
    when = dt_util.as_local(START)
    evidence = StatsEvidence(
        periodic=True,
        certain=False,
        reason=Reason.DROPS,
        drops=[(when, 2.1, 0.0)],
        went_negative=False,
        series=[(when, 2.1)],
    )
    assert evidence.as_dict() == {
        "periodic": True,
        "certain": False,
        "reason": "drops",
        "drops": [{"at": when.isoformat(), "before": 2.1, "after": 0.0}],
        "went_negative": False,
        "series": [[when.isoformat(), 2.1]],
    }
