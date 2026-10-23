"""Pure functions for the energy device hierarchy.

Everything here works on the plain dicts of Home Assistant's energy preferences
and has no Home Assistant imports, so it can be tested in isolation. Entries are
never rebuilt from scratch: fields this module does not know are kept as they are.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from collections.abc import Collection, Iterator, Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from .const import PLAUSIBILITY_MIN_KWH, PLAUSIBILITY_RATIO

KEY_SOURCES = "energy_sources"
KEY_DEVICES = "device_consumption"
KEY_DEVICES_WATER = "device_consumption_water"

STAT = "stat_consumption"
PARENT = "included_in_stat"
NAME = "name"
RATE = "stat_rate"

SOURCE_ENERGY_KEYS = ("stat_energy_from", "stat_energy_to")

type Device = dict[str, Any]
type Prefs = Mapping[str, Any]


class Severity(StrEnum):
    """How serious an issue is."""

    ERROR = "error"
    WARNING = "warning"


class IssueCode(StrEnum):
    """Problems found in the hierarchy."""

    CYCLE = "cycle"
    SELF_PARENT = "self_parent"
    DUPLICATE = "duplicate"
    MISSING_PARENT = "missing_parent"
    SOURCE_AND_DEVICE = "source_and_device"
    STATISTIC_MISSING = "statistic_missing"
    NOT_ENERGY_UNIT = "not_energy_unit"
    CHILDREN_EXCEED_PARENT = "children_exceed_parent"


class ChangeType(StrEnum):
    """Changes the panel can make to the device list."""

    ADD = "add"
    MOVE = "move"
    RENAME = "rename"
    REMOVE = "remove"


@dataclass(frozen=True, slots=True)
class Issue:
    """A problem with one device; errors prevent saving."""

    code: IssueCode
    severity: Severity
    stat: str
    details: Mapping[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        """Return the issue as JSON-serializable dict."""
        return {
            "code": self.code.value,
            "severity": self.severity.value,
            "stat": self.stat,
            "details": dict(self.details),
        }


@dataclass(slots=True)
class Node:
    """A device in the tree.

    `issue` is set when the device had to be placed at the top level because
    its parent is missing or it is part of a cycle.
    """

    stat: str
    device: Device
    children: list[Node] = field(default_factory=list)
    issue: IssueCode | None = None


class ChangeError(Exception):
    """A change cannot be applied; `code` is a translation key."""

    def __init__(self, code: str, stat: str) -> None:
        """Store the translation key and the affected statistic."""
        super().__init__(f"{code}: {stat}")
        self.code = code
        self.stat = stat


def parent_map(devices: Sequence[Device]) -> dict[str, str | None]:
    """Map each statistic to its parent; the first entry of a duplicate wins."""
    parents: dict[str, str | None] = {}
    for device in devices:
        parents.setdefault(device[STAT], device.get(PARENT))
    return parents


def _cycle_members(parents: Mapping[str, str | None]) -> set[str]:
    """Return all statistics that are part of a cycle (including self-loops)."""
    members: set[str] = set()
    visited: set[str] = set()
    for start in parents:
        path: list[str] = []
        position: dict[str, int] = {}
        node: str | None = start
        while node is not None and node in parents and node not in visited:
            if node in position:
                members.update(path[position[node] :])
                break
            position[node] = len(path)
            path.append(node)
            node = parents[node]
        visited.update(path)
    return members


def build_tree(devices: Sequence[Device]) -> list[Node]:
    """Return the top-level nodes in configuration order."""
    nodes: dict[str, Node] = {}
    for device in devices:
        if device[STAT] not in nodes:
            nodes[device[STAT]] = Node(device[STAT], device)
    parents = {stat: node.device.get(PARENT) for stat, node in nodes.items()}
    cycles = _cycle_members(parents)

    roots: list[Node] = []
    for stat, node in nodes.items():
        parent = parents[stat]
        if stat in cycles:
            node.issue = IssueCode.CYCLE
            roots.append(node)
        elif parent is None:
            roots.append(node)
        elif parent not in nodes:
            node.issue = IssueCode.MISSING_PARENT
            roots.append(node)
        else:
            nodes[parent].children.append(node)
    return roots


def walk(nodes: Sequence[Node]) -> Iterator[Node]:
    """Yield all nodes depth-first."""
    for node in nodes:
        yield node
        yield from walk(node.children)


def tree_depth(nodes: Sequence[Node]) -> int:
    """Return the number of levels (0 for an empty tree)."""
    return max((1 + tree_depth(node.children) for node in nodes), default=0)


def source_energy_stats(sources: Sequence[Mapping[str, Any]]) -> set[str]:
    """Return the energy statistics used by sources (import, export, ...)."""
    return {
        value
        for source in sources
        for key in SOURCE_ENERGY_KEYS
        if isinstance(value := source.get(key), str)
    }


def used_stats(prefs: Prefs) -> set[str]:
    """Return every statistic referenced anywhere in the preferences."""
    found: set[str] = set()

    def collect(value: Any) -> None:
        if isinstance(value, Mapping):
            for key, item in value.items():
                if key.startswith("stat_") and isinstance(item, str):
                    found.add(item)
                else:
                    collect(item)
        elif isinstance(value, list):
            for item in value:
                collect(item)

    collect(dict(prefs))
    return found


def validate(
    prefs: Prefs,
    stat_units: Mapping[str, str | None] | None = None,
    energy_units: Collection[str] = (),
) -> list[Issue]:
    """Check the device hierarchy.

    `stat_units` maps every known statistic to its unit (None if unknown). When
    given, devices whose statistic is missing or not measured in one of
    `energy_units` get a warning.
    """
    devices: Sequence[Device] = prefs.get(KEY_DEVICES, [])
    issues: list[Issue] = []

    seen: set[str] = set()
    for device in devices:
        stat = device[STAT]
        if stat in seen:
            issues.append(Issue(IssueCode.DUPLICATE, Severity.ERROR, stat))
        seen.add(stat)

    parents = parent_map(devices)
    cycles = _cycle_members(parents)
    for stat, parent in parents.items():
        if parent is None:
            continue
        if parent == stat:
            issues.append(Issue(IssueCode.SELF_PARENT, Severity.ERROR, stat))
        elif stat in cycles:
            issues.append(Issue(IssueCode.CYCLE, Severity.ERROR, stat))
        elif parent not in parents:
            issues.append(
                Issue(
                    IssueCode.MISSING_PARENT,
                    Severity.ERROR,
                    stat,
                    {"parent": parent},
                )
            )

    sources = source_energy_stats(prefs.get(KEY_SOURCES, []))
    issues.extend(
        Issue(IssueCode.SOURCE_AND_DEVICE, Severity.ERROR, stat)
        for stat in parents
        if stat in sources
    )

    if stat_units is not None:
        for stat in parents:
            if stat not in stat_units:
                issues.append(
                    Issue(IssueCode.STATISTIC_MISSING, Severity.WARNING, stat)
                )
            elif (unit := stat_units[stat]) is not None and unit not in energy_units:
                issues.append(
                    Issue(
                        IssueCode.NOT_ENERGY_UNIT,
                        Severity.WARNING,
                        stat,
                        {"unit": unit},
                    )
                )
    return issues


def has_errors(issues: Sequence[Issue]) -> bool:
    """Return True if any issue prevents saving."""
    return any(issue.severity is Severity.ERROR for issue in issues)


def _set_optional(device: Device, key: str, value: Any) -> None:
    """Set a text field, or remove it when the value is empty."""
    if isinstance(value, str):
        value = value.strip()
    if value:
        device[key] = value
    else:
        device.pop(key, None)


def _index(devices: Sequence[Device], stat: str) -> int | None:
    return next(
        (index for index, device in enumerate(devices) if device[STAT] == stat),
        None,
    )


def apply_changes(prefs: Prefs, changes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Return a copy of the preferences with the changes applied in order.

    A removed device's children move up one level: they get the parent of the
    removed device. Raises ChangeError for changes that do not fit the list.
    """
    result = deepcopy(dict(prefs))
    devices: list[Device] = result.setdefault(KEY_DEVICES, [])
    for change in changes:
        kind = change["type"]
        stat = change["stat"]
        index = _index(devices, stat)
        if kind == ChangeType.ADD:
            if index is not None:
                raise ChangeError("device_exists", stat)
            device: Device = {STAT: stat}
            _set_optional(device, RATE, change.get(RATE))
            _set_optional(device, NAME, change.get(NAME))
            _set_optional(device, PARENT, change.get("parent"))
            devices.append(device)
            continue
        if index is None:
            raise ChangeError("unknown_device", stat)
        if kind == ChangeType.MOVE:
            _set_optional(devices[index], PARENT, change.get("parent"))
        elif kind == ChangeType.RENAME:
            _set_optional(devices[index], NAME, change.get(NAME))
        elif kind == ChangeType.REMOVE:
            removed = devices.pop(index)
            for other in devices:
                if other.get(PARENT) == stat:
                    _set_optional(other, PARENT, removed.get(PARENT))
        else:
            raise ChangeError("unknown_change", stat)
    return result


