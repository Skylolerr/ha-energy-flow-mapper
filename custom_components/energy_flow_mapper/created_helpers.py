"""Remember which helpers the panel created, so it can label and reuse them."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    HELPER_RECORDS_STORAGE_KEY,
    HELPER_RECORDS_STORAGE_VERSION,
    HELPERS_STORAGE_KEY,
    HELPERS_STORAGE_MINOR_VERSION,
    HELPERS_STORAGE_VERSION,
)

type Record = dict[str, Any]


class CreatedHelpersData(TypedDict):
    """Content of the helpers file (the one 0.10.x knows too)."""

    entries: list[str]


class HelperRecordsData(TypedDict):
    """Content of the records file."""

    # Entry ID -> what the helper was made for (`kind` and its inputs).
    records: dict[str, Record]


class _HelpersStore(Store[CreatedHelpersData]):
    """Helpers file; versions 1.1 and 1.2 load as they are.

    1.2 also held the records. `CreatedHelpers.async_load` moves them to the
    records file before this file is saved without them, so they are kept
    here until then.
    """

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Return the data unchanged (see the class)."""
        return old_data


def _records_of(data: Mapping[str, Any] | None) -> dict[str, Record]:
    """Return the well-formed records of a loaded file."""
    raw = data.get("records") if data else None
    if not isinstance(raw, dict):
        return {}
    return {
        str(entry_id): dict(record)
        for entry_id, record in raw.items()
        if isinstance(record, dict)
    }


class CreatedHelpers:
    """Config entry IDs of helpers created by Energy Flow Mapper.

    Only a label: the helpers belong to Home Assistant and stay when Energy
    Flow Mapper is removed. A helper can have a record of what it was made
    for; the solar setup reuses its solar terms by it, and the hints find
    the gross meters it made.

    The records live in a file of their own (`HELPER_RECORDS_STORAGE_KEY`):
    0.10.x loads and saves the helpers file with the IDs only, and so would
    drop records kept in it. It never touches the records file. Every change
    writes the records file first, then the helpers file.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the stores; call async_load before use."""
        self._store = _HelpersStore(
            hass,
            HELPERS_STORAGE_VERSION,
            HELPERS_STORAGE_KEY,
            minor_version=HELPERS_STORAGE_MINOR_VERSION,
        )
        self._records_store: Store[HelperRecordsData] = Store(
            hass, HELPER_RECORDS_STORAGE_VERSION, HELPER_RECORDS_STORAGE_KEY
        )
        self._entries: list[str] = []
        self._records: dict[str, Record] = {}

    async def async_load(self) -> None:
        """Load both files; records of IDs not on the list are left out.

        Records still in the helpers file (1.2) move once to the records
        file, which wins where both have one. The records file is saved
        before the helpers file loses them: a crash in between loses nothing.
        """
        data: Mapping[str, Any] | None = await self._store.async_load()
        stored: Mapping[str, Any] | None = await self._records_store.async_load()
        self._entries = list(data["entries"]) if data else []
        merged = _records_of(data) | _records_of(stored)
        self._records = {
            entry_id: record
            for entry_id, record in merged.items()
            if entry_id in self._entries
        }
        if data is not None and "records" in data:
            await self._save_records()
            await self._save_entries()

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

    async def _save_entries(self) -> None:
        await self._store.async_save({"entries": self._entries})

    async def _save_records(self) -> None:
        await self._records_store.async_save({"records": self._records})

    async def async_add(
        self, entry_id: str, record: Mapping[str, Any] | None = None
    ) -> None:
        """Remember a created helper (and what it is for); save immediately."""
        if record is not None:
            self._records[entry_id] = dict(record)
            await self._save_records()
        if entry_id not in self._entries:
            self._entries.append(entry_id)
        await self._save_entries()

    async def async_discard(self, entry_id: str) -> None:
        """Forget one helper (it was removed again) and save immediately."""
        if entry_id in self._entries:
            if self._records.pop(entry_id, None) is not None:
                await self._save_records()
            self._entries.remove(entry_id)
            await self._save_entries()

    async def async_remove(self) -> None:
        """Delete both files; the helpers themselves stay."""
        self._entries = []
        self._records = {}
        await self._records_store.async_remove()
        await self._store.async_remove()
