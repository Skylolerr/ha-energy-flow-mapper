"""Recognise meters that reset every day.

A sum of meters where one member falls back to 0 every day jumps down once a
day; Home Assistant reads that as a meter reset and counts the whole value
again. Such meters are recognised from their hourly statistics, at any time
of day (some inverters reset when they wake up in the morning, not at
midnight), and from utility meters with a daily cycle.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Collection, Sequence
from datetime import datetime, timedelta
from itertools import pairwise
from typing import Any, Final

from homeassistant.components.recorder.statistics import statistics_during_period
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.recorder import get_instance
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

# Longest wait for the recorder; a busy recorder must not keep the panel
# waiting, the flag is extra information.
QUERY_TIMEOUT: Final = 10

# A value closer to 0 than this share of the hour before is a reset. A meter
# that only grows never falls; the hourly state after a reset can already hold
# a large part of a day (a night boiler, an EV), so the share is not near 0.
FALL_SHARE: Final = 0.5
# A reset is also a jump: larger than this many times the meter's usual
# change in an hour (USUAL_SHARE of the other hours change by as much or
# less). A net meter that passes 0 at its usual pace, even with a steep
# solar export, comes close to 0 too, but without a jump.
JUMP_FACTOR: Final = 2
USUAL_SHARE: Final = 0.9
# Days with a reset needed: one reset alone is a replaced meter.
MIN_RESET_DAYS: Final = 2
UTILITY_METER_DOMAIN: Final = "utility_meter"
# Option key and value of a utility meter's daily cycle (HA 2026.10 and 2026.11).
CYCLE: Final = "cycle"
DAILY: Final = "daily"


def resets_daily(states: Sequence[tuple[datetime, float]]) -> bool:
    """Return True if the value falls back on at least two days.

    `states` are (start, state) pairs in time order, with local times. A
    reset is a jump towards 0: the state is less than half as far from 0 as
    the hour before (a fall), and it changed by more than `JUMP_FACTOR` times
    the usual change of the hours that are no fall (the `USUAL_SHARE`
    percentile, so a few long charging hours do not count as usual). It
    counts once per day, at any time of day. A per-day net meter falls back
    to 0 from either side; a lifetime net meter that passes 0 at its usual
    pace does not jump.
    """
    falls: list[tuple[datetime, float]] = []
    changes: list[float] = []
    for (_, before), (when, value) in pairwise(states):
        if abs(value) < FALL_SHARE * abs(before):
            falls.append((when, abs(value - before)))
        else:
            changes.append(abs(value - before))
    changes.sort()
    usual = changes[int(len(changes) * USUAL_SHARE)] if changes else 0.0
    reset_days = {when.date() for when, jump in falls if jump > JUMP_FACTOR * usual}
    return len(reset_days) >= MIN_RESET_DAYS


def _daily_utility_meter(hass: HomeAssistant, stat: str) -> bool:
    """Return True for a utility meter entity whose cycle is daily."""
    entry = er.async_get(hass).async_get(stat)
    if entry is None or entry.config_entry_id is None:
        return False
    config_entry = hass.config_entries.async_get_entry(entry.config_entry_id)
    return (
        config_entry is not None
        and config_entry.domain == UTILITY_METER_DOMAIN
        and config_entry.options.get(CYCLE) == DAILY
    )


async def async_hourly_statistics(
    hass: HomeAssistant, ids: set[str], days: int, types: set[str]
) -> dict[str, list[Any]] | None:
    """Return the hourly statistics `types` of the last `days` days of `ids`.

    One query for all of them, in the recorder's executor. None when there is
    no recorder, or it fails or is too slow: what needs the statistics is
    extra information and must not keep the panel waiting.
    """
    if "recorder" not in hass.config.components:
        return None
    end = dt_util.utcnow()
    try:
        # The timeout only stops waiting; the recorder still finishes the job
        # in its executor.
        async with asyncio.timeout(QUERY_TIMEOUT):
            rows: dict[str, list[Any]] = await get_instance(
                hass
            ).async_add_executor_job(
                statistics_during_period,
                hass,
                end - timedelta(days=days),
                end,
                ids,
                "hour",
                None,
                types,
            )
    except Exception:
        # Usually the recorder is busy or not ready yet after a restart.
        _LOGGER.debug("Reading the hourly statistics failed", exc_info=True)
        return None
    return rows


async def async_daily_resetting(
    hass: HomeAssistant, stats: Collection[str], days: int = 3
) -> set[str]:
    """Return the statistics that reset every day, as far as known.

    Like `async_daily_check`, but when the recorder fails or is too slow only
    the utility meters are known: the flags are extra information and must
    not stop the panel.
    """
    daily = await async_daily_check(hass, stats, days)
    if daily is None:
        return {stat for stat in stats if _daily_utility_meter(hass, stat)}
    return daily


async def async_daily_check(
    hass: HomeAssistant, stats: Collection[str], days: int = 3
) -> set[str] | None:
    """Return the statistics that reset every day, or None if unknown.

    Reads the hourly states of the last `days` days of all statistics in one
    query. External statistics and meters without data are not daily; a
    utility meter with a daily cycle is daily without statistics. Without a
    recorder there are no statistics, so only the utility meters are daily.
    None when the recorder fails or is too slow: the setup must not build on
    a check that did not run.
    """
    daily = {stat for stat in stats if _daily_utility_meter(hass, stat)}
    ids = {stat for stat in stats if valid_entity_id(stat) and stat not in daily}
    if not ids or "recorder" not in hass.config.components:
        return daily
    if (rows := await async_hourly_statistics(hass, ids, days, {"state"})) is None:
        return None
    for stat in ids:
        states = [
            (dt_util.as_local(dt_util.utc_from_timestamp(row["start"])), state)
            for row in rows.get(stat, [])
            if (state := row.get("state")) is not None
        ]
        if resets_daily(states):
            daily.add(stat)
    return daily
