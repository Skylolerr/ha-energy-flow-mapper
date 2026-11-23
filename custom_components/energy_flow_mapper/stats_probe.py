"""Read what the statistics say about energy and power sensors.

- **Periodic counters:** a meter that falls back to 0 every day (or week, or
  month) breaks a sum or a gross meter; Home Assistant counts its value again
  after each reset. Certain signals are a utility meter with a cycle and a
  `last_reset` that changed in the window. Otherwise the shape of the states
  gives a preselection (`periodic_from_series`).
- **Power sign:** a power whose statistics went below 0 is signed
  (`sign_evidence`).
- **Sparkline:** the hourly states of the last days, with the drops found.

The statistics are read 5-minute first (sharper drops), hourly where the
5-minute rows do not cover the window, in kWh and W.
"""

from __future__ import annotations

import asyncio
import logging
from bisect import bisect_left
from collections.abc import Collection, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from itertools import pairwise
from typing import Any, Final

from homeassistant.components.recorder.statistics import statistics_during_period
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.recorder import get_instance
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

# Longest wait for the recorder, for all queries of one request together.
QUERY_TIMEOUT: Final = 10

# A fall is a step to less than half the distance from 0 of the state before.
FALL_SHARE: Final = 0.5
# Without power, a fall is a reset when it is larger than JUMP_FACTOR times the
# USUAL_SHARE percentile of the other steps in the same direction (falls with
# falls, rises with rises) ...
JUMP_FACTOR: Final = 2
USUAL_SHARE: Final = 0.9
# ... by more than this share, so float and rounding noise (a meter with 3
# decimals) cannot decide a fall that is exactly twice the usual one.
JUMP_TOLERANCE: Final = 0.01
# With power, a fall is explained (no reset) when the power's energy over the
# step has the fall's direction and is within this share of its size.
POWER_MATCH: Final = 0.3
# Days with a reset needed: one reset alone is a replaced meter or a glitch.
MIN_RESET_DAYS: Final = 2

SHORT_TERM: Final = "5minute"
HOURLY: Final = "hour"
UNITS: Final = {"energy": "kWh", "power": "W"}
# Energy statistics have `state`/`last_reset`, power ones `mean`/`min`; the
# recorder drops the columns a statistic cannot have.
TYPES: Final = {"state", "last_reset", "mean", "min"}
# 5-minute rows that start later than this after the window's start do not
# cover it (the recorder keeps them for `purge_keep_days` only).
COVER_SLACK: Final = timedelta(hours=1)
PERIODS: Final = {SHORT_TERM: timedelta(minutes=5), HOURLY: timedelta(hours=1)}

UTILITY_METER_DOMAIN: Final = "utility_meter"
CYCLE: Final = "cycle"
NO_CYCLE: Final = "none"

type Point = tuple[datetime, float]
type Drop = tuple[datetime, float, float]
# (start, end, mean W) of a power statistics row.
type PowerRow = tuple[datetime, datetime, float]
type Rows = dict[str, list[Any]]


class Reason(StrEnum):
    """Why a statistic is (or is not known to be) periodic."""

    UTILITY_METER = "utility_meter"
    LAST_RESET = "last_reset"
    DROPS = "drops"
    NO_DATA = "no_data"


@dataclass
class StatsEvidence:
    """What the statistics of one sensor show.

    `periodic` is None when unknown (no data, or a power sensor). `certain`
    for a utility meter with a cycle or a changing `last_reset`; otherwise
    `periodic` is a preselection. `drops` are the resets found (time, before,
    after), also when there are too few for `periodic`. `went_negative`: the
    states (energy) or the minimum (power) went below 0. `series` are hourly
    points: the last state of each hour, or the mean power.
    """

    periodic: bool | None
    certain: bool
    reason: str | None
    drops: list[Drop]
    went_negative: bool
    series: list[Point]

    def as_dict(self) -> dict[str, Any]:
        """Return the WebSocket form, with ISO times."""
        return {
            "periodic": self.periodic,
            "certain": self.certain,
            "reason": self.reason,
            "drops": [
                {"at": when.isoformat(), "before": before, "after": after}
                for when, before, after in self.drops
            ],
            "went_negative": self.went_negative,
            "series": [[when.isoformat(), value] for when, value in self.series],
        }


