"""Energy per statistic in a period, read from the recorder's statistics."""

from __future__ import annotations

from collections.abc import Collection
from datetime import datetime, timedelta
from typing import Final, Literal

from homeassistant.components.recorder.statistics import statistics_during_period
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
