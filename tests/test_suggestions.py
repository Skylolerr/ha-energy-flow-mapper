"""Tests for the store of ignored suggestions."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from custom_components.energy_flow_mapper.const import SUGGESTIONS_STORAGE_KEY
from custom_components.energy_flow_mapper.suggestions import SuggestionStore

PAIR = {"kind": "electricity", "stat": "sensor.o1", "parent": "sensor.strip"}
KNOWN = {("electricity", "sensor.o1"), ("electricity", "sensor.strip")}


async def test_ignore_saves_and_prunes_unknown(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """An ignore is saved at once; ignores of removed devices are dropped."""
    store = SuggestionStore(hass)
    await store.async_load()
    old = {"kind": "water", "stat": "sensor.gone", "parent": "sensor.main"}
    await store.async_ignore(old, {("water", "sensor.gone"), ("water", "sensor.main")})
    await store.async_ignore(PAIR, KNOWN)
    await store.async_ignore(PAIR, KNOWN)
    assert store.ignored() == [PAIR]
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {
        "ignored": [PAIR],
        "dismissed": [],
    }

    reloaded = SuggestionStore(hass)
    await reloaded.async_load()
    assert reloaded.ignored() == [PAIR]


async def test_ignore_drops_pairs_whose_parent_is_gone(hass: HomeAssistant) -> None:
    store = SuggestionStore(hass)
    await store.async_load()
    other = {"kind": "electricity", "stat": "sensor.o2", "parent": "sensor.gone"}
    await store.async_ignore(other, {*KNOWN, ("electricity", "sensor.o2")})
    await store.async_ignore(PAIR, {*KNOWN, ("electricity", "sensor.o2")})
    assert store.ignored() == [PAIR]


async def test_clear(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    store = SuggestionStore(hass)
    await store.async_load()
    await store.async_ignore(PAIR, KNOWN)
    await store.async_clear()
    assert store.ignored() == []
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {
        "ignored": [],
        "dismissed": [],
    }


async def test_remove(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    store = SuggestionStore(hass)
    await store.async_load()
    await store.async_ignore(PAIR, KNOWN)
    await store.async_remove()
    assert SUGGESTIONS_STORAGE_KEY not in hass_storage
    assert store.ignored() == []


async def test_load_skips_broken_content(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A hand-edited or damaged file must not stop the integration."""
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {"ignored": [PAIR, {"kind": "electricity"}, "nonsense", None]},
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.ignored() == [PAIR]

    hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] = {"ignored": None}
    other = SuggestionStore(hass)
    await other.async_load()
    assert other.ignored() == []


async def test_clear_one_kind(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Clearing one tab keeps the ignores of the other one."""
    store = SuggestionStore(hass)
    await store.async_load()
    water = {"kind": "water", "stat": "sensor.tap", "parent": "sensor.main"}
    known = {*KNOWN, ("water", "sensor.tap"), ("water", "sensor.main")}
    await store.async_ignore(PAIR, known)
    await store.async_ignore(water, known)
    await store.async_clear("water")
    assert store.ignored() == [PAIR]
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {
        "ignored": [PAIR],
        "dismissed": [],
    }


HINT = {"code": "daily_reset", "kind": "electricity", "stat": "sensor.o1"}
HINT_KNOWN = {("electricity", "sensor.o1")}


async def test_store_migrates_v1_1(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Version 1.1 files only had `ignored`; they gain an empty `dismissed`."""
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {"ignored": [PAIR]},
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.ignored() == [PAIR]
    assert store.dismissed() == []
    await store.async_dismiss(HINT, HINT_KNOWN | KNOWN)
    saved = hass_storage[SUGGESTIONS_STORAGE_KEY]
    assert (saved["version"], saved["minor_version"]) == (1, 2)
    assert saved["data"] == {"ignored": [PAIR], "dismissed": [HINT]}


async def test_store_1_2_loads_in_older_releases(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Only the minor version grew, so 0.10.x (a plain version 1 store) still loads."""
    store = SuggestionStore(hass)
    await store.async_load()
    await store.async_dismiss(HINT, HINT_KNOWN | KNOWN)
    await store.async_ignore(PAIR, KNOWN)
    older: Store[dict[str, Any]] = Store(hass, 1, SUGGESTIONS_STORAGE_KEY)
    data = await older.async_load()
    assert data == {"ignored": [PAIR], "dismissed": [HINT]}


async def test_dismiss_hint_persists(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A dismissal is saved at once; a role keeps two hints of one stat apart."""
    store = SuggestionStore(hass)
    await store.async_load()
    grid = {**HINT, "code": "power_available", "role": "grid_import"}
    home = {**HINT, "code": "power_available", "role": "home"}
    await store.async_dismiss(HINT, HINT_KNOWN)
    await store.async_dismiss(HINT, HINT_KNOWN)
    await store.async_dismiss(grid, HINT_KNOWN)
    await store.async_dismiss(home, HINT_KNOWN)
    assert store.dismissed() == [HINT, grid, home]
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"]["dismissed"] == [
        HINT,
        grid,
        home,
    ]

    reloaded = SuggestionStore(hass)
    await reloaded.async_load()
    assert reloaded.dismissed() == [HINT, grid, home]


async def test_dismiss_hint_drops_unknown(hass: HomeAssistant) -> None:
    """Dismissals of statistics that left the settings are dropped."""
    store = SuggestionStore(hass)
    await store.async_load()
    gone = {**HINT, "stat": "sensor.gone"}
    await store.async_dismiss(gone, {("electricity", "sensor.gone")})
    await store.async_dismiss(HINT, HINT_KNOWN)
    assert store.dismissed() == [HINT]


async def test_clear_suggestions_brings_back_hints(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Clearing one kind clears its ignores and dismissals; all clears both."""
    store = SuggestionStore(hass)
    await store.async_load()
    water = {"code": "daily_reset", "kind": "water", "stat": "sensor.tap"}
    known = {*KNOWN, *HINT_KNOWN, ("water", "sensor.tap")}
    await store.async_ignore(PAIR, known)
    await store.async_dismiss(HINT, known)
    await store.async_dismiss(water, known)
    await store.async_clear("water")
    assert store.dismissed() == [HINT]
    assert store.ignored() == [PAIR]
    await store.async_clear()
    assert store.dismissed() == []
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {
        "ignored": [],
        "dismissed": [],
    }


async def test_load_skips_broken_dismissals(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Damaged dismissals are left out, a non-string role makes one invalid."""
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 2,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {
            "ignored": [],
            "dismissed": [
                HINT,
                {**HINT, "role": "home", "extra": 1},
                {**HINT, "role": 5},
                {"code": "daily_reset"},
                "nonsense",
            ],
        },
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.dismissed() == [HINT, {**HINT, "role": "home"}]

    hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] = {"dismissed": None}
    other = SuggestionStore(hass)
    await other.async_load()
    assert other.dismissed() == []


async def test_store_keeps_newer_minor_data(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A file from a newer minor version is loaded as it is."""
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 3,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {"ignored": [PAIR], "dismissed": [HINT]},
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.ignored() == [PAIR]
    assert store.dismissed() == [HINT]
