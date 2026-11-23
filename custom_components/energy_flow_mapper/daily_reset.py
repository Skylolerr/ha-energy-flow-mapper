"""Recognise meters that reset every day (or week, or month).

A sum of meters where one member falls back to 0 every day jumps down once a
day; Home Assistant reads that as a meter reset and counts the whole value
again. Such meters are recognised from their statistics, at any time of day
(some inverters reset when they wake up in the morning, not at midnight),
and from utility meters with a cycle. The rule is the one of `stats_probe`,
so `get`, the hints and the setup agree.
"""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant, valid_entity_id

from .stats_probe import (
    HOURLY,
    async_probe,
    async_statistics,
    periodic_from_series,
    periodic_utility_meter,
)


def resets_daily(states: Sequence[tuple[datetime, float]]) -> bool:
    """Return True if the value falls back on at least two days.

    `states` are (start, state) pairs in time order, with local times; see
    `stats_probe.periodic_from_series` for the rule (without power).
    """
    return periodic_from_series(states)[0]


async def async_hourly_statistics(
    hass: HomeAssistant, ids: set[str], days: int, types: set[str]
) -> dict[str, list[Any]] | None:
    """Return the hourly statistics `types` of the last `days` days of `ids`.

    One query for all of them, in the recorder's executor. None when there is
    no recorder, or it fails or is too slow: what needs the statistics is
    extra information and must not keep the panel waiting.
    """
    return await async_statistics(hass, ids, days, HOURLY, types)


async def async_daily_resetting(
    hass: HomeAssistant,
    stats: Collection[str],
    days: int = 3,
    power_of: Mapping[str, str] | None = None,
) -> set[str]:
    """Return the statistics that reset periodically, as far as known.

    Like `async_daily_check`, but when the recorder fails or is too slow only
    the utility meters are known: the flags are extra information and must
    not stop the panel.
    """
    daily = await async_daily_check(hass, stats, days, power_of)
    if daily is None:
        return {stat for stat in stats if periodic_utility_meter(hass, stat)}
    return daily


async def async_daily_check(
    hass: HomeAssistant,
    stats: Collection[str],
    days: int = 3,
    power_of: Mapping[str, str] | None = None,
) -> set[str] | None:
    """Return the statistics that reset periodically, or None if unknown.

    Reads the states of the last `days` days of all statistics at once
    (5-minute, hourly where needed), with the power sensors in `power_of`
    (energy statistic -> its power) that explain falls. External statistics
    and meters without data are not periodic; a utility meter with a cycle is
    periodic without statistics. Without a recorder there are no statistics,
    so only the utility meters are periodic. None when the recorder fails or
    is too slow: the setup must not build on a check that did not run.
    """
    daily = {stat for stat in stats if periodic_utility_meter(hass, stat)}
    ids = {stat for stat in stats if valid_entity_id(stat) and stat not in daily}
    if not ids:
        return daily
    if (evidence := await async_probe(hass, ids, days, power_of)) is None:
        return None
    return daily | {stat for stat, found in evidence.items() if found.periodic}
