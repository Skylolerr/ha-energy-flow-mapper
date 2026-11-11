"""Keep the device groups in their own store file.

Groups are purely visual; they are not part of HA's energy preferences.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import GROUPS_STORAGE_KEY, GROUPS_STORAGE_VERSION
from .groups import GROUP_KINDS, Group, Groups, empty_groups

GROUPS_STORAGE_MINOR_VERSION = 1


class GroupsData(TypedDict):
    """Content of the store file."""

    groups: Groups


class _GroupsStore(Store[GroupsData]):
    """Store with the migration hook for later format changes."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Return the data unchanged; there is only one format so far."""
        return old_data


def _is_group(raw: object) -> bool:
    """Return whether `raw` has the fields of a group with the right types."""
    if not isinstance(raw, dict):
        return False
    if "parent" not in raw or "group" not in raw:
        return False
    members = raw.get("members")
    return (
        isinstance(raw.get("id"), str)
        and isinstance(raw.get("name"), str)
        and (raw.get("parent") is None or isinstance(raw.get("parent"), str))
        and (raw.get("group") is None or isinstance(raw.get("group"), str))
        and isinstance(members, list)
        and all(isinstance(member, str) for member in members)
    )


class GroupStore:
    """The device groups of every kind, loaded tolerantly and saved at once."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: _GroupsStore = _GroupsStore(
            hass,
            GROUPS_STORAGE_VERSION,
            GROUPS_STORAGE_KEY,
            minor_version=GROUPS_STORAGE_MINOR_VERSION,
        )
        self._groups: Groups = empty_groups()

    async def async_load(self) -> None:
        """Load the groups; damaged entries are left out."""
        data = await self._store.async_load()
        raw = data.get("groups") if isinstance(data, dict) else None
        groups = empty_groups()
        if isinstance(raw, dict):
            for kind in GROUP_KINDS:
                entries = raw.get(kind.value)
                if not isinstance(entries, list):
                    continue
                groups[kind.value] = [
                    Group(
                        id=entry["id"],
                        name=entry["name"],
                        parent=entry["parent"],
                        group=entry["group"],
                        members=list(entry["members"]),
                    )
                    for entry in entries
                    if _is_group(entry)
                ]
        self._groups = groups

    def groups(self) -> Groups:
        """Return a copy of the groups."""
        return deepcopy(self._groups)

    async def async_save(self, groups: Groups) -> None:
        """Replace the groups and save them."""
        self._groups = deepcopy(groups)
        await self._store.async_save({"groups": self._groups})

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._groups = empty_groups()
        await self._store.async_remove()
