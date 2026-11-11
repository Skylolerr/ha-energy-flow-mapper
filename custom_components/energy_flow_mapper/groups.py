"""Pure functions for device groups.

A group is a purely visual frame around some children of one real parent (a device,
or Home). It never changes Home Assistant's energy preferences. Like `hierarchy.py`
this module has no Home Assistant imports, so it can be tested in isolation.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
from typing import Any, TypedDict

from .hierarchy import (
    DEVICE_KEYS,
    PARENT,
    STAT,
    ChangeError,
    ChangeType,
    DeviceKind,
    Prefs,
    apply_changes,
    parent_map,
    prefs_hash,
)

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


def is_group(raw: object) -> bool:
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


# --- Applying changes -------------------------------------------------------

GROUP_CHANGE_TYPES: frozenset[str] = frozenset(
    {
        "create_group",
        "rename_group",
        "set_group",
        "dissolve_group",
        "move_group",
    }
)


def _find(groups: list[Group], group_id: str | None) -> Group:
    """Return the group with this id or raise `unknown_group`."""
    for group in groups:
        if group["id"] == group_id:
            return group
    raise ChangeError("unknown_group", str(group_id))


def _nested_ids(groups: list[Group], group_id: str) -> set[str]:
    """Return the id of a group and the ids of all groups nested in it."""
    found = {group_id}
    grew = True
    while grew:
        grew = False
        for group in groups:
            if group["group"] in found and group["id"] not in found:
                found.add(group["id"])
                grew = True
    return found


def _check_name(
    groups: list[Group], name: str, parent: str | None, own_id: str | None
) -> str:
    """Return the stripped name; it must be set and unique below its parent."""
    name = name.strip()
    if not name:
        raise ChangeError("group_name_empty", own_id or "")
    if any(
        g["name"] == name and g["parent"] == parent and g["id"] != own_id
        for g in groups
    ):
        raise ChangeError("group_name_taken", name)
    return name


def _take_out(groups: list[Group], stat: str) -> None:
    """Remove a device from whatever group holds it."""
    for group in groups:
        group["members"] = [m for m in group["members"] if m != stat]


def _create_group(
    groups: list[Group], parents: dict[str, str | None], change: Mapping[str, Any]
) -> None:
    group_id: str = change["id"]
    parent: str | None = change.get("parent")
    if any(g["id"] == group_id for g in groups):
        raise ChangeError("group_exists", group_id)
    name = _check_name(groups, change.get("name") or "", parent, None)
    members: list[str] = list(change.get("members", []))
    for stat in members:
        if stat not in parents:
            raise ChangeError("unknown_device", stat)
        if parents[stat] != parent:
            raise ChangeError("group_parents_differ", stat)
    nested = [_find(groups, nested_id) for nested_id in change.get("groups", [])]
    for child in nested:
        if child["parent"] != parent:
            raise ChangeError("group_parents_differ", child["id"])
    enclosing_id: str | None = change.get("group")
    if enclosing_id is not None:
        enclosing = _find(groups, enclosing_id)
        if enclosing["parent"] != parent:
            raise ChangeError("group_parents_differ", enclosing_id)
        below = set().union(*(_nested_ids(groups, c["id"]) for c in nested))
        if enclosing_id in below:
            raise ChangeError("group_loop", enclosing_id)
    for stat in members:
        _take_out(groups, stat)
    for child in nested:
        child["group"] = group_id
    groups.append(
        {
            "id": group_id,
            "name": name,
            "parent": parent,
            "group": enclosing_id,
            "members": members,
        }
    )


def _set_group(
    groups: list[Group], parents: dict[str, str | None], change: Mapping[str, Any]
) -> None:
    stat: str | None = change.get("stat")
    group_id: str | None = change.get("group_id")
    if (stat is None) == (group_id is None):
        raise ChangeError("unknown_change", stat or group_id or "")
    target_id: str | None = change.get("group")
    target = _find(groups, target_id) if target_id is not None else None
    if stat is not None:
        if stat not in parents:
            raise ChangeError("unknown_device", stat)
        if target is not None and target["parent"] != parents[stat]:
            raise ChangeError("group_parents_differ", stat)
        _take_out(groups, stat)
        if target is not None:
            target["members"].append(stat)
        return
    group = _find(groups, group_id)
    if target is not None:
        if target["parent"] != group["parent"]:
            raise ChangeError("group_parents_differ", group["id"])
        if target["id"] in _nested_ids(groups, group["id"]):
            raise ChangeError("group_loop", group["id"])
    group["group"] = target_id


def _dissolve_group(groups: list[Group], group_id: str) -> None:
    group = _find(groups, group_id)
    enclosing = group["group"]
    if enclosing is not None:
        _find(groups, enclosing)["members"].extend(group["members"])
    for other in groups:
        if other["group"] == group_id:
            other["group"] = enclosing
    groups.remove(group)


def _move_group(
    prefs: dict[str, Any],
    groups: list[Group],
    kind: DeviceKind,
    change: Mapping[str, Any],
) -> dict[str, Any]:
    """Move a group; return the preferences with its devices moved."""
    group = _find(groups, change["id"])
    parent: str | None = change.get("parent")
    devices = all_devices(groups, group["id"])
    if parent is not None:
        if parent in devices:
            raise ChangeError("group_loop", parent)
        known = {d[STAT] for d in prefs.get(DEVICE_KEYS[kind], [])}
        if parent not in known:
            raise ChangeError("unknown_device", parent)
    enclosing_id: str | None = change.get("group")
    nested = _nested_ids(groups, group["id"])
    for other in groups:
        if other["id"] in nested:
            _check_name(groups, other["name"], parent, other["id"])
    if enclosing_id is not None:
        enclosing = _find(groups, enclosing_id)
        if enclosing_id in nested:
            raise ChangeError("group_loop", enclosing_id)
        if enclosing["parent"] != parent:
            raise ChangeError("group_parents_differ", enclosing_id)
    moves = [
        {"type": ChangeType.MOVE, "stat": stat, "parent": parent, "kind": kind}
        for stat in devices
    ]
    result = apply_changes(prefs, moves)
    for other in groups:
        if other["id"] in nested:
            other["parent"] = parent
    group["group"] = enclosing_id
    return result


def _apply_group_change(
    prefs: dict[str, Any], groups: Groups, change: Mapping[str, Any]
) -> dict[str, Any]:
    """Apply one group change to `groups` (in place); return the preferences."""
    kind = DeviceKind(change.get("kind", DeviceKind.ELECTRICITY))
    kind_groups = groups.setdefault(kind.value, [])
    parents = parent_map(prefs.get(DEVICE_KEYS[kind], []))
    change_type = change["type"]
    if change_type == "create_group":
        _create_group(kind_groups, parents, change)
    elif change_type == "rename_group":
        group = _find(kind_groups, change["id"])
        group["name"] = _check_name(
            kind_groups, change.get("name") or "", group["parent"], group["id"]
        )
    elif change_type == "set_group":
        _set_group(kind_groups, parents, change)
    elif change_type == "dissolve_group":
        _dissolve_group(kind_groups, change["id"])
    else:
        return _move_group(prefs, kind_groups, kind, change)
    return prefs


def _adopt_removed_parent(
    prefs: Prefs, groups: Groups, kind: DeviceKind, stat: str
) -> None:
    """Re-parent the groups below a device that is about to disappear.

    Its children move up to its own parent, so its groups go with them and the
    grouping survives the clean-up.
    """
    devices = prefs.get(DEVICE_KEYS[kind], [])
    former = next((d.get(PARENT) for d in devices if d[STAT] == stat), None)
    for group in groups.get(kind.value, []):
        if group["parent"] == stat:
            group["parent"] = former


def _leave_group_on_move(groups: Groups, change: Mapping[str, Any]) -> None:
    """Take a device out of its group when it moves to another parent."""
    kind = DeviceKind(change.get("kind", DeviceKind.ELECTRICITY))
    kind_groups = groups.get(kind.value, [])
    for group in kind_groups:
        if change["stat"] in group["members"] and group["parent"] != change.get(
            "parent"
        ):
            _take_out(kind_groups, change["stat"])
            return


def apply_all(
    prefs: Prefs, groups: Groups, changes: Sequence[Mapping[str, Any]]
) -> tuple[dict[str, Any], Groups]:
    """Apply device, source and group changes strictly in order.

    Returns the new preferences and groups; the inputs stay untouched. After every
    change the groups are cleaned against the new preferences.
    """
    current: dict[str, Any] = apply_changes(prefs, [])
    result = deepcopy(groups)
    for change in changes:
        change_type = change["type"]
        if change_type in GROUP_CHANGE_TYPES:
            current = _apply_group_change(current, result, change)
        else:
            if change_type in (ChangeType.REMOVE, ChangeType.USE_AS_HOME_METER):
                kind = (
                    DeviceKind.ELECTRICITY
                    if change_type == ChangeType.USE_AS_HOME_METER
                    else DeviceKind(change.get("kind", DeviceKind.ELECTRICITY))
                )
                _adopt_removed_parent(current, result, kind, change["stat"])
            elif change_type == ChangeType.MOVE:
                _leave_group_on_move(result, change)
            current = apply_changes(current, [change])
        result = clean_groups(result, current)
    return current, result


# --- Diff and hash ----------------------------------------------------------


def _entry(kind: DeviceKind, change: str, group: Group, **extra: Any) -> dict[str, Any]:
    """Return a diff entry of a group; the panel keys entries by `stat`."""
    return {
        "type": change,
        "id": group["id"],
        "name": group["name"],
        **extra,
        "kind": kind,
        "stat": f"group:{group['id']}",
    }


def diff_groups(old: Groups, new: Groups) -> list[dict[str, Any]]:
    """Describe how the groups changed, for confirmations and backups."""
    created: list[dict[str, Any]] = []
    later: list[dict[str, Any]] = []
    for kind in GROUP_KINDS:
        before = groups_of(old, kind)
        after = groups_of(new, kind)
        old_ids = {g["id"] for g in before}
        new_by_id = {g["id"]: g for g in after}
        created.extend(
            _entry(kind, "group_created", g, count=len(all_devices(after, g["id"])))
            for g in after
            if g["id"] not in old_ids
        )
        for group in before:
            current = new_by_id.get(group["id"])
            if current is None:
                later.append(_entry(kind, "group_dissolved", group))
                continue
            if current["name"] != group["name"]:
                later.append(
                    {
                        "type": "group_renamed",
                        "id": group["id"],
                        "from": group["name"],
                        "to": current["name"],
                        "kind": kind,
                        "stat": f"group:{group['id']}",
                    }
                )
            if (
                current["parent"] != group["parent"]
                or current["group"] != group["group"]
                or current["members"] != group["members"]
            ):
                later.append(
                    _entry(
                        kind,
                        "group_changed",
                        current,
                        count=len(all_devices(after, current["id"])),
                    )
                )
    return created + later


def state_hash(prefs: Prefs, groups: Groups) -> str:
    """Return a stable fingerprint of the preferences and the groups together."""
    return prefs_hash({"prefs": prefs, "groups": groups})
