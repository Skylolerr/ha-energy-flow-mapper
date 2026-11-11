"""Backups of the energy preferences, stored before every write."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, NotRequired, TypedDict
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_MAX_BACKUPS,
    STORAGE_KEY,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
)
from .groups import Groups


class Backup(TypedDict):
    """One backup: the previous content of the keys that were changed."""

    id: str
    created: str
    user_id: str | None
    user_name: str | None
    summary: dict[str, int]
    data: dict[str, list[Any]]
    # The groups before the change; missing in backups made before groups existed.
    groups: NotRequired[Groups]


class BackupData(TypedDict):
    """Content of the store file; the newest backup is last."""

    backups: list[Backup]


class _BackupsStore(Store[BackupData]):
    """Store with the migration hook for format changes."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Return the data unchanged: minor version 2 only adds an optional field."""
        return old_data


class BackupStore:
    """Keep the last `limit` backups in `.storage`."""

    def __init__(self, hass: HomeAssistant, limit: int = DEFAULT_MAX_BACKUPS) -> None:
        """Create the store; call async_load before use."""
        self._store: _BackupsStore = _BackupsStore(
            hass, STORAGE_VERSION, STORAGE_KEY, minor_version=STORAGE_MINOR_VERSION
        )
        self._limit = limit
        self._backups: list[Backup] = []
        # Backups dropped by the last async_add, returned by async_discard.
        self._dropped: list[Backup] = []

    async def async_load(self) -> None:
        """Load the backups from disk.

        When the limit was lowered in the options, the oldest backups beyond
        it are deleted right away.
        """
        data = await self._store.async_load()
        self._backups = list(data["backups"]) if data else []
        if len(self._backups) > self._limit:
            self._backups = self._backups[-self._limit :]
            await self._async_save()

    @property
    def limit(self) -> int:
        """Return how many backups are kept."""
        return self._limit

    def entries(self) -> list[dict[str, Any]]:
        """Return the backups without their content (data, groups), newest first."""
        return [
            {
                key: value
                for key, value in backup.items()
                if key not in ("data", "groups")
            }
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
        groups: Groups | None = None,
    ) -> str:
        """Store a backup immediately and drop the oldest ones beyond the limit.

        `groups` are the groups before the change; leave them out when the change
        did not touch them.
        """
        backup: Backup = {
            "id": uuid4().hex,
            "created": dt_util.utcnow().isoformat(),
            "user_id": user_id,
            "user_name": user_name,
            "summary": summary,
            "data": data,
        }
        if groups is not None:
            backup["groups"] = deepcopy(groups)
        backups = [*self._backups, backup]
        self._dropped = backups[: -self._limit]
        self._backups = backups[-self._limit :]
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
