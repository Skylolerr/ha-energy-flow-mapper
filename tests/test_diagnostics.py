"""Tests for diagnostics."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper import energy_access
from custom_components.energy_flow_mapper.diagnostics import (
    async_get_config_entry_diagnostics,
)


async def test_diagnostics(hass: HomeAssistant, loaded_entry: MockConfigEntry) -> None:
    """Diagnostics contain counts only, no entity IDs."""
    await loaded_entry.runtime_data.backups.async_add({}, None, None, {})
    await energy_access.async_write(
        hass,
        {
            "device_consumption": [
                {"stat_consumption": "sensor.a"},
                {"stat_consumption": "sensor.b", "included_in_stat": "sensor.a"},
                {"stat_consumption": "sensor.c", "included_in_stat": "sensor.gone"},
            ]
        },
    )
    result = await async_get_config_entry_diagnostics(hass, loaded_entry)
    assert result == {
        "supported": True,
        "backups": 1,
        "backup_limit": 20,
        "created_helpers": 0,
        "sources": {"grid": 1, "solar": 1, "battery": 1},
        "devices": 3,
        "water_devices": 0,
        "tree_depth": 2,
        "issues": {"missing_parent": 1},
    }
    assert "sensor." not in str(result)


async def test_diagnostics_unsupported(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """Without a supported energy API only the basics are reported."""
    loaded_entry.runtime_data.supported = False
    result = await async_get_config_entry_diagnostics(hass, loaded_entry)
    assert result == {
        "supported": False,
        "backups": 0,
        "backup_limit": 20,
        "created_helpers": 0,
    }
