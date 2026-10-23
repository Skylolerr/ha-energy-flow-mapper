"""Tests for setting up and removing the integration."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.energy_flow_mapper import energy_access
from custom_components.energy_flow_mapper.const import (
    DOMAIN,
    HELPERS_STORAGE_KEY,
    ISSUE_UNSUPPORTED_ENERGY_API,
    STORAGE_KEY,
)


async def test_setup_unload_and_remove(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    hass_storage: dict[str, Any],
) -> None:
    """The entry loads; removing it deletes the backups but not the energy prefs."""
    assert loaded_entry.state is ConfigEntryState.LOADED
    assert loaded_entry.runtime_data.supported
    assert loaded_entry.runtime_data.backups.entries() == []

    await loaded_entry.runtime_data.backups.async_add({}, None, None, {})
    await loaded_entry.runtime_data.helpers.async_add("helper")
    assert STORAGE_KEY in hass_storage
    assert HELPERS_STORAGE_KEY in hass_storage

    assert await hass.config_entries.async_unload(loaded_entry.entry_id)
    assert loaded_entry.state is ConfigEntryState.NOT_LOADED

    await hass.config_entries.async_remove(loaded_entry.entry_id)
    await hass.async_block_till_done()
    assert STORAGE_KEY not in hass_storage
    assert HELPERS_STORAGE_KEY not in hass_storage
    assert "energy" in hass_storage


async def test_backups_survive_reload(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """Backups are loaded again after a reload."""
    backup_id = await loaded_entry.runtime_data.backups.async_add(
        {"device_consumption": []}, "user", "Admin", {"added": 1}
    )
    assert await hass.config_entries.async_reload(loaded_entry.entry_id)
    await hass.async_block_till_done()
    entries = loaded_entry.runtime_data.backups.entries()
    assert [entry["id"] for entry in entries] == [backup_id]


async def test_unsupported_energy_api_creates_repair_issue(
    hass: HomeAssistant,
    config_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
    issue_registry: ir.IssueRegistry,
) -> None:
    """A missing energy API keeps the entry loaded but disabled with an issue."""
    monkeypatch.setattr(
        energy_access, "REQUIRED_NAMES", ("async_get_manager", "NOT_THERE")
    )
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    assert config_entry.state is ConfigEntryState.LOADED
    assert not config_entry.runtime_data.supported
    issue = issue_registry.async_get_issue(DOMAIN, ISSUE_UNSUPPORTED_ENERGY_API)
    assert issue is not None
    assert issue.severity is ir.IssueSeverity.ERROR
    assert issue.translation_key == ISSUE_UNSUPPORTED_ENERGY_API

    # Once the API fits again, a reload removes the issue.
    monkeypatch.undo()
    assert await hass.config_entries.async_reload(config_entry.entry_id)
    await hass.async_block_till_done()
    assert config_entry.runtime_data.supported
    assert issue_registry.async_get_issue(DOMAIN, ISSUE_UNSUPPORTED_ENERGY_API) is None


async def test_manager_without_expected_methods(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A manager without `data`/`async_update` is not supported."""

    async def fake_manager(hass: HomeAssistant) -> object:
        return object()

    monkeypatch.setattr(energy_access.energy_data, "async_get_manager", fake_manager)
    assert not await energy_access.async_is_supported(hass)
