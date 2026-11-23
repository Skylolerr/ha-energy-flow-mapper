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
from datetime import date, datetime, timedelta
from itertools import pairwise
from typing import Final

from homeassistant.components.recorder.statistics import statistics_during_period
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.recorder import get_instance
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

# Longest wait for the recorder; a busy recorder must not keep the panel
# waiting, the flag is extra information.
QUERY_TIMEOUT: Final = 10

# A value below this share of the hour before is a reset. A meter that only
# grows never falls; the hourly state after a reset can already hold a large
# part of a day (a night boiler, an EV), so the share is not near 0.
FALL_SHARE: Final = 0.5
# Days with a reset needed: one reset alone is a replaced meter.
MIN_RESET_DAYS: Final = 2
UTILITY_METER_DOMAIN: Final = "utility_meter"
# Option key and value of a utility meter's daily cycle (HA 2026.10 and 2026.11).
CYCLE: Final = "cycle"
DAILY: Final = "daily"


def resets_daily(states: Sequence[tuple[datetime, float]]) -> bool:
    """Return True if the value falls back on at least two days.

    `states` are (start, state) pairs in time order, with local times. A
    reset is a state below half of the state the hour before; it counts once
    per day, at any time of day. A meter that goes below 0 in `states` (a net
    meter) is never daily.
    """
    if any(value < 0 for _, value in states):
        return False
    reset_days: set[date] = set()
    for (_, before), (when, value) in pairwise(states):
        if value < FALL_SHARE * before:
            reset_days.add(when.date())
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


async def async_daily_resetting(
    hass: HomeAssistant, stats: Collection[str], days: int = 3
) -> set[str]:
    """Return the statistics that reset every day.

    Reads the hourly states of the last `days` days of all statistics in one
    query. External statistics and meters without data are not daily; a
    utility meter with a daily cycle is daily without statistics. When the
    recorder fails or is too slow, only the utility meters are known.
    """
    daily = {stat for stat in stats if _daily_utility_meter(hass, stat)}
    ids = {stat for stat in stats if valid_entity_id(stat) and stat not in daily}
    if not ids or "recorder" not in hass.config.components:
        return daily
    end = dt_util.utcnow()
    try:
        # The timeout only stops waiting; the recorder still finishes the job
        # in its executor.
        async with asyncio.timeout(QUERY_TIMEOUT):
            rows = await get_instance(hass).async_add_executor_job(
                statistics_during_period,
                hass,
                end - timedelta(days=days),
                end,
                ids,
                "hour",
                None,
                {"state"},
            )
    except Exception:
        # Usually the recorder is busy or not ready yet after a restart.
        _LOGGER.debug("Reading the hourly statistics failed", exc_info=True)
        return daily
    for stat in ids:
        states = [
            (dt_util.as_local(dt_util.utc_from_timestamp(row["start"])), state)
            for row in rows.get(stat, [])
            if (state := row.get("state")) is not None
        ]
        if resets_daily(states):
            daily.add(stat)
    return daily
