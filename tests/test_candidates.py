"""Tests for statistic metadata and unused energy sensors."""

from __future__ import annotations

from copy import deepcopy

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from custom_components.energy_flow_mapper.candidates import (
    ENERGY_UNITS,
    async_candidates,
    async_stat_info,
    async_stat_units,
    async_stats_info,
)

from .conftest import ENERGY_PREFS


@pytest.mark.usefixtures("sensors")
async def test_stat_info_with_device_area_and_floor(hass: HomeAssistant) -> None:
    """Entity statistics get name, unit, device, area and floor."""
    info = async_stat_info(hass, "sensor.printer_energy")
    assert info["entity_id"] == "sensor.printer_energy"
    assert info["name"] == "Printer energy"
    assert info["unit"] == "kWh"
    assert info["device_class"] == "energy"
    assert info["device_name"] == "Printer"
    assert info["device_id"] is not None
    assert info["area_name"] == "Office"
    assert info["floor_name"] == "Ground floor"


@pytest.mark.usefixtures("sensors")
async def test_stat_info_entity_area_without_floor(hass: HomeAssistant) -> None:
    """An area set on the entity itself is used; it has no floor."""
    info = async_stat_info(hass, "sensor.kitchen_energy")
    assert info["area_name"] == "Kitchen"
    assert info["floor_id"] is None
    assert info["device_id"] is None


async def test_stat_info_external_and_unknown(hass: HomeAssistant) -> None:
    """External statistics only have an ID; unknown entities have no data."""
    external = async_stat_info(hass, "portal:energy_import")
    assert external["stat"] == "portal:energy_import"
    assert external["entity_id"] is None
    assert external["name"] is None

    unknown = async_stat_info(hass, "sensor.unknown")
    assert unknown["entity_id"] == "sensor.unknown"
    assert unknown["name"] is None
    assert unknown["unit"] is None
    assert unknown["device_class"] is None


async def test_stat_info_from_registry_only(hass: HomeAssistant) -> None:
    """Without a state, name, unit and class come from the registry."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        "test",
        "offline",
        suggested_object_id="offline",
        original_name="Offline meter",
        original_device_class="energy",
        unit_of_measurement="Wh",
    )
    info = async_stat_info(hass, "sensor.offline")
    assert info["name"] == "Offline meter"
    assert info["unit"] == "Wh"
    assert info["device_class"] == "energy"


@pytest.mark.usefixtures("sensors")
async def test_stats_info_covers_all_used_statistics(hass: HomeAssistant) -> None:
    """Every statistic in the prefs is described, sorted by ID."""
    info = async_stats_info(hass, ENERGY_PREFS)
    assert list(info) == sorted(info)
    assert "sensor.main_power" in info
    assert "sensor.grid_export" in info
    assert info["sensor.main_energy"]["device_name"] == "Main meter"


@pytest.mark.usefixtures("sensors")
async def test_stat_units(hass: HomeAssistant) -> None:
    """Units of devices; missing ones are left out, external ones are None."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"] += [
        {"stat_consumption": "sensor.gone"},
        {"stat_consumption": "portal:device"},
        {"stat_consumption": "sensor.water_meter"},
    ]
    er.async_get(hass).async_get_or_create(
        "sensor",
        "test",
        "registry_only",
        suggested_object_id="registry_only",
        unit_of_measurement="MWh",
    )
    prefs["device_consumption"].append({"stat_consumption": "sensor.registry_only"})

    units = async_stat_units(hass, prefs)
    assert units["sensor.main_energy"] == "kWh"
    assert units["sensor.water_meter"] == "m³"
    assert units["portal:device"] is None
    assert units["sensor.registry_only"] == "MWh"
    assert "sensor.gone" not in units
    assert "kWh" in ENERGY_UNITS
    assert "W" not in ENERGY_UNITS


@pytest.mark.usefixtures("sensors")
async def test_candidates(hass: HomeAssistant) -> None:
    """Unused energy meters, sorted by area and name, with a power suggestion."""
    candidates = async_candidates(hass, ENERGY_PREFS)
    assert [c["stat"] for c in candidates] == [
        "sensor.attic_energy",
        "sensor.printer_energy",
    ]
    attic, printer = candidates
    assert attic["area_name"] is None
    assert attic["power"] is None
    assert printer["area_name"] == "Office"
    assert printer["power"] == "sensor.printer_power"


@pytest.mark.usefixtures("sensors")
async def test_candidates_exclude_sources_and_devices(hass: HomeAssistant) -> None:
    """With empty prefs, source and device meters become candidates too."""
    stats = {
        c["stat"]
        for c in async_candidates(
            hass, {"energy_sources": [], "device_consumption": []}
        )
    }
    assert "sensor.grid_import" in stats
    assert "sensor.main_energy" in stats
    assert "sensor.energy_today" not in stats
    assert "sensor.water_meter" not in stats
    assert "sensor.main_power" not in stats
