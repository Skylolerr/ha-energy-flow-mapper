"""Energy per statistic in a period, read from the recorder's statistics."""

from __future__ import annotations

from collections.abc import Collection, Mapping, Sequence
from datetime import datetime, timedelta
from functools import partial
from typing import Final, Literal

from homeassistant.components.recorder.statistics import (
    get_last_statistics,
    statistics_during_period,
)
from homeassistant.const import UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.recorder import get_instance
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_system import US_CUSTOMARY_SYSTEM

type Resolution = Literal["5minute", "hour", "day"]

# Period key -> (days before today, statistics resolution). Today uses the
# 5-minute statistics so the value is at most a few minutes old; longer
# periods use hourly and daily statistics (up to the last full hour).
PERIODS: Final[dict[str, tuple[int, Resolution]]] = {
    "today": (0, "5minute"),
    "week": (6, "hour"),
    "month": (29, "day"),
}

# A statistic whose data ends longer before the end of a period than this is
# too late to compare with up-to-date sensors (for example a utility portal).
RECENT_LAG: Final = timedelta(hours=2)


def water_unit(hass: HomeAssistant) -> str:
    """Return the unit water is shown in: gallons for US units, else litres."""
    if hass.config.units is US_CUSTOMARY_SYSTEM:
        return UnitOfVolume.GALLONS.value
    return UnitOfVolume.LITERS.value


def period_range(period: str, now: datetime) -> tuple[datetime, datetime]:
    """Return start (local midnight) and end (now) of a period."""
    days, _ = PERIODS[period]
    start = dt_util.start_of_local_day(now) - timedelta(days=days)
    return start, now


async def async_energy(
    hass: HomeAssistant,
    stats: Collection[str],
    period: str,
    now: datetime,
) -> dict[str, float | None]:
    """Return the energy in kWh (water in `water_unit`) of each statistic.

    A statistic without data in the period maps to None. Without a recorder
    every value is None.
    """
    if not stats or "recorder" not in hass.config.components:
        return dict.fromkeys(stats)
    start, end = period_range(period, now)
    _, resolution = PERIODS[period]
    rows = await get_instance(hass).async_add_executor_job(
        statistics_during_period,
        hass,
        start,
        end,
        set(stats),
        resolution,
        {"energy": "kWh", "volume": water_unit(hass)},
        {"change"},
    )
    result: dict[str, float | None] = {}
    for stat in stats:
        changes = [
            change
            for row in rows.get(stat, [])
            if (change := row.get("change")) is not None
        ]
        result[stat] = round(sum(changes), 6) if changes else None
    return result


async def async_last_ends(
    hass: HomeAssistant, stats: Collection[str]
) -> dict[str, datetime | None]:
    """Return the end of each statistic's last hourly statistic.

    None for a statistic without data, and for all without a recorder.
    """
    if "recorder" not in hass.config.components:
        return dict.fromkeys(stats)
    result: dict[str, datetime | None] = {}
    for stat in stats:
        rows = await get_instance(hass).async_add_executor_job(
            partial(get_last_statistics, convert_units=True, types={"sum"}),
            hass,
            1,
            stat,
        )
        last = rows.get(stat)
        result[stat] = (
            dt_util.utc_from_timestamp(last[0]["start"]) + timedelta(hours=1)
            if last
            else None
        )
    return result


def stale_stat(
    stats: Sequence[str], ends: Mapping[str, datetime | None], end: datetime
) -> str | None:
    """Return the first statistic whose data ends too long before `end`."""
    for stat in stats:
        last = ends.get(stat)
        if last is None or last < end - RECENT_LAG:
            return stat
    return None
