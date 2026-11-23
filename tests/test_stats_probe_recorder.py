"""Tests for reading statistics with the real recorder (units, hourly fallback).

The recorder must be set up before Home Assistant, so these tests live in their
own module.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pytest
from homeassistant.components.recorder.db_schema import RecorderRuns, States
from homeassistant.components.recorder.models import StatisticMeanType
from homeassistant.components.recorder.statistics import async_import_statistics
from homeassistant.core import HomeAssistant
from homeassistant.helpers.recorder import get_instance, session_scope
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper.stats_probe import (
    async_probe,
    read_downtimes,
)

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


async def test_read_downtimes_with_the_recorder(
    recorder_mock: Any, hass: HomeAssistant
) -> None:
    """Downtimes come from the recorder runs; a crashed run ends at its last state."""
    now = dt_util.utcnow()

    def ago(hours: float) -> datetime:
        return now - timedelta(hours=hours)

    def insert() -> None:
        with session_scope(hass=hass) as session:
            session.add_all(
                [
                    # Its downtime ended before the window.
                    RecorderRuns(start=ago(60), end=ago(59), created=ago(60)),
                    RecorderRuns(start=ago(58), end=ago(40), created=ago(58)),
                    # Crashed: the end is the next start, its last state is earlier.
                    RecorderRuns(
                        start=ago(38),
                        end=ago(30),
                        closed_incorrect=True,
                        created=ago(38),
                    ),
                    # Restarted at once: no downtime.
                    RecorderRuns(start=ago(30), end=ago(20), created=ago(30)),
                    # Crashed without writing a state.
                    RecorderRuns(
                        start=ago(20),
                        end=ago(10),
                        closed_incorrect=True,
                        created=ago(20),
                    ),
                    RecorderRuns(start=ago(10), end=ago(5), created=ago(10)),
                    States(state="1", last_updated_ts=ago(33).timestamp()),
                    States(state="1", last_updated_ts=ago(25).timestamp()),
                ]
            )

    instance = get_instance(hass)
    await instance.async_add_executor_job(insert)
    await async_wait_recording_done(hass)
    found = await instance.async_add_executor_job(
        read_downtimes, hass, ago(48).timestamp()
    )
    current = instance.recorder_runs_manager.current.start.timestamp()
    assert found == [
        pytest.approx((ago(40).timestamp(), ago(38).timestamp())),
        pytest.approx((ago(33).timestamp(), ago(30).timestamp())),
        pytest.approx((ago(20).timestamp(), ago(10).timestamp())),
        pytest.approx((ago(5).timestamp(), current)),
    ]
