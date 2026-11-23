"""Remember which helpers the panel created, so it can label and reuse them."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    HELPERS_STORAGE_KEY,
    HELPERS_STORAGE_MINOR_VERSION,
    HELPERS_STORAGE_VERSION,
)

type Record = dict[str, Any]


class CreatedHelpersData(TypedDict):
    """Content of the store file."""

    entries: list[str]
    # Entry ID -> what the helper was made for (`kind` and its inputs).
    records: dict[str, Record]


class _HelpersStore(Store[CreatedHelpersData]):
    """Store with the migration from version 1.1 (IDs only)."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Add the empty records to version 1.1 data."""
        if old_minor_version < 2:
            return {**old_data, "records": old_data.get("records", {})}
        return old_data


class CreatedHelpers:
    """Config entry IDs of helpers created by Energy Flow Mapper.

    Only a label: the helpers belong to Home Assistant and stay when Energy
    Flow Mapper is removed. A helper can have a record of what it was made
    for; the solar setup reuses its solar terms by it, and the hints find
    the gross meters it made.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store = _HelpersStore(
            hass,
            HELPERS_STORAGE_VERSION,
            HELPERS_STORAGE_KEY,
            minor_version=HELPERS_STORAGE_MINOR_VERSION,
        )
        self._entries: list[str] = []
        self._records: dict[str, Record] = {}

    async def async_load(self) -> None:
        """Load the list from disk; records of unknown IDs are left out."""
        data = await self._store.async_load()
        self._entries = list(data["entries"]) if data else []
        raw = data.get("records") if data else None
        self._records = {
            entry_id: dict(record)
            for entry_id, record in (raw.items() if isinstance(raw, dict) else ())
            if entry_id in self._entries and isinstance(record, dict)
        }

    def entries(self) -> list[str]:
        """Return the config entry IDs."""
        return list(self._entries)

    def records(self) -> dict[str, Record]:
        """Return entry ID -> record, for the helpers that have one."""
        return {entry_id: dict(record) for entry_id, record in self._records.items()}

    def record(self, entry_id: str) -> Record | None:
        """Return the record of one helper, or None."""
        record = self._records.get(entry_id)
        return dict(record) if record is not None else None

    async def _async_save(self) -> None:
        await self._store.async_save(
            {"entries": self._entries, "records": self._records}
        )

    async def async_add(
        self, entry_id: str, record: Mapping[str, Any] | None = None
    ) -> None:
        """Remember a created helper (and what it is for); save immediately."""
        if entry_id not in self._entries:
            self._entries.append(entry_id)
        if record is not None:
            self._records[entry_id] = dict(record)
        await self._async_save()

    async def async_discard(self, entry_id: str) -> None:
        """Forget one helper (it was removed again) and save immediately."""
        if entry_id in self._entries:
            self._entries.remove(entry_id)
            self._records.pop(entry_id, None)
            await self._async_save()

    async def async_remove(self) -> None:
        """Delete the store file; the helpers themselves stay."""
        self._entries = []
        self._records = {}
        await self._store.async_remove()
