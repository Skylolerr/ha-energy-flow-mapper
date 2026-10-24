"""Tests for the backup store."""

from __future__ import annotations

from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.backups import BackupStore
from custom_components.energy_flow_mapper.const import DEFAULT_MAX_BACKUPS, STORAGE_KEY


async def test_add_list_and_get(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    freezer: FrozenDateTimeFactory,
) -> None:
    """Backups are saved immediately and listed newest first without content."""
    freezer.move_to("2026-10-23 10:00:00+00:00")
    store = BackupStore(hass)
    await store.async_load()
    assert store.entries() == []

    first = await store.async_add(
        {"device_consumption": [{"stat_consumption": "sensor.a"}]},
        "user-1",
        "Admin",
        {"added": 1},
    )
    freezer.tick(60)
    second = await store.async_add({"device_consumption": []}, None, None, {})

    assert hass_storage[STORAGE_KEY]["version"] == 1
    assert len(hass_storage[STORAGE_KEY]["data"]["backups"]) == 2
    assert store.entries() == [
        {
            "id": second,
            "created": "2026-10-23T10:01:00+00:00",
            "user_id": None,
            "user_name": None,
            "summary": {},
        },
        {
            "id": first,
            "created": "2026-10-23T10:00:00+00:00",
            "user_id": "user-1",
            "user_name": "Admin",
            "summary": {"added": 1},
        },
    ]
    backup = store.get(first)
    assert backup is not None
    assert backup["data"] == {"device_consumption": [{"stat_consumption": "sensor.a"}]}
    assert store.get("unknown") is None

    reloaded = BackupStore(hass)
    await reloaded.async_load()
    assert reloaded.entries() == store.entries()


async def test_limit(hass: HomeAssistant) -> None:
    """Only the newest DEFAULT_MAX_BACKUPS backups are kept."""
    store = BackupStore(hass)
    await store.async_load()
    ids = [
        await store.async_add({"device_consumption": []}, None, None, {"n": n})
        for n in range(DEFAULT_MAX_BACKUPS + 3)
    ]
    entries = store.entries()
    assert len(entries) == DEFAULT_MAX_BACKUPS
    assert [entry["id"] for entry in entries] == list(reversed(ids[3:]))


async def test_discard_and_remove(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A single backup can be discarded; removing deletes the file."""
    store = BackupStore(hass)
    await store.async_load()
    keep = await store.async_add({}, None, None, {})
    drop = await store.async_add({}, None, None, {})
    await store.async_discard(drop)
    assert [entry["id"] for entry in store.entries()] == [keep]

    await store.async_remove()
    assert store.entries() == []
    assert STORAGE_KEY not in hass_storage


async def test_discard_brings_back_dropped_backups(hass: HomeAssistant) -> None:
    """Discarding a backup returns the ones adding it pushed out."""
    store = BackupStore(hass)
    await store.async_load()
    ids = [
        await store.async_add({}, None, None, {"n": n})
        for n in range(DEFAULT_MAX_BACKUPS)
    ]
    extra = await store.async_add({}, None, None, {})
    assert ids[0] not in [entry["id"] for entry in store.entries()]
    await store.async_discard(extra)
    assert [entry["id"] for entry in store.entries()] == list(reversed(ids))
    # A second discard has nothing to bring back.
    await store.async_discard(ids[-1])
    assert len(store.entries()) == DEFAULT_MAX_BACKUPS - 1


async def test_custom_limit_and_trim_on_load(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A lower limit keeps fewer backups and trims older ones when loading."""
    store = BackupStore(hass, 7)
    await store.async_load()
    assert store.limit == 7
    ids = [await store.async_add({}, None, None, {"n": n}) for n in range(9)]
    assert [entry["id"] for entry in store.entries()] == list(reversed(ids[2:]))

    smaller = BackupStore(hass, 5)
    await smaller.async_load()
    assert [entry["id"] for entry in smaller.entries()] == list(reversed(ids[4:]))
    # The trim is saved at once, not only with the next backup.
    assert len(hass_storage[STORAGE_KEY]["data"]["backups"]) == 5
