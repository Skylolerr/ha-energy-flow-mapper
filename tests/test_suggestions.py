"""Tests for the store of ignored suggestions."""

from __future__ import annotations

from typing import Any

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper.const import SUGGESTIONS_STORAGE_KEY
from custom_components.energy_flow_mapper.suggestions import SuggestionStore, _recent

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
    assert (saved["version"], saved["minor_version"]) == (1, 3)
    assert saved["data"] == {"ignored": [PAIR], "dismissed": [HINT]}


async def test_store_1_3_loads_in_older_releases(
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
        "minor_version": 4,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {"ignored": [PAIR], "dismissed": [HINT]},
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.ignored() == [PAIR]
    assert store.dismissed() == [HINT]


GROSS = {"code": "gross_off", "kind": "electricity", "stat": "sensor.o1"}
TERM = {
    "code": "solar_term_short",
    "kind": "electricity",
    "stat": "sensor.o1",
    "role": "production",
}
NOW = "2026-11-24 12:00:00+00:00"


async def test_store_migrates_v1_2_drops_eventless_safety_net(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Safety-net dismissals of 1.2 had no event and hid every later one: dropped."""
    others = [HINT, {**HINT, "code": "power_available", "role": "home"}]
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 2,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {
            "ignored": [PAIR],
            "dismissed": [
                others[0],
                GROSS,
                {**GROSS, "code": "gross_unknown"},
                TERM,
                {**TERM, "code": "solar_term_high"},
                others[1],
            ],
        },
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.ignored() == [PAIR]
    assert store.dismissed() == others
    saved = hass_storage[SUGGESTIONS_STORAGE_KEY]
    assert (saved["version"], saved["minor_version"]) == (1, 3)
    assert saved["data"] == {"ignored": [PAIR], "dismissed": others}


async def test_dismiss_safety_net_hint_for_its_event(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    freezer: FrozenDateTimeFactory,
) -> None:
    """A safety-net dismissal names its hour or day; one without is not kept."""
    freezer.move_to(NOW)
    store = SuggestionStore(hass)
    await store.async_load()
    at_h = {**GROSS, "hour": "2026-11-24T08:00:00+01:00"}
    at_h3 = {**GROSS, "hour": "2026-11-24T11:00:00+01:00"}
    gap = {**GROSS, "code": "gross_unknown", "hour": "2026-11-24T08:00:00+01:00"}
    day = {**TERM, "day": "2026-11-23"}
    # A field of another event code is not kept on other codes.
    plain = {**HINT, "hour": "2026-11-24T08:00:00+01:00"}
    for hint in (at_h, at_h3, gap, day, plain, GROSS, {**TERM, "hour": "x"}):
        await store.async_dismiss(hint, HINT_KNOWN)
    assert store.dismissed() == [at_h, at_h3, gap, day, HINT]
    assert hass_storage[SUGGESTIONS_STORAGE_KEY]["data"]["dismissed"] == [
        at_h,
        at_h3,
        gap,
        day,
        HINT,
    ]
    reloaded = SuggestionStore(hass)
    await reloaded.async_load()
    assert reloaded.dismissed() == [at_h, at_h3, gap, day, HINT]


async def test_event_dismissals_are_pruned_after_the_watch_window(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory
) -> None:
    """Events older than 7 days left the safety net; so do their dismissals."""
    freezer.move_to(NOW)
    store = SuggestionStore(hass)
    await store.async_load()
    old_hour = {**GROSS, "hour": "2026-11-17T11:00:00+00:00"}
    kept_hour = {**GROSS, "hour": "2026-11-17T13:00:00+01:00"}
    old_day = {**TERM, "day": "2026-11-16"}
    kept_day = {**TERM, "day": "2026-11-17"}
    broken = {**GROSS, "hour": "yesterday"}
    broken_day = {**TERM, "day": "soon"}
    for hint in (old_hour, kept_hour, old_day, kept_day, broken, broken_day, HINT):
        await store.async_dismiss(hint, HINT_KNOWN)
    assert store.dismissed() == [kept_hour, kept_day, HINT]
    # Seven more days: only the dismissal without an event stays.
    freezer.move_to("2026-12-01 12:00:00+00:00")
    await store.async_clear("water")
    assert store.dismissed() == [HINT]


async def test_naive_event_time_never_breaks_the_store(
    hass: HomeAssistant,
    hass_storage: dict[str, Any],
    freezer: FrozenDateTimeFactory,
) -> None:
    """An hour without a time zone, or a bad day, is no dismissal.

    It is dropped when given and when loaded, so later dismissals and ignores
    still save.
    """
    freezer.move_to(NOW)
    naive = {**GROSS, "hour": "2026-11-24T10:00:00"}
    hass_storage[SUGGESTIONS_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 3,
        "key": SUGGESTIONS_STORAGE_KEY,
        "data": {
            "ignored": [],
            "dismissed": [naive, {**TERM, "day": "2026-11-24T10:00:00+00:00"}],
        },
    }
    store = SuggestionStore(hass)
    await store.async_load()
    assert store.dismissed() == []
    await store.async_dismiss(naive, HINT_KNOWN)
    assert store.dismissed() == []
    await store.async_dismiss(HINT, HINT_KNOWN)
    await store.async_ignore(PAIR, KNOWN)
    assert store.dismissed() == [HINT]
    assert store.ignored() == [PAIR]


def test_recent_skips_a_naive_or_broken_event() -> None:
    """A stored event that cannot be compared is not recent; nothing raises."""
    since = dt_util.utcnow()
    assert _recent({**GROSS, "hour": "2026-11-24T10:00:00"}, since) is False
    assert _recent({**GROSS, "hour": "soon"}, since) is False
    assert _recent({**TERM, "day": "soon"}, since) is False
