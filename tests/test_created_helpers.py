"""Tests for the list of helpers created by the panel."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from custom_components.energy_flow_mapper.const import (
    HELPER_RECORDS_STORAGE_KEY,
    HELPERS_STORAGE_KEY,
)
from custom_components.energy_flow_mapper.created_helpers import CreatedHelpers


def _file(key: str, data: dict[str, Any], minor: int = 1) -> dict[str, Any]:
    """Return a store file as Home Assistant writes it."""
    return {"version": 1, "minor_version": minor, "key": key, "data": data}


async def test_add_reload_and_remove(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """IDs are saved at once, kept unique, reloaded and deleted with the store."""
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == []
    await store.async_add("a")
    await store.async_add("a")
    await store.async_add("b", {"kind": "x"})
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a", "b"]}

    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.entries() == ["a", "b"]

    await reloaded.async_remove()
    assert reloaded.entries() == []
    assert reloaded.records() == {}
    assert HELPERS_STORAGE_KEY not in hass_storage
    assert HELPER_RECORDS_STORAGE_KEY not in hass_storage


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
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["b"]}
    # Helpers without a record never write the records file.
    assert HELPER_RECORDS_STORAGE_KEY not in hass_storage


async def test_records_kept_in_their_own_file(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """What a helper is for is saved in the records file, reloaded, forgotten."""
    store = CreatedHelpers(hass)
    await store.async_load()
    await store.async_add("a", {"kind": "solar_power", "power": "sensor.p"})
    await store.async_add("b")
    assert store.record("a") == {"kind": "solar_power", "power": "sensor.p"}
    assert store.record("b") is None
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 3
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a", "b"]}
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["version"] == 1
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["data"] == {
        "records": {"a": {"kind": "solar_power", "power": "sensor.p"}}
    }
    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.records() == {"a": {"kind": "solar_power", "power": "sensor.p"}}
    await reloaded.async_discard("a")
    assert reloaded.records() == {}
    assert reloaded.entries() == ["b"]
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["data"] == {"records": {}}
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["b"]}


async def test_migrates_version_1_1(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file of version 1.1 (IDs only) loads with no records and is migrated."""
    hass_storage[HELPERS_STORAGE_KEY] = _file(HELPERS_STORAGE_KEY, {"entries": ["a"]})
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a"]
    assert store.records() == {}
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 3
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a"]}
    assert HELPER_RECORDS_STORAGE_KEY not in hass_storage


async def test_migrates_version_1_2_records_to_their_own_file(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """The records of a 1.2 file move once to the records file; 1.3 has none."""
    records = {"a": {"kind": "gross_energy", "stat": "sensor.main_energy"}}
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY, {"entries": ["a", "b"], "records": records}, minor=2
    )
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a", "b"]
    assert store.records() == records
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 3
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a", "b"]}
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["data"] == {"records": records}

    reloaded = CreatedHelpers(hass)
    await reloaded.async_load()
    assert reloaded.records() == records


async def test_records_file_wins_and_others_are_merged(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Both files with records: the records file wins, the rest is added."""
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY,
        {
            "entries": ["a", "b", "c"],
            "records": {"a": {"kind": "old"}, "b": {"kind": "only_here"}},
        },
        minor=3,
    )
    hass_storage[HELPER_RECORDS_STORAGE_KEY] = _file(
        HELPER_RECORDS_STORAGE_KEY,
        {"records": {"a": {"kind": "new"}, "c": {"kind": "kept"}}},
    )
    store = CreatedHelpers(hass)
    await store.async_load()
    expected = {"a": {"kind": "new"}, "b": {"kind": "only_here"}, "c": {"kind": "kept"}}
    assert store.records() == expected
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["data"] == {"records": expected}
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a", "b", "c"]}


async def test_move_writes_the_records_file_first(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A crash before the helpers file loses its records loses nothing."""
    records = {"a": {"kind": "solar_energy", "power": "sensor.p"}}
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY, {"entries": ["a"], "records": records}, minor=2
    )
    original = Store.async_save

    async def crash(self: Store[Any], data: Any) -> None:
        if self.key == HELPERS_STORAGE_KEY and "records" not in data:
            raise OSError("power cut")
        await original(self, data)

    monkeypatch.setattr(Store, "async_save", crash)
    with pytest.raises(OSError, match="power cut"):
        await CreatedHelpers(hass).async_load()
    assert hass_storage[HELPER_RECORDS_STORAGE_KEY]["data"] == {"records": records}
    assert hass_storage[HELPERS_STORAGE_KEY]["data"]["records"] == records

    monkeypatch.undo()
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.records() == records
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {"entries": ["a"]}


