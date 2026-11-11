"""Tests for the group store."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.const import GROUPS_STORAGE_KEY
from custom_components.energy_flow_mapper.group_store import GroupStore
from custom_components.energy_flow_mapper.groups import Groups, empty_groups

GROUP = {
    "id": "g",
    "name": "K",
    "parent": None,
    "group": None,
    "members": ["sensor.a"],
}


async def test_load_empty(hass: HomeAssistant) -> None:
    store = GroupStore(hass)
    await store.async_load()
    assert store.groups() == empty_groups()


async def test_save_and_load_again(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    store = GroupStore(hass)
    await store.async_load()
    groups: Groups = {"electricity": [GROUP], "water": []}  # type: ignore[list-item]
    await store.async_save(groups)
    assert store.groups() == groups
    assert hass_storage[GROUPS_STORAGE_KEY]["data"] == {"groups": groups}

    again = GroupStore(hass)
    await again.async_load()
    assert again.groups() == groups


async def test_load_damaged_file(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Only well-formed groups of the known kinds are kept."""
    other_types = [
        {**GROUP, "name": 5},
        {**GROUP, "parent": 3},
        {**GROUP, "group": 3},
        {**GROUP, "members": "sensor.a"},
        {**GROUP, "members": [1]},
    ]
    hass_storage[GROUPS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": GROUPS_STORAGE_KEY,
        "data": {
            "groups": {
                "electricity": [{"id": 1}, "x", GROUP, *other_types],
                "gas": [GROUP],
            }
        },
    }
    store = GroupStore(hass)
    await store.async_load()
    assert store.groups() == {"electricity": [GROUP], "water": []}

    hass_storage[GROUPS_STORAGE_KEY]["data"] = {"groups": {"water": "nonsense"}}
    other = GroupStore(hass)
    await other.async_load()
    assert other.groups() == empty_groups()

    hass_storage[GROUPS_STORAGE_KEY]["data"] = {"groups": None}
    third = GroupStore(hass)
    await third.async_load()
    assert third.groups() == empty_groups()


async def test_groups_returns_a_copy(hass: HomeAssistant) -> None:
    store = GroupStore(hass)
    await store.async_load()
    await store.async_save({"electricity": [GROUP], "water": []})  # type: ignore[list-item]
    store.groups()["electricity"][0]["members"].append("sensor.b")
    store.groups()["water"].append(GROUP)  # type: ignore[arg-type]
    assert store.groups()["electricity"][0]["members"] == ["sensor.a"]
    assert store.groups()["water"] == []


async def test_save_stores_a_copy(hass: HomeAssistant) -> None:
    store = GroupStore(hass)
    await store.async_load()
    groups: Groups = {"electricity": [dict(GROUP)], "water": []}  # type: ignore[list-item]
    await store.async_save(groups)
    groups["electricity"][0]["name"] = "changed"
    assert store.groups()["electricity"][0]["name"] == "K"


async def test_migration_keeps_version_1_data(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file saved with an older minor version is loaded unchanged."""
    hass_storage[GROUPS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 0,
        "key": GROUPS_STORAGE_KEY,
        "data": {"groups": {"electricity": [GROUP], "water": []}},
    }
    store = GroupStore(hass)
    await store.async_load()
    assert store.groups() == {"electricity": [GROUP], "water": []}


async def test_remove(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    store = GroupStore(hass)
    await store.async_load()
    await store.async_save({"electricity": [GROUP], "water": []})  # type: ignore[list-item]
    await store.async_remove()
    assert GROUPS_STORAGE_KEY not in hass_storage
    assert store.groups() == empty_groups()
