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

FROM = "stat_energy_from"
TO = "stat_energy_to"
SOURCE_ENERGY_KEYS = (FROM, TO)

# Roles of a source statistic, by source type and key.
SOURCE_ROLES: dict[str, dict[str, str]] = {
    "grid": {FROM: "import", TO: "export"},
    "solar": {FROM: "production"},
    "battery": {FROM: "discharge", TO: "charge"},
    "gas": {FROM: "gas"},
    "water": {FROM: "water"},
}

# Source types the panel may change; gas is only shown.
EDITABLE_SOURCE_TYPES = ("grid", "solar", "battery", "water")

# A grid connection without costs, as the energy settings page creates it.
NEW_GRID: dict[str, Any] = {
    "type": "grid",
    "stat_energy_from": None,
    "stat_energy_to": None,
    "stat_cost": None,
    "entity_energy_price": None,
    "number_energy_price": None,
    "stat_compensation": None,
    "entity_energy_price_export": None,
    "number_energy_price_export": None,
    "cost_adjustment_day": 0.0,
}

# A water meter without costs, as the energy settings page creates it.
NEW_WATER: dict[str, Any] = {
    "type": "water",
    "stat_energy_from": None,
    "stat_cost": None,
    "entity_energy_price": None,
    "number_energy_price": None,
}

type Device = dict[str, Any]
type Prefs = Mapping[str, Any]


class DeviceKind(StrEnum):
    """The device lists of the energy dashboard."""

    ELECTRICITY = "electricity"
    WATER = "water"


DEVICE_KEYS: dict[DeviceKind, str] = {
    DeviceKind.ELECTRICITY: KEY_DEVICES,
    DeviceKind.WATER: KEY_DEVICES_WATER,
}


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
    DUPLICATE_SOURCE = "duplicate_source"
    STATISTIC_MISSING = "statistic_missing"
    NOT_ENERGY_UNIT = "not_energy_unit"
    NOT_WATER_UNIT = "not_water_unit"
    CHILDREN_EXCEED_PARENT = "children_exceed_parent"


class ChangeType(StrEnum):
    """Changes the panel can make to the devices and sources."""

    ADD = "add"
    MOVE = "move"
    RENAME = "rename"
    REMOVE = "remove"
    ASSIGN_SOURCE = "assign_source"
    UNASSIGN_SOURCE = "unassign_source"


class AssignRole(StrEnum):
    """Source roles a statistic can be assigned to."""

    IMPORT = "import"
    EXPORT = "export"
    PRODUCTION = "production"
    BATTERY = "battery"
    WATER = "water"


# Unit warning of each device list.
UNIT_ISSUES: dict[DeviceKind, IssueCode] = {
    DeviceKind.ELECTRICITY: IssueCode.NOT_ENERGY_UNIT,
    DeviceKind.WATER: IssueCode.NOT_WATER_UNIT,
}