async def test_damaged_records_are_left_out(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Records of unknown helpers or of the wrong shape are dropped on load."""
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY,
        {
            "entries": ["a", "b", "d"],
            "records": {"a": {"kind": "x"}, "b": "nope", "c": {"kind": "y"}},
        },
        minor=2,
    )
    hass_storage[HELPER_RECORDS_STORAGE_KEY] = _file(
        HELPER_RECORDS_STORAGE_KEY,
        {"records": {"d": {"kind": "z"}, "e": {"kind": "gone"}, "b": 3}},
    )
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.records() == {"a": {"kind": "x"}, "d": {"kind": "z"}}


async def test_damaged_records_file_is_read_as_empty(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A records file without a records mapping gives no records."""
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY, {"entries": ["a"]}, minor=3
    )
    hass_storage[HELPER_RECORDS_STORAGE_KEY] = _file(
        HELPER_RECORDS_STORAGE_KEY, {"records": ["a"]}
    )
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a"]
    assert store.records() == {}


async def test_newer_minor_version_is_read_as_it_is(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file a newer release wrote (version 1.4) loads with what it knows."""
    hass_storage[HELPERS_STORAGE_KEY] = _file(
        HELPERS_STORAGE_KEY, {"entries": ["a"], "more": 1}, minor=4
    )
    hass_storage[HELPER_RECORDS_STORAGE_KEY] = _file(
        HELPER_RECORDS_STORAGE_KEY, {"records": {"a": {"kind": "x"}}}, minor=2
    )
    store = CreatedHelpers(hass)
    await store.async_load()
    assert store.entries() == ["a"]
    assert store.records() == {"a": {"kind": "x"}}


async def _save_as_0_10(hass: HomeAssistant, new_entry: str) -> None:
    """Do what release 0.10.x does with the helpers file.

    Its store is a plain `Store(hass, 1, key)` (version 1.1): it loads a file
    of the same major version as it is, and its own saves write the IDs only.
    """
    old: Store[dict[str, Any]] = Store(hass, 1, HELPERS_STORAGE_KEY)
    data = await old.async_load()
    entries = list(data["entries"]) if data else []
    entries.append(new_entry)
    await old.async_save({"entries": entries})


async def test_records_survive_a_downgrade_to_0_10(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """0.10.x saving the helpers file keeps the records; 0.11 finds them again."""
    new = CreatedHelpers(hass)
    await new.async_load()
    gross = {"kind": "gross_energy", "stat": "sensor.main_energy", "method": "em"}
    term = {"kind": "solar_energy", "power": "sensor.solar_power", "template": "t"}
    await new.async_add("gross1", gross)
    await new.async_add("term1", term)

    await _save_as_0_10(hass, "integral_made_in_0_10")
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 1
    assert hass_storage[HELPERS_STORAGE_KEY]["data"] == {
        "entries": ["gross1", "term1", "integral_made_in_0_10"]
    }

    again = CreatedHelpers(hass)  # back on 0.11
    await again.async_load()
    assert again.entries() == ["gross1", "term1", "integral_made_in_0_10"]
    assert again.records() == {"gross1": gross, "term1": term}
    assert hass_storage[HELPERS_STORAGE_KEY]["minor_version"] == 3
