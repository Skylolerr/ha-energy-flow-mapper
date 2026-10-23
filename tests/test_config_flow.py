"""Tests for the config flow."""

from __future__ import annotations

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper.const import DOMAIN


async def test_create_entry(hass: HomeAssistant) -> None:
    """A single confirmation step creates the entry."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Energy Flow Mapper"
    assert result["data"] == {}
    await hass.async_block_till_done()
    assert result["result"].runtime_data.supported


async def test_single_instance(
    hass: HomeAssistant, config_entry: MockConfigEntry
) -> None:
    """A second entry is refused."""
    config_entry.add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"
