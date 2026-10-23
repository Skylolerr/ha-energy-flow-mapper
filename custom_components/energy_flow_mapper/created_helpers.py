"""Remember which helpers the panel created, so it can label them."""

from __future__ import annotations

from typing import TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import HELPERS_STORAGE_KEY, HELPERS_STORAGE_VERSION


class CreatedHelpersData(TypedDict):
    """Content of the store file."""

    entries: list[str]


class CreatedHelpers:
    """Config entry IDs of helpers created by Energy Flow Mapper.

    Only a label: the helpers belong to Home Assistant and stay when Energy
    Flow Mapper is removed.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: Store[CreatedHelpersData] = Store(
            hass, HELPERS_STORAGE_VERSION, HELPERS_STORAGE_KEY
        )
        self._entries: list[str] = []

    async def async_load(self) -> None:
        """Load the list from disk."""
        data = await self._store.async_load()
        self._entries = list(data["entries"]) if data else []

    def entries(self) -> list[str]:
        """Return the config entry IDs."""
        return list(self._entries)

    async def async_add(self, entry_id: str) -> None:
        """Remember a created helper and save immediately."""
        if entry_id not in self._entries:
            self._entries.append(entry_id)
        await self._store.async_save({"entries": self._entries})

    async def async_remove(self) -> None:
        """Delete the store file; the helpers themselves stay."""
        self._entries = []
        await self._store.async_remove()
