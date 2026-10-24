"""Tests for the config flow."""

from __future__ import annotations

import pytest
from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper.const import (
    CONF_MAX_BACKUPS,
    DEFAULT_MAX_BACKUPS,
    DOMAIN,
)


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


async def test_options_set_backup_limit(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """The options set how many backups are kept; the entry reloads with it."""
    assert loaded_entry.runtime_data.backups.limit == DEFAULT_MAX_BACKUPS
    result = await hass.config_entries.options.async_init(loaded_entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "init"
    schema = result["data_schema"].schema
    assert next(iter(schema)).description == {"suggested_value": DEFAULT_MAX_BACKUPS}

    result = await hass.config_entries.options.async_configure(
        result["flow_id"], {CONF_MAX_BACKUPS: 8}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    assert loaded_entry.options == {CONF_MAX_BACKUPS: 8}
    assert loaded_entry.runtime_data.backups.limit == 8


@pytest.mark.parametrize("value", [4, 101])
async def test_options_refuse_out_of_range(
    hass: HomeAssistant, loaded_entry: MockConfigEntry, value: int
) -> None:
    """Numbers outside 5 to 100 are refused."""
    result = await hass.config_entries.options.async_init(loaded_entry.entry_id)
    with pytest.raises(InvalidData):
        await hass.config_entries.options.async_configure(
            result["flow_id"], {CONF_MAX_BACKUPS: value}
        )
