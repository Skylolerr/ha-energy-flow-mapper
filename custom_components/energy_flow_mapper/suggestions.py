"""Remember which suggestions an admin ignored, for every device and admin."""

from __future__ import annotations

from typing import Any, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import SUGGESTIONS_STORAGE_KEY, SUGGESTIONS_STORAGE_VERSION

_KEYS = ("kind", "stat", "parent")
_HINT_KEYS = ("code", "kind", "stat")


class SuggestionsData(TypedDict):
    """Content of the store file."""

    ignored: list[dict[str, str]]
    dismissed: list[dict[str, str]]


class _SuggestionsStore(Store[SuggestionsData]):
    """Store with the migration from version 1 (no dismissed hints)."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Add the empty list of dismissed hints to version 1 data."""
        return {**old_data, "dismissed": old_data.get("dismissed", [])}


def _hint_entry(raw: Any) -> dict[str, str] | None:
    """Return a valid dismissal `{code, kind, stat[, role]}`, or None."""
    if not isinstance(raw, dict) or not all(
        isinstance(raw.get(key), str) for key in _HINT_KEYS
    ):
        return None
    entry = {key: raw[key] for key in _HINT_KEYS}
    role = raw.get("role")
    if role is not None:
        if not isinstance(role, str):
            return None
        entry["role"] = role
    return entry


class SuggestionStore:
    """Ignored "included in" suggestions as `{kind, stat, parent}`.

    Also the dismissed hints as `{code, kind, stat}` plus `role` when the hint
    names one (a grid source and the home meter can share a statistic).

    Not an energy setting: not part of backups, export or import.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: _SuggestionsStore = _SuggestionsStore(
            hass, SUGGESTIONS_STORAGE_VERSION, SUGGESTIONS_STORAGE_KEY
        )
        self._ignored: list[dict[str, str]] = []
        self._dismissed: list[dict[str, str]] = []

    async def async_load(self) -> None:
        """Load the list from disk; damaged entries are left out."""
        data = await self._store.async_load()
        raw = data.get("ignored") if isinstance(data, dict) else None
        self._ignored = [
            {key: entry[key] for key in _KEYS}
            for entry in raw or []
            if isinstance(entry, dict)
            and all(isinstance(entry.get(key), str) for key in _KEYS)
        ]
        dismissed = data.get("dismissed") if isinstance(data, dict) else None
        self._dismissed = [
            entry
            for raw_entry in dismissed or []
            if (entry := _hint_entry(raw_entry)) is not None
        ]

    def ignored(self) -> list[dict[str, str]]:
        """Return the ignored suggestions."""
        return [dict(pair) for pair in self._ignored]

    async def async_ignore(
        self, pair: dict[str, str], known: set[tuple[str, str]]
    ) -> None:
        """Ignore a suggestion and save; `known` are the current (kind, stat).

        Ignores whose devices are no longer in the energy dashboard are
        dropped, the new one included.
        """
        pair = {"kind": pair["kind"], "stat": pair["stat"], "parent": pair["parent"]}
        ignored = [p for p in self._ignored if p != pair] + [pair]
        self._ignored = [
            p
            for p in ignored
            if (p["kind"], p["stat"]) in known and (p["kind"], p["parent"]) in known
        ]
        await self._async_save()

    def dismissed(self) -> list[dict[str, str]]:
        """Return the dismissed hints."""
        return [dict(hint) for hint in self._dismissed]

    async def async_dismiss(
        self, hint: dict[str, str], known: set[tuple[str, str]]
    ) -> None:
        """Dismiss a hint and save; `known` are the current (kind, stat).

        Dismissals of statistics that are no longer in the energy dashboard
        are dropped, the new one included.
        """
        entry = {key: hint[key] for key in (*_HINT_KEYS, "role") if key in hint}
        dismissed = [d for d in self._dismissed if d != entry] + [entry]
        self._dismissed = [d for d in dismissed if (d["kind"], d["stat"]) in known]
        await self._async_save()

    async def async_clear(self, kind: str | None = None) -> None:
        """Show the suggestions and hints of `kind` again, or all of them."""
        self._ignored = [
            p for p in self._ignored if kind is not None and p["kind"] != kind
        ]
        self._dismissed = [
            h for h in self._dismissed if kind is not None and h["kind"] != kind
        ]
        await self._async_save()

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._ignored = []
        self._dismissed = []
        await self._store.async_remove()

    async def _async_save(self) -> None:
        await self._store.async_save(
            {"ignored": self._ignored, "dismissed": self._dismissed}
        )
