"""Remember which suggestions an admin ignored, for every device and admin."""

from __future__ import annotations

from typing import TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import SUGGESTIONS_STORAGE_KEY, SUGGESTIONS_STORAGE_VERSION

_KEYS = ("kind", "stat", "parent")


class SuggestionsData(TypedDict):
    """Content of the store file."""

    ignored: list[dict[str, str]]


class SuggestionStore:
    """Ignored "included in" suggestions as `{kind, stat, parent}`.

    Not an energy setting: not part of backups, export or import.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: Store[SuggestionsData] = Store(
            hass, SUGGESTIONS_STORAGE_VERSION, SUGGESTIONS_STORAGE_KEY
        )
        self._ignored: list[dict[str, str]] = []

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

    async def async_clear(self, kind: str | None = None) -> None:
        """Show the suggestions of `kind` again, or all of them."""
        self._ignored = [
            p for p in self._ignored if kind is not None and p["kind"] != kind
        ]
        await self._async_save()

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._ignored = []
        await self._store.async_remove()

    async def _async_save(self) -> None:
        await self._store.async_save({"ignored": self._ignored})
