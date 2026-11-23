"""Tests for reading statistics with the real recorder (units, hourly fallback).

The recorder must be set up before Home Assistant, so these tests live in their
own module.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from homeassistant.components.recorder.models import StatisticMeanType
from homeassistant.components.recorder.statistics import async_import_statistics
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper.stats_probe import async_probe

try:
    from pytest_homeassistant.components.recorder.common import (
        async_wait_recording_done,
    )
except ImportError:  # Home Assistant before 2026.11
    from pytest_homeassistant_custom_component.components.recorder.common import (
        async_wait_recording_done,
    )


@pytest.fixture
def mock_recorder_before_hass(async_test_recorder: Any) -> None:
    """Prepare the recorder's database before Home Assistant starts."""


async def test_probe_units_with_the_recorder(
    recorder_mock: Any, hass: HomeAssistant
) -> None:
    """With the real recorder: Wh comes back in kWh and kW in W (hourly fallback)."""
    end = dt_util.utcnow().replace(minute=0, second=0, microsecond=0)
    hours = [end - timedelta(hours=10 - index) for index in range(10)]
    async_import_statistics(
        hass,
        {
            "mean_type": StatisticMeanType.NONE,
            "has_sum": True,
            "name": None,
            "source": "recorder",
            "statistic_id": "sensor.wh_meter",
            "unit_class": "energy",
            "unit_of_measurement": "Wh",
        },
        [
            {"start": when, "state": 1000.0 * (index + 1), "sum": 1000.0 * index}
            for index, when in enumerate(hours)
        ],
    )
    async_import_statistics(
        hass,
        {
            "mean_type": StatisticMeanType.ARITHMETIC,
            "has_sum": False,
            "name": None,
            "source": "recorder",
            "statistic_id": "sensor.kw_power",
            "unit_class": "power",
            "unit_of_measurement": "kW",
        },
        [{"start": when, "mean": 0.5, "min": -0.2, "max": 1.0} for when in hours],
    )
    await async_wait_recording_done(hass)
    evidence = await async_probe(hass, {"sensor.wh_meter", "sensor.kw_power"})
    assert evidence is not None
    energy = evidence["sensor.wh_meter"]
    assert [value for _, value in energy.series] == [
        pytest.approx(float(index + 1)) for index in range(10)
    ]
    power = evidence["sensor.kw_power"]
    assert power.series[0][1] == pytest.approx(500.0)
    assert power.went_negative
