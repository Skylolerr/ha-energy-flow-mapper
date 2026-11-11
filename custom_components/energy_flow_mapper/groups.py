"""Pure functions for device groups.

A group is a purely visual frame around some children of one real parent (a device,
or Home). It never changes Home Assistant's energy preferences. Like `hierarchy.py`
this module has no Home Assistant imports, so it can be tested in isolation.
"""

from __future__ import annotations

from copy import deepcopy
from typing import TypedDict

from .hierarchy import DEVICE_KEYS, DeviceKind, Prefs, parent_map

# The kinds that can have groups (gas has no devices).
GROUP_KINDS = (DeviceKind.ELECTRICITY, DeviceKind.WATER)


class Group(TypedDict):
    """A group of devices below one real parent.

    `parent` is the real parent statistic (None = Home), `group` the enclosing group
    id (None = top level of its parent) and `members` the device statistics directly
    in this group.
    """

    id: str
    name: str
    parent: str | None
    group: str | None
    members: list[str]


type Groups = dict[str, list[Group]]


def empty_groups() -> Groups:
    """Return groups with an empty list for every kind."""
    return {kind.value: [] for kind in GROUP_KINDS}


def groups_of(groups: Groups, kind: DeviceKind) -> list[Group]:
    """Return the groups of one kind (empty if there are none)."""
    return groups.get(kind.value, [])


def all_devices(groups: list[Group], group_id: str) -> list[str]:
    """Return the devices of a group and its nested groups, in order."""
    devices: list[str] = []
    visited: set[str] = set()

    def collect(current: str) -> None:
        if current in visited:
            return
        visited.add(current)
        for group in groups:
            if group["id"] == current:
                devices.extend(group["members"])
        for group in groups:
            if group["group"] == current:
                collect(group["id"])

    collect(group_id)
    return devices


def _enclosing_loops(groups: list[Group], group: Group) -> bool:
    """Return whether following `group` upwards leads back to the group itself."""
    by_id = {g["id"]: g for g in groups}
    seen: set[str] = set()
    current = group["group"]
    while current is not None and current in by_id and current not in seen:
        if current == group["id"]:
            return True
        seen.add(current)
        current = by_id[current]["group"]
    return False


def _clean_kind(groups: list[Group], parents: dict[str, str | None]) -> list[Group]:
    """Clean the groups of one kind against its device parents."""
    # 1. Drop members whose device is gone; a device stays only in its first group.
    seen: set[str] = set()
    for group in groups:
        kept: list[str] = []
        for stat in group["members"]:
            if stat in parents and stat not in seen:
                seen.add(stat)
                kept.append(stat)
        group["members"] = kept

    # 2. A group whose devices all moved to one other parent adopts that parent.
    for group in groups:
        real = {parents[stat] for stat in all_devices(groups, group["id"])}
        if group["parent"] not in real and len(real) == 1:
            group["parent"] = next(iter(real))

    # 3. Drop members whose real parent differs from the group's parent.
    for group in groups:
        group["members"] = [
            s for s in group["members"] if parents[s] == group["parent"]
        ]

    # 4. A nested group with another parent than its enclosing group (or with an
    #    unknown or looping enclosing group) moves to the top level of its parent.
    by_id = {g["id"]: g for g in groups}
    for group in groups:
        enclosing = by_id.get(group["group"]) if group["group"] is not None else None
        if group["group"] is not None and (
            enclosing is None
            or enclosing["parent"] != group["parent"]
            or _enclosing_loops(groups, group)
        ):
            group["group"] = None

    # 5. Groups without any device (recursively) disappear.
    return [g for g in groups if all_devices(groups, g["id"])]


def clean_groups(groups: Groups, prefs: Prefs) -> Groups:
    """Return the groups fitted to the current energy preferences.

    Never mutates `groups`; the result is a new object with a list for every kind.
    """
    cleaned = empty_groups()
    for kind in GROUP_KINDS:
        stored = deepcopy(groups.get(kind.value, []))
        parents = parent_map(prefs.get(DEVICE_KEYS[kind], []))
        cleaned[kind.value] = _clean_kind(stored, parents)
    return cleaned
