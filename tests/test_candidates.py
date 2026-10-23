"""Tests for statistic metadata and unused energy sensors."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper import candidates as candidates_module
from custom_components.energy_flow_mapper.candidates import (
    ENERGY_UNITS,
    async_candidates,
    async_external_candidates,
    async_external_statistics,
    async_integral_sources,
    async_mark_created,
    async_power_candidates,
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


@pytest.mark.usefixtures("sensors")
async def test_power_candidates(hass: HomeAssistant) -> None:
    """Power sensors without meter, not used and not integrated yet."""
    candidates = async_power_candidates(hass, ENERGY_PREFS)
    assert [c["stat"] for c in candidates] == ["sensor.ups_power"]
    assert candidates[0]["name"] == "UPS power"
    assert candidates[0]["device_name"] == "UPS"
    assert async_integral_sources(hass) == {"sensor.poe_power"}

    # A power sensor that belongs to no device is offered too.
    hass.states.async_set(
        "sensor.loose_power",
        "5",
        {"device_class": "power", "unit_of_measurement": "kW"},
    )
    stats = [c["stat"] for c in async_power_candidates(hass, ENERGY_PREFS)]
    assert stats == ["sensor.loose_power", "sensor.ups_power"]


@pytest.mark.usefixtures("sensors")
async def test_power_candidate_used_as_rate(hass: HomeAssistant) -> None:
    """A power sensor already used as stat_rate is not offered."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append(
        {"stat_consumption": "sensor.x", "stat_rate": "sensor.ups_power"}
    )
    assert async_power_candidates(hass, prefs) == []


EXTERNAL = [
    {
        "statistic_id": "portal:import",
        "name": "Portal import",
        "statistics_unit_of_measurement": "kWh",
    },
    {
        "statistic_id": "portal:gas",
        "name": "Portal gas",
        "statistics_unit_of_measurement": "m³",
    },
    {
        "statistic_id": "sensor.main_energy",
        "name": None,
        "statistics_unit_of_measurement": "kWh",
    },
    {
        "statistic_id": "portal:used",
        "name": None,
        "statistics_unit_of_measurement": "Wh",
    },
]


async def test_external_statistics(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """External energy statistics come from the recorder, if it is loaded."""
    assert await async_external_statistics(hass) == {}

    async def fake_list(hass: HomeAssistant, **kwargs: Any) -> list[dict[str, Any]]:
        assert kwargs == {"statistic_type": "sum"}
        return EXTERNAL

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", fake_list)
    hass.config.components.add("recorder")
    external = await async_external_statistics(hass)
    assert list(external) == ["portal:import", "portal:used"]

    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append({"stat_consumption": "portal:used"})
    candidates = async_external_candidates(hass, prefs, external)
    assert [c["stat"] for c in candidates] == ["portal:import"]
    assert candidates[0]["name"] == "Portal import"
    assert candidates[0]["unit"] == "kWh"
    assert candidates[0]["external"] is True
    assert candidates[0]["entity_id"] is None

    info = async_stats_info(hass, prefs, external)
    assert info["portal:used"]["unit"] == "Wh"
    assert info["portal:used"]["device_class"] == "energy"


async def test_mark_created(hass: HomeAssistant) -> None:
    """Entities of helpers created by the panel are flagged."""
    helper = MockConfigEntry(domain="integration", entry_id="helper")
    helper.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "integration",
        "ups_energy",
        suggested_object_id="ups_energy",
        config_entry=helper,
    )
    infos = [
        async_stat_info(hass, "sensor.ups_energy"),
        async_stat_info(hass, "portal:x"),
        async_stat_info(hass, "sensor.unknown"),
    ]
    async_mark_created(hass, infos, ["helper"])
    assert [i["created_helper"] for i in infos] == [True, False, False]
    async_mark_created(hass, infos, [])
    assert infos[0]["created_helper"] is False
