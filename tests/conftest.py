"""Fixtures for Energy Flow Mapper tests.

The energy preferences cover four device levels and all source types, because
the maintainer's own instance only has two levels and no sources.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper.const import DOMAIN

ENERGY_PREFS: dict[str, Any] = {
    "energy_sources": [
        {
            "type": "grid",
            "stat_energy_from": "sensor.grid_import",
            "stat_energy_to": "sensor.grid_export",
            "stat_cost": None,
            "entity_energy_price": None,
            "number_energy_price": 0.3,
            "stat_compensation": None,
            "entity_energy_price_export": None,
            "number_energy_price_export": 0.08,
            "cost_adjustment_day": 0.0,
        },
        {
            "type": "solar",
            "stat_energy_from": "sensor.solar_energy",
            "config_entry_solar_forecast": None,
        },
        {
            "type": "battery",
            "stat_energy_from": "sensor.battery_out",
            "stat_energy_to": "sensor.battery_in",
            "capacity": 10.0,
        },
    ],
    "device_consumption": [
        {
            "stat_consumption": "sensor.main_energy",
            "stat_rate": "sensor.main_power",
            "name": "Main",
        },
        {
            "stat_consumption": "sensor.kitchen_energy",
            "included_in_stat": "sensor.main_energy",
        },
        {
            "stat_consumption": "sensor.coffee_energy",
            "included_in_stat": "sensor.kitchen_energy",
        },
        {
            "stat_consumption": "sensor.grinder_energy",
            "included_in_stat": "sensor.coffee_energy",
        },
        {"stat_consumption": "sensor.garage_energy"},
    ],
    "device_consumption_water": [],
}


def storage_payload(data: dict[str, Any] | None) -> dict[str, Any]:
    """Return the `.storage/energy` file content."""
    return {"version": 1, "minor_version": 3, "key": "energy", "data": data}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(
    enable_custom_integrations: None,
) -> None:
    """Enable loading of custom integrations in all tests."""


@pytest.fixture(autouse=True)
def energy_loaded(hass: HomeAssistant) -> None:
    """Mark the energy integration as loaded.

    Energy Flow Mapper only needs the energy manager, which works without the
    integration being set up; this avoids starting a recorder in every test.
    """
    hass.config.components.add("energy")


@pytest.fixture
def energy_prefs() -> dict[str, Any] | None:
    """Return the energy preferences on disk (None: never set up)."""
    return deepcopy(ENERGY_PREFS)


@pytest.fixture(autouse=True)
def energy_storage(
    hass_storage: dict[str, Any], energy_prefs: dict[str, Any] | None
) -> None:
    """Put the energy preferences into storage before anything loads them."""
    if energy_prefs is not None:
        hass_storage["energy"] = storage_payload(energy_prefs)


def _meter(
    hass: HomeAssistant,
    entity_id: str,
    *,
    device_class: str = "energy",
    unit: str = "kWh",
    state_class: str | None = "total_increasing",
    device_id: str | None = None,
    name: str | None = None,
    state: str = "1.0",
) -> None:
    """Register an entity and give it a state."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        "test",
        entity_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        unit_of_measurement=unit,
    )
    attributes: dict[str, Any] = {
        "device_class": device_class,
        "unit_of_measurement": unit,
        "friendly_name": name or entity_id,
    }
    if state_class is not None:
        attributes["state_class"] = state_class
    hass.states.async_set(entity_id, state, attributes)


@pytest.fixture
async def sensors(hass: HomeAssistant) -> None:
    """Create devices, areas and the sensors used by the preferences."""
    config_entry = MockConfigEntry(domain="test")
    config_entry.add_to_hass(hass)
    floor = fr.async_get(hass).async_create("Ground floor")
    office = ar.async_get(hass).async_create("Office", floor_id=floor.floor_id)
    kitchen = ar.async_get(hass).async_create("Kitchen")
    devices = dr.async_get(hass)
    main = devices.async_get_or_create(
        config_entry_id=config_entry.entry_id,
        identifiers={("test", "main")},
        name="Main meter",
    )
    plug = devices.async_get_or_create(
        config_entry_id=config_entry.entry_id,
        identifiers={("test", "printer")},
        name="Printer plug",
    )
    devices.async_update_device(plug.id, area_id=office.id, name_by_user="Printer")

    _meter(hass, "sensor.main_energy", device_id=main.id, name="Main energy")
    _meter(hass, "sensor.main_power", device_class="power", unit="W", device_id=main.id)
    for stat in (
        "sensor.kitchen_energy",
        "sensor.coffee_energy",
        "sensor.grinder_energy",
        "sensor.garage_energy",
        "sensor.grid_import",
        "sensor.grid_export",
        "sensor.solar_energy",
        "sensor.battery_out",
        "sensor.battery_in",
    ):
        _meter(hass, stat)
    er.async_get(hass).async_update_entity("sensor.kitchen_energy", area_id=kitchen.id)

    # Candidates: two unused energy meters, one with a power sensor.
    _meter(hass, "sensor.printer_energy", device_id=plug.id, name="Printer energy")
    _meter(
        hass, "sensor.printer_power", device_class="power", unit="W", device_id=plug.id
    )
    _meter(hass, "sensor.attic_energy", name="Attic energy", state_class="total")
    # Not candidates: no meter state class, other device class.
    _meter(hass, "sensor.energy_today", state_class="measurement")
    _meter(hass, "sensor.water_meter", device_class="water", unit="m³")


@pytest.fixture
def config_entry() -> MockConfigEntry:
    """Return the config entry."""
    return MockConfigEntry(domain=DOMAIN, title="Energy Flow Mapper", entry_id="efm")


@pytest.fixture
async def loaded_entry(
    hass: HomeAssistant, config_entry: MockConfigEntry
) -> MockConfigEntry:
    """Set up the integration and return its entry."""
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    return config_entry