def _usual(changes: list[float]) -> float:
    """Return the USUAL_SHARE percentile of `changes` (0 without any)."""
    changes.sort()
    return changes[int(len(changes) * USUAL_SHARE)] if changes else 0.0


class _PowerEnergy:
    """The energy of power rows over a time window, in kWh.

    Times are UTC timestamps: local times are ambiguous on the night the
    clocks go back.
    """

    def __init__(self, power: Sequence[PowerRow]) -> None:
        """Sort the rows by start and add up their energy."""
        rows = sorted(
            (start.timestamp(), (end - start).total_seconds() * mean / 3_600_000)
            for start, end, mean in power
        )
        self.starts = [start for start, _ in rows]
        self.sums = [0.0]
        for _, energy in rows:
            self.sums.append(self.sums[-1] + energy)

    def __call__(self, after: float, until: float) -> float | None:
        """Return the kWh of the rows that start in [after, until), or None."""
        first = bisect_left(self.starts, after)
        last = bisect_left(self.starts, until)
        return self.sums[last] - self.sums[first] if last > first else None


def _trusted(
    steps: Sequence[tuple[float, float, float, float, bool]],
    power: _PowerEnergy,
    length: float,
) -> dict[bool, bool]:
    """Return per direction (rising) whether the power agrees with the meter.

    On the meter's steps that are no falls, the power's energy must mostly
    have the step's sign. An unsigned or reversed power disagrees on the steps
    of one direction (an unsigned one while exporting); its falls in that
    direction are then left to the shape rule. Without such steps (a daily
    meter that only grows) there is nothing against the power.
    """
    votes = {False: 0, True: 0}
    for before_ts, ts, before, value, fall in steps:
        if fall or value == before:
            continue
        energy = power(before_ts + length, ts + length)
        if energy:
            change = value - before
            votes[change > 0] += 1 if energy * change > 0 else -1
    return {rising: votes[rising] >= 0 for rising in (False, True)}


def periodic_from_series(
    series: Sequence[Point], power: Sequence[PowerRow] | None = None
) -> tuple[bool, list[Drop]]:
    """Return whether a meter resets on two days or more, and its resets.

    `series` are (start, state) pairs in time order (aware times): the state
    at the end of each statistics row. The rows' length is the shortest step
    between them. A step is a fall when the state lands less than half as far
    from 0 as before (either side of 0). The usual step of a direction is the
    `USUAL_SHARE` percentile of the other steps that are no falls (falls with
    falls, rises with rises).

    - Without power rows for the step: a fall is a reset when it is larger
      than `JUMP_FACTOR` times the usual step in its direction, with a
      `JUMP_TOLERANCE` margin.
    - With the meter's own power (`power`, rows of (start, end, mean W)): a
      fall is a reset unless the power's energy over the step (the rows from
      the end of the row before to the end of the row, or that widened by one
      row back or forward) has the fall's sign and is within `POWER_MATCH` of
      it. A fall no larger than the shape rule's margin only needs the sign
      (a meter's resolution and update lag matter near 0), so the power is
      never weaker than the shape rule. A net
      meter exporting near 0 falls with its power; a reset falls while the
      power is 0 or positive. A power that disagrees with the meter's other
      steps of that direction (unsigned, reversed) is not used for them.

    Times are compared in UTC; resets count once per local day, at any time of
    day.
    """
    steps = [
        (
            before_when.timestamp(),
            when.timestamp(),
            before,
            value,
            abs(value) < FALL_SHARE * abs(before),
        )
        for (before_when, before), (when, value) in pairwise(series)
    ]
    usual = {
        rising: _usual(
            [
                abs(value - before)
                for _, _, before, value, fall in steps
                if not fall and value != before and (value > before) == rising
            ]
        )
        for rising in (False, True)
    }
    length = min((ts - before_ts for before_ts, ts, *_ in steps), default=0.0)
    energy_of = _PowerEnergy(power) if power is not None else None
    trusted = (
        _trusted(steps, energy_of, length)
        if energy_of is not None
        else {False: False, True: False}
    )
    drops: list[Drop] = []
    for (before_ts, ts, before, value, fall), (when, _) in zip(
        steps, series[1:], strict=True
    ):
        if not fall:
            continue
        change = value - before
        margin = JUMP_FACTOR * usual[change > 0] * (1 + JUMP_TOLERANCE)
        start, end = before_ts + length, ts + length
        energy = (
            energy_of(start, end)
            if energy_of is not None and trusted[change > 0]
            else None
        )
        if energy_of is None or energy is None:
            reset = abs(change) > margin
        else:
            # A meter reports a little late or early: the step, or the step
            # widened by one row back or forward, may explain the fall. The
            # shape rule's margin only lets through falls it would not take
            # for a reset anyway (resolution near 0): power of the fall's
            # sign never hides a fall larger than the margin.
            small = abs(change) <= margin
            reset = not any(
                found is not None
                and found * change > 0
                and (small or abs(found - change) <= POWER_MATCH * abs(change))
                for found in (
                    energy,
                    energy_of(start - length, end),
                    energy_of(start, end + length),
                )
            )
        if reset:
            drops.append((when, before, value))
    return len({when.date() for when, _, _ in drops}) >= MIN_RESET_DAYS, drops