@dataclass(frozen=True, slots=True)
class Issue:
    """A problem with one device or source; errors prevent saving.

    `kind` is the device list (for a source, the list it belongs to).
    """

    code: IssueCode
    severity: Severity
    stat: str
    details: Mapping[str, Any] = field(default_factory=dict)
    kind: DeviceKind = DeviceKind.ELECTRICITY

    def as_dict(self) -> dict[str, Any]:
        """Return the issue as JSON-serializable dict."""
        return {
            "code": self.code.value,
            "severity": self.severity.value,
            "stat": self.stat,
            "details": dict(self.details),
            "kind": self.kind.value,
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


def source_kind(source: Mapping[str, Any]) -> DeviceKind:
    """Return the device list a source belongs to (gas counts as electricity)."""
    return DeviceKind.WATER if source.get("type") == "water" else DeviceKind.ELECTRICITY


def source_roles(sources: Sequence[Mapping[str, Any]]) -> list[tuple[str, str]]:
    """Return (role, statistic) for every energy statistic of the sources."""
    return [
        (role, value)
        for source in sources
        for key, role in SOURCE_ROLES.get(source.get("type", ""), {}).items()
        if isinstance(value := source.get(key), str)
    ]


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


def _validate_devices(
    devices: Sequence[Device],
    kind: DeviceKind,
    sources: set[str],
    stat_units: Mapping[str, str | None] | None,
    units: Collection[str] | None,
) -> list[Issue]:
    """Check one device list; see `validate`."""
    issues: list[Issue] = []

    def add(code: IssueCode, severity: Severity, stat: str, **details: Any) -> None:
        issues.append(Issue(code, severity, stat, details, kind))

    seen: set[str] = set()
    for device in devices:
        stat = device[STAT]
        if stat in seen:
            add(IssueCode.DUPLICATE, Severity.ERROR, stat)
        seen.add(stat)

    parents = parent_map(devices)
    cycles = _cycle_members(parents)
    for stat, parent in parents.items():
        if parent is None:
            continue
        if parent == stat:
            add(IssueCode.SELF_PARENT, Severity.ERROR, stat)
        elif stat in cycles:
            add(IssueCode.CYCLE, Severity.ERROR, stat)
        elif parent not in parents:
            add(IssueCode.MISSING_PARENT, Severity.ERROR, stat, parent=parent)

    for stat in parents:
        if stat in sources:
            add(IssueCode.SOURCE_AND_DEVICE, Severity.ERROR, stat)

    if stat_units is not None and units is not None:
        issues.extend(_unit_warnings(parents, kind, stat_units, units))
    return issues


def _unit_warnings(
    stats: Collection[str],
    kind: DeviceKind,
    stat_units: Mapping[str, str | None],
    units: Collection[str],
) -> Iterator[Issue]:
    """Warn about missing statistics and units that do not fit the list."""
    for stat in stats:
        if stat not in stat_units:
            yield Issue(IssueCode.STATISTIC_MISSING, Severity.WARNING, stat, kind=kind)
        elif (unit := stat_units[stat]) is not None and unit not in units:
            yield Issue(UNIT_ISSUES[kind], Severity.WARNING, stat, {"unit": unit}, kind)


def validate(
    prefs: Prefs,
    stat_units: Mapping[str, str | None] | None = None,
    units: Mapping[DeviceKind, Collection[str]] | None = None,
) -> list[Issue]:
    """Check both device hierarchies and the sources.

    `stat_units` maps every known statistic to its unit (None if unknown). When
    given, devices whose statistic is missing or not measured in one of the
    `units` of their list get a warning.
    """
    all_sources: Sequence[Mapping[str, Any]] = prefs.get(KEY_SOURCES, [])
    sources = source_energy_stats(all_sources)
    issues: list[Issue] = []
    for kind, key in DEVICE_KEYS.items():
        issues.extend(
            _validate_devices(
                prefs.get(key, []),
                kind,
                sources,
                stat_units,
                None if units is None else units.get(kind),
            )
        )

    kinds = {
        stat: source_kind(source)
        for source in all_sources
        for key in SOURCE_ENERGY_KEYS
        if isinstance(stat := source.get(key), str)
    }
    counts = Counter(stat for _, stat in source_roles(all_sources))
    issues.extend(
        Issue(IssueCode.DUPLICATE_SOURCE, Severity.ERROR, stat, kind=kinds[stat])
        for stat, count in counts.items()
        if count > 1
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


def _assign_source(sources: list[dict[str, Any]], change: Mapping[str, Any]) -> None:
    """Assign a statistic to a source role.

    Grid import and export replace the meter given as `replace`, or else that
    of the first grid connection, and keep the connection's prices; without a
    grid connection, one without costs is created. A water meter replaces the
    one given as `replace` (keeping its prices), or else is added without
    costs. Solar and battery always add a new source; a battery needs both
    meters.
    """
    role = change.get("role")
    stat = change["stat"]
    if role == AssignRole.WATER:
        if replace := change.get("replace"):
            water = next(
                (
                    s
                    for s in sources
                    if s.get("type") == "water" and s.get(FROM) == replace
                ),
                None,
            )
            if water is None:
                raise ChangeError("unknown_source", replace)
        else:
            water = deepcopy(NEW_WATER)
            sources.append(water)
        water[FROM] = stat
        return
    if role in (AssignRole.IMPORT, AssignRole.EXPORT):
        key = FROM if role == AssignRole.IMPORT else TO
        grids = [s for s in sources if s.get("type") == "grid"]
        if replace := change.get("replace"):
            grid = next((s for s in grids if s.get(key) == replace), None)
            if grid is None:
                raise ChangeError("unknown_source", replace)
        elif grids:
            grid = grids[0]
        else:
            grid = deepcopy(NEW_GRID)
            sources.append(grid)
        grid[key] = stat
    elif role == AssignRole.PRODUCTION:
        sources.append(
            {"type": "solar", FROM: stat, "config_entry_solar_forecast": None}
        )
    elif role == AssignRole.BATTERY and change.get("stat_to"):
        sources.append({"type": "battery", FROM: stat, TO: change["stat_to"]})
    else:
        raise ChangeError("unknown_change", stat)


def _unassign_source(sources: list[dict[str, Any]], stat: str) -> None:
    """Remove a statistic from the sources.

    A grid connection only loses that meter (it is removed once nothing is
    left); solar, battery and water sources are removed as a whole. Gas
    sources are only shown, so they cannot be removed here.
    """
    for index, source in enumerate(sources):
        if source.get("type") not in EDITABLE_SOURCE_TYPES:
            continue
        for key in SOURCE_ENERGY_KEYS:
            if source.get(key) != stat:
                continue
            if source.get("type") != "grid":
                del sources[index]
                return
            source[key] = None
            if not any(source.get(k) for k in (FROM, TO, RATE, "power_config")):
                del sources[index]
            return
    raise ChangeError("unknown_source", stat)


def apply_changes(prefs: Prefs, changes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Return a copy of the preferences with the changes applied in order.

    Device changes apply to the list named by `kind` (electricity unless
    given). A removed device's children move up one level: they get the parent
    of the removed device. Raises ChangeError for changes that do not fit.
    """
    result = deepcopy(dict(prefs))
    result.setdefault(KEY_DEVICES, [])
    sources: list[dict[str, Any]] = result.setdefault(KEY_SOURCES, [])
    for change in changes:
        kind = change["type"]
        stat = change["stat"]
        if kind == ChangeType.ASSIGN_SOURCE:
            _assign_source(sources, change)
            continue
        if kind == ChangeType.UNASSIGN_SOURCE:
            _unassign_source(sources, stat)
            continue
        key = DEVICE_KEYS[DeviceKind(change.get("kind", DeviceKind.ELECTRICITY))]
        devices: list[Device] = result.setdefault(key, [])
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
    """Describe how devices and sources changed, for confirmations and backups.

    Device entries carry the `kind` of their list.
    """
    entries: list[dict[str, Any]] = []
    later: list[dict[str, Any]] = []
    for kind, key in DEVICE_KEYS.items():
        added, changed = _diff_devices(old.get(key, []), new.get(key, []), kind)
        entries.extend(added)
        later.extend(changed)
    old_roles = set(source_roles(old.get(KEY_SOURCES, [])))
    new_roles = set(source_roles(new.get(KEY_SOURCES, [])))
    entries.extend(
        {"type": "source_added", "stat": stat, "role": role}
        for role, stat in source_roles(new.get(KEY_SOURCES, []))
        if (role, stat) not in old_roles
    )
    entries.extend(
        {"type": "source_removed", "stat": stat, "role": role}
        for role, stat in source_roles(old.get(KEY_SOURCES, []))
        if (role, stat) not in new_roles
    )
    return entries + later


def _diff_devices(
    old: Sequence[Device], new: Sequence[Device], kind: DeviceKind
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return the added devices, and all other changes, of one list."""
    old_devices = {d[STAT]: d for d in old}
    new_devices = {d[STAT]: d for d in new}
    added: list[dict[str, Any]] = [
        {"type": "added", "stat": stat, "parent": device.get(PARENT), "kind": kind}
        for stat, device in new_devices.items()
        if stat not in old_devices
    ]
    changed: list[dict[str, Any]] = []
    for stat, before in old_devices.items():
        after = new_devices.get(stat)
        if after is None:
            changed.append({"type": "removed", "stat": stat, "kind": kind})
            continue
        for change, key in (("moved", PARENT), ("renamed", NAME), ("rate", RATE)):
            if before.get(key) != after.get(key):
                changed.append(
                    {
                        "type": change,
                        "stat": stat,
                        "from": before.get(key),
                        "to": after.get(key),
                        "kind": kind,
                    }
                )
    return added, changed


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
    kind: DeviceKind = DeviceKind.ELECTRICITY,
) -> list[Issue]:
    """Warn when children use clearly more than their parent.

    Both limits must be exceeded: more than `ratio` of the parent's value and
    more than `min_amount` (in the unit of the values) in absolute terms.
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
                    kind,
                )
            )
    return issues


def prefs_hash(prefs: Prefs) -> str:
    """Return a short, stable fingerprint of the preferences."""
    payload = json.dumps(
        prefs, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
