"""Backups of the energy preferences, stored before every write."""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import MAX_BACKUPS, STORAGE_KEY, STORAGE_VERSION


class Backup(TypedDict):
    """One backup: the previous content of the keys that were changed."""

    id: str
    created: str
    user_id: str | None
    user_name: str | None
    summary: dict[str, int]
    data: dict[str, list[Any]]


class BackupData(TypedDict):
    """Content of the store file; the newest backup is last."""

    backups: list[Backup]


class BackupStore:
    """Keep the last MAX_BACKUPS backups in `.storage`."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: Store[BackupData] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._backups: list[Backup] = []
        # Backups dropped by the last async_add, returned by async_discard.
        self._dropped: list[Backup] = []

    async def async_load(self) -> None:
        """Load the backups from disk."""
        data = await self._store.async_load()
        self._backups = list(data["backups"]) if data else []

    def entries(self) -> list[dict[str, Any]]:
        """Return the backups without their content, newest first."""
        return [
            {key: value for key, value in backup.items() if key != "data"}
            for backup in reversed(self._backups)
        ]

    def get(self, backup_id: str) -> Backup | None:
        """Return a backup by ID."""
        return next((b for b in self._backups if b["id"] == backup_id), None)

    async def async_add(
        self,
        data: dict[str, list[Any]],
        user_id: str | None,
        user_name: str | None,
        summary: dict[str, int],
    ) -> str:
        """Store a backup immediately and drop the oldest ones beyond the limit."""
        backup: Backup = {
            "id": uuid4().hex,
            "created": dt_util.utcnow().isoformat(),
            "user_id": user_id,
            "user_name": user_name,
            "summary": summary,
            "data": data,
        }
        backups = [*self._backups, backup]
        self._dropped = backups[:-MAX_BACKUPS]
        self._backups = backups[-MAX_BACKUPS:]
        await self._async_save()
        return backup["id"]

    async def async_discard(self, backup_id: str) -> None:
        """Remove a backup whose write did not happen.

        The backups that adding it dropped beyond the limit come back.
        """
        self._backups = [
            *self._dropped,
            *(b for b in self._backups if b["id"] != backup_id),
        ]
        self._dropped = []
        await self._async_save()

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._backups = []
        await self._store.async_remove()

    async def _async_save(self) -> None:
        await self._store.async_save({"backups": self._backups})
