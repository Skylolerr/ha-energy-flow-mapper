"""Tests for energy per period from the recorder statistics."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_system import US_CUSTOMARY_SYSTEM

from custom_components.energy_flow_mapper import energy_stats
from custom_components.energy_flow_mapper.energy_stats import (
    async_energy,
    period_range,
    water_unit,
)

ZURICH = "Europe/Zurich"


class FakeRecorder:
    """Run executor jobs like the recorder does."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance like get_instance would return it."""
        self.hass = hass

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        """Run the job directly."""
        return func(*args)


@pytest.fixture
def statistics(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> list[tuple[Any, ...]]:
    """Fake the recorder; return the calls made to it."""
    calls: list[tuple[Any, ...]] = []

    def fake(*args: Any) -> dict[str, list[dict[str, Any]]]:
        calls.append(args)
        return {
            "sensor.a": [{"change": 0.5}, {"change": 0.25}, {"change": None}],
            "sensor.b": [{"change": None}],
            "portal:x": [{"change": 2}],
        }

    monkeypatch.setattr(energy_stats, "statistics_during_period", fake)
    monkeypatch.setattr(energy_stats, "get_instance", FakeRecorder)
    hass.config.components.add("recorder")
    return calls


async def test_period_range(hass: HomeAssistant) -> None:
    """Periods start at local midnight and include today."""
    await hass.config.async_set_time_zone(ZURICH)
    now = dt_util.as_local(datetime.fromisoformat("2026-10-23T15:30:00+02:00"))
    start, end = period_range("today", now)
    assert start.isoformat() == "2026-10-23T00:00:00+02:00"
    assert end == now
    assert period_range("week", now)[0].isoformat() == "2026-10-17T00:00:00+02:00"
    # Across the switch to winter time on 25 October.
    later = dt_util.as_local(datetime.fromisoformat("2026-10-26T10:00:00+01:00"))
    assert period_range("week", later)[0].isoformat() == "2026-10-20T00:00:00+02:00"
    assert period_range("month", now)[0].isoformat() == "2026-09-24T00:00:00+02:00"


async def test_energy_sums_changes(
    hass: HomeAssistant, statistics: list[tuple[Any, ...]]
) -> None:
    """Changes are summed in kWh; missing data is None."""
    now = dt_util.now()
    result = await async_energy(
        hass, ["sensor.a", "sensor.b", "portal:x", "sensor.none"], "week", now
    )
    assert result == {
        "sensor.a": 0.75,
        "sensor.b": None,
        "portal:x": 2,
        "sensor.none": None,
    }
    ((_, start, end, ids, resolution, units, types),) = statistics
    assert (start, end) == period_range("week", now)
    assert ids == {"sensor.a", "sensor.b", "portal:x", "sensor.none"}
    assert resolution == "hour"
    assert units == {"energy": "kWh", "volume": "L"}
    assert types == {"change"}


async def test_water_in_gallons_for_us_units(
    hass: HomeAssistant, statistics: list[tuple[Any, ...]]
) -> None:
    """With US units, water comes in gallons."""
    hass.config.units = US_CUSTOMARY_SYSTEM
    assert water_unit(hass) == "gal"
    await async_energy(hass, ["sensor.a"], "today", dt_util.now())
    assert statistics[0][5] == {"energy": "kWh", "volume": "gal"}


@pytest.mark.parametrize(
    ("period", "resolution"), [("today", "5minute"), ("month", "day")]
)
async def test_resolution_by_period(
    hass: HomeAssistant,
    statistics: list[tuple[Any, ...]],
    period: str,
    resolution: str,
) -> None:
    """Today uses 5-minute statistics, 30 days daily ones."""
    await async_energy(hass, ["sensor.a"], period, dt_util.now())
    assert statistics[0][4] == resolution


async def test_without_recorder_or_statistics(hass: HomeAssistant) -> None:
    """Without recorder or statistics nothing is queried."""
    assert await async_energy(hass, ["sensor.a"], "today", dt_util.now()) == {
        "sensor.a": None
    }
    hass.config.components.add("recorder")
    assert await async_energy(hass, [], "today", dt_util.now()) == {}