def diff(old: Prefs, new: Prefs) -> list[dict[str, Any]]:
    """Describe how the device list changed, for confirmations and backups."""
    old_devices = {d[STAT]: d for d in old.get(KEY_DEVICES, [])}
    new_devices = {d[STAT]: d for d in new.get(KEY_DEVICES, [])}
    entries: list[dict[str, Any]] = [
        {"type": "added", "stat": stat, "parent": device.get(PARENT)}
        for stat, device in new_devices.items()
        if stat not in old_devices
    ]
    for stat, before in old_devices.items():
        after = new_devices.get(stat)
        if after is None:
            entries.append({"type": "removed", "stat": stat})
            continue
        for kind, key in (("moved", PARENT), ("renamed", NAME), ("rate", RATE)):
            if before.get(key) != after.get(key):
                entries.append(
                    {
                        "type": kind,
                        "stat": stat,
                        "from": before.get(key),
                        "to": after.get(key),
                    }
                )
    return entries


def summarize(entries: Sequence[Mapping[str, Any]]) -> dict[str, int]:
    """Count diff entries by type."""
    return dict(Counter(entry["type"] for entry in entries))


def untracked(
    nodes: Sequence[Node], values: Mapping[str, float | None]
) -> dict[str, float | None]:
    """Return own value minus the children's values for each device with children.

    The result is None when the device or one of its children has no value.
    """
    result: dict[str, float | None] = {}
    for node in walk(nodes):
        if not node.children:
            continue
        own = values.get(node.stat)
        children = [values.get(child.stat) for child in node.children]
        if own is None or any(value is None for value in children):
            result[node.stat] = None
        else:
            result[node.stat] = own - sum(v for v in children if v is not None)
    return result


def plausibility(
    nodes: Sequence[Node],
    energy: Mapping[str, float | None],
    ratio: float = PLAUSIBILITY_RATIO,
    min_amount: float = PLAUSIBILITY_MIN_KWH,
) -> list[Issue]:
    """Warn when children use clearly more energy than their parent.

    Both limits must be exceeded: more than `ratio` of the parent's value and
    more than `min_amount` (kWh) in absolute terms.
    """
    issues: list[Issue] = []
    for stat, rest in untracked(nodes, energy).items():
        own = energy.get(stat)
        if rest is None or own is None:
            continue
        # Rounded so that float noise does not decide right at the limits.
        excess = round(-rest, 9)
        if excess > round(ratio * own, 9) and excess > min_amount:
            issues.append(
                Issue(
                    IssueCode.CHILDREN_EXCEED_PARENT,
                    Severity.WARNING,
                    stat,
                    {"parent": own, "children": own + excess, "excess": excess},
                )
            )
    return issues


def prefs_hash(prefs: Prefs) -> str:
    """Return a short, stable fingerprint of the preferences."""
    payload = json.dumps(
        prefs, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