def sign_evidence(power_series: Iterable[Point]) -> bool:
    """Return True when a power went below 0: it has a sign.

    A power that never went below 0 says nothing: the circuit may never have
    fed in, or its sensor is unsigned.
    """
    return any(value < 0 for _, value in power_series)


def utility_meter_cycle(hass: HomeAssistant, stat: str) -> str | None:
    """Return the cycle of a utility meter helper, or None for other sensors."""
    entry = er.async_get(hass).async_get(stat)
    if entry is None or entry.config_entry_id is None:
        return None
    config_entry = hass.config_entries.async_get_entry(entry.config_entry_id)
    if config_entry is None or config_entry.domain != UTILITY_METER_DOMAIN:
        return None
    cycle = config_entry.options.get(CYCLE)
    return cycle if isinstance(cycle, str) else None


def periodic_utility_meter(hass: HomeAssistant, stat: str) -> bool:
    """Return True for a utility meter that resets (any cycle but `none`)."""
    return utility_meter_cycle(hass, stat) not in (None, NO_CYCLE)


async def _async_query(
    hass: HomeAssistant,
    ids: set[str],
    window: tuple[datetime, datetime],
    period: str,
    types: set[str],
) -> Rows:
    """Read `types` of `ids` in the recorder's executor; energy and power in UNITS.

    Other units (gas, water) come in their statistics unit.
    """
    rows: Rows = await get_instance(hass).async_add_executor_job(
        statistics_during_period, hass, *window, ids, period, UNITS, types
    )
    return rows


async def async_statistics(
    hass: HomeAssistant, ids: set[str], days: int, period: str, types: set[str]
) -> Rows | None:
    """Return the statistics `types` of the last `days` days of `ids`.

    One query, in the recorder's executor. None when there is no recorder,
    or it fails or is too slow.
    """
    if "recorder" not in hass.config.components:
        return None
    end = dt_util.utcnow()
    try:
        # The timeout only stops waiting; the recorder still finishes the job.
        async with asyncio.timeout(QUERY_TIMEOUT):
            return await _async_query(
                hass, ids, (end - timedelta(days=days), end), period, types
            )
    except Exception:
        # Usually the recorder is busy or not ready yet after a restart.
        _LOGGER.debug("Reading the statistics failed", exc_info=True)
        return None


async def _async_read(
    hass: HomeAssistant, ids: set[str], days: int
) -> dict[str, tuple[list[Any], timedelta]] | None:
    """Return the rows of `ids` and their period: 5-minute, else hourly.

    Hourly is read (one query) for the statistics whose 5-minute rows are
    missing or start late. None when the recorder fails or is too slow; the
    timeout covers both queries.
    """
    end = dt_util.utcnow()
    start = end - timedelta(days=days)
    covered = (start + COVER_SLACK).timestamp()
    try:
        async with asyncio.timeout(QUERY_TIMEOUT):
            short = await _async_query(hass, ids, (start, end), SHORT_TERM, TYPES)
            result = {
                stat: (rows, PERIODS[SHORT_TERM])
                for stat, rows in short.items()
                if rows
            }
            if late := {
                stat
                for stat in ids
                if stat not in result or result[stat][0][0]["start"] > covered
            }:
                hourly = await _async_query(hass, late, (start, end), HOURLY, TYPES)
                result |= {
                    stat: (rows, PERIODS[HOURLY])
                    for stat, rows in hourly.items()
                    if rows
                }
    except Exception:
        _LOGGER.debug("Reading the statistics failed", exc_info=True)
        return None
    return result


