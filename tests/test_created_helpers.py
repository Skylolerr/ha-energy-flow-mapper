"""Tests for the list of helpers created by the panel."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.const import HELPERS_STORAGE_KEY
from custom_components.energy_flow_mapper.created_helpers import CreatedHelpers


async def test_add_reload_and_remove(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """IDs are saved at once, kept unique, reloaded and deleted with the store."""
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == []
    await store.async_add("a")
    await store.async_add("a")
    await store.async_add("b")
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a", "b"]}

    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.entries() == ["a", "b"]

    await reloaded.async_remove()
    assert reloaded.entries() == []
    assert HELPERS_STORAGE_KEY not in hass_storage
