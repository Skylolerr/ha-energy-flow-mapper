"""Tests for the store of ignored suggestions."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

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
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {"ignored": [PAIR]}

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
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"] == {"ignored": []}


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
