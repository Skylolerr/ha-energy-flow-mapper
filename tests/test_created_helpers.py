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
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {
        "entries": ["a", "b"],
        "records": {},
    }

    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.entries() == ["a", "b"]

    await reloaded.async_remove()
    assert reloaded.entries() == []
    assert HELPERS_STORAGE_KEY not in hass_storage


async def test_discard_forgets_one_id(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A discarded ID is saved away at once; an unknown one changes nothing."""
    store = CreatedHelpers(hass)
    await store.async_load()
    await store.async_add("a")
    await store.async_add("b")
    await store.async_discard("a")
    await store.async_discard("zzz")
    assert store.entries() == ["b"]
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {
        "entries": ["b"],
        "records": {},
    }


async def test_records_kept_with_their_helper(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """What a helper is for is saved with it, reloaded, and forgotten with it."""
    store = CreatedHelpers(hass)
    await store.async_load()
    await store.async_add("a", {"kind": "solar_power", "power": "sensor.p"})
    await store.async_add("b")
    assert store.record("a") == {"kind": "solar_power", "power": "sensor.p"}
    assert store.record("b") is None
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 2
    assert hass_storage[HELPERS_STORAGE_KEY]["data"]["records"] == {
        "a": {"kind": "solar_power", "power": "sensor.p"}
    }
    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.records() == {"a": {"kind": "solar_power", "power": "sensor.p"}}
    await reloaded.async_discard("a")
    assert reloaded.records() == {}
    assert reloaded.entries() == ["b"]


async def test_migrates_version_1_1(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file of version 1.1 (IDs only) loads with no records and is migrated."""
    hass_storage[HELPERS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": HELPERS_STORAGE_KEY,
        "data": {"entries": ["a"]},
    }
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a"]
    assert store.records() == {}
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 2
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {
        "entries": ["a"],
        "records": {},
    }


async def test_damaged_records_are_left_out(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Records of unknown helpers or of the wrong shape are dropped on load."""
    hass_storage[HELPERS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 2,
        "key": HELPERS_STORAGE_KEY,
        "data": {
            "entries": ["a", "b"],
            "records": {"a": {"kind": "x"}, "b": "nope", "c": {"kind": "y"}},
        },
    }
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.records() == {"a": {"kind": "x"}}


async def test_newer_minor_version_is_read_as_it_is(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file a newer release wrote (version 1.3) loads with what it knows."""
    hass_storage[HELPERS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 3,
        "key": HELPERS_STORAGE_KEY,
        "data": {"entries": ["a"], "records": {"a": {"kind": "x"}}, "more": 1},
    }
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a"]
    assert store.records() == {"a": {"kind": "x"}}