def _local(timestamp: float) -> datetime:
    return dt_util.as_local(dt_util.utc_from_timestamp(timestamp))


def _hourly(points: list[Point], *, last: bool) -> list[Point]:
    """Return one point per hour: the last value, or the mean.

    Hours are UTC hours shown in local time, so the two 02:00 hours of the
    night the clocks go back stay apart.
    """
    hours: dict[float, list[float]] = {}
    for when, value in points:
        hours.setdefault(when.timestamp() // 3600 * 3600, []).append(value)
    return [
        (_local(hour), values[-1] if last else sum(values) / len(values))
        for hour, values in hours.items()
    ]


def _power_rows(rows: list[Any]) -> list[PowerRow]:
    """Return (start, end, mean W) of the rows with a mean."""
    return [
        (_local(row["start"]), _local(row["end"]), mean)
        for row in rows
        if (mean := row.get("mean")) is not None
    ]


def _evidence(
    stat: str,
    read: Mapping[str, tuple[list[Any], timedelta]],
    power: str | None,
    *,
    utility_meter: bool,
) -> StatsEvidence:
    """Return the evidence of `stat` from the rows read."""
    rows, period = read.get(stat, ([], PERIODS[SHORT_TERM]))
    states = [
        (_local(row["start"]), state)
        for row in rows
        if (state := row.get("state")) is not None
    ]
    if states:
        # The power explains a step only with rows as short as the energy's: an
        # hourly power cannot be split onto 5-minute steps (5-minute power
        # adds up to hourly steps).
        power_rows = (
            _power_rows(read[power][0])
            if power is not None and power in read and read[power][1] <= period
            else None
        )
        periodic, drops = periodic_from_series(states, power_rows)
        resets = {
            last_reset
            for row in rows
            if (last_reset := row.get("last_reset")) is not None
        }
        reason: str | None = None
        if utility_meter:
            reason = Reason.UTILITY_METER
        elif len(resets) > 1:
            reason = Reason.LAST_RESET
        elif periodic:
            reason = Reason.DROPS
        certain = reason in (Reason.UTILITY_METER, Reason.LAST_RESET)
        return StatsEvidence(
            periodic=periodic or certain,
            certain=certain,
            reason=reason,
            drops=drops,
            went_negative=any(value < 0 for _, value in states),
            series=_hourly(states, last=True),
        )
    if means := [row for row in rows if row.get("mean") is not None]:
        lows = [
            (
                _local(row["start"]),
                row["mean"] if row.get("min") is None else row["min"],
            )
            for row in means
        ]
        return StatsEvidence(
            periodic=None,
            certain=False,
            reason=None,
            drops=[],
            went_negative=sign_evidence(lows),
            series=_hourly(
                [(_local(row["start"]), row["mean"]) for row in means], last=False
            ),
        )
    return StatsEvidence(
        periodic=True if utility_meter else None,
        certain=utility_meter,
        reason=Reason.UTILITY_METER if utility_meter else Reason.NO_DATA,
        drops=[],
        went_negative=False,
        series=[],
    )


async def async_probe(
    hass: HomeAssistant,
    stats: Collection[str],
    days: int = 3,
    power_of: Mapping[str, str] | None = None,
) -> dict[str, StatsEvidence] | None:
    """Return the evidence of each statistic in `stats`.

    `power_of` maps an energy statistic to its own power sensor, read with it
    to explain its falls. External statistics and sensors without data have
    no evidence (`Reason.NO_DATA`); without a recorder only the utility
    meters are known. None when the recorder fails or is too slow: the
    caller must not build on a check that did not run.
    """
    powers = {
        stat: power
        for stat, power in (power_of or {}).items()
        if stat in stats and valid_entity_id(power)
    }
    ids = {stat for stat in stats if valid_entity_id(stat)} | set(powers.values())
    read: dict[str, tuple[list[Any], timedelta]] = {}
    if ids and "recorder" in hass.config.components:
        if (found := await _async_read(hass, ids, days)) is None:
            return None
        read = found
    return {
        stat: _evidence(
            stat,
            read,
            powers.get(stat),
            utility_meter=periodic_utility_meter(hass, stat),
        )
        for stat in stats
    }
