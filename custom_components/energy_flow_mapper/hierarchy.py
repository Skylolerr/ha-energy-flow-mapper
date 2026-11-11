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
from typing import Any, Final

from .const import PLAUSIBILITY_MIN_KWH, PLAUSIBILITY_RATIO

KEY_SOURCES = "energy_sources"
KEY_DEVICES = "device_consumption"
KEY_DEVICES_WATER = "device_consumption_water"

STAT = "stat_consumption"
PARENT = "included_in_stat"

# The characters JavaScript's `String.prototype.trim()` removes (white space and line
# terminators), so a name is trimmed here exactly as the panel previews it. Python's
# `str.strip()` differs: it also removes U+001C-U+001F and U+0085, but not U+FEFF.
JS_TRIM = (
    "\t\n\v\f\r \u00a0\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000\ufeff"
)

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
    # The home meter (Home Assistant 2026.11 and newer) measures Home itself.
    "home": {TO: "home"},
}

# Source types the panel may change.
EDITABLE_SOURCE_TYPES = ("grid", "solar", "battery", "gas", "water", "home")

# Key of Home in untracked values and issues.
HOME = "home"

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

# A gas meter without costs, as the energy settings page creates it.
NEW_GAS: dict[str, Any] = NEW_WATER | {"type": "gas"}

type Device = dict[str, Any]
type Prefs = Mapping[str, Any]


class DeviceKind(StrEnum):
    """The tabs: the device lists of the energy dashboard, and gas.

    Home Assistant has no gas devices, so gas only has sources; it is not in
    `DEVICE_KEYS`.
    """

    ELECTRICITY = "electricity"
    WATER = "water"
    GAS = "gas"


# The kinds with a device list, by list key.
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
    DEVICES_EXCEED_HOME = "devices_exceed_home"


class ChangeType(StrEnum):
    """Changes the panel can make to the devices and sources."""

    ADD = "add"
    MOVE = "move"
    RENAME = "rename"
    REMOVE = "remove"
    ASSIGN_SOURCE = "assign_source"
    UNASSIGN_SOURCE = "unassign_source"
    USE_AS_HOME_METER = "use_as_home_meter"


class AssignRole(StrEnum):
    """Source roles a statistic can be assigned to."""

    IMPORT = "import"
    EXPORT = "export"
    PRODUCTION = "production"
    BATTERY = "battery"
    GAS = "gas"
    WATER = "water"
    HOME = "home"


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
    """Return the tab a source belongs to: water, gas or electricity."""
    kind = source.get("type")
    if kind in (DeviceKind.WATER, DeviceKind.GAS):
        return DeviceKind(kind)
    return DeviceKind.ELECTRICITY


# The sensors of a grid connection's `power_config`, in HA's order.
POWER_CONFIG_KEYS: Final = (
    "stat_rate",
    "stat_rate_inverted",
    "stat_rate_from",
    "stat_rate_to",
)


def source_roles(sources: Sequence[Mapping[str, Any]]) -> list[tuple[str, str]]:
    """Return (role, statistic) for every energy statistic of the sources."""
    return [
        (role, value)
        for source in sources
        for key, role in SOURCE_ROLES.get(source.get("type", ""), {}).items()
        if isinstance(value := source.get(key), str)
    ]


def power_stats(source: Mapping[str, Any]) -> list[str]:
    """Return the power sensors of a source: `stat_rate`, then `power_config`."""
    config = source.get("power_config")
    values = [source.get("stat_rate")]
    if isinstance(config, Mapping):
        values += [config.get(key) for key in POWER_CONFIG_KEYS]
    return [value for value in values if isinstance(value, str)]


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
    # The home meter only measures Home; it may also be the grid import meter.
    counts = Counter(
        stat for role, stat in source_roles(all_sources) if role != AssignRole.HOME
    )
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
        value = value.strip(JS_TRIM)
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
    grid connection, one without costs is created. A water or gas meter
    replaces the one of its type given as `replace` (keeping its prices), or
    else is added without costs. Solar and battery always add a new source; a
    battery needs both meters.
    """
    role = change.get("role")
    stat = change["stat"]
    if role == AssignRole.HOME:
        _assign_home(sources, stat)
        return
    if role in (AssignRole.WATER, AssignRole.GAS):
        _assign_meter(sources, str(role), stat, change.get("replace"))
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


def _assign_meter(
    sources: list[dict[str, Any]], kind: str, stat: str, replace: str | None
) -> None:
    """Replace the water or gas meter `replace` (keeping its prices), or add one."""
    if replace:
        meter = next(
            (s for s in sources if s.get("type") == kind and s.get(FROM) == replace),
            None,
        )
        if meter is None:
            raise ChangeError("unknown_source", replace)
    else:
        meter = deepcopy(NEW_GAS if kind == "gas" else NEW_WATER)
        sources.append(meter)
    meter[FROM] = stat


def _assign_home(
    sources: list[dict[str, Any]],
    stat: str,
    rate: str | None = None,
    name: str | None = None,
) -> None:
    """Set the statistic of the home meter, or add one; there is at most one."""
    home = next((s for s in sources if s.get("type") == "home"), None)
    if home is None:
        home = {"type": "home"}
        sources.append(home)
    home[TO] = stat
    if rate:
        home[RATE] = rate
    if name:
        home[NAME] = name


def _unassign_source(sources: list[dict[str, Any]], stat: str) -> None:
    """Remove a statistic from the sources.

    A grid connection only loses that meter (it is removed once nothing is
    left); solar, battery, gas and water sources are removed as a whole.
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
        if _apply_source_change(result, sources, change):
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


def _apply_source_change(
    prefs: dict[str, Any], sources: list[dict[str, Any]], change: Mapping[str, Any]
) -> bool:
    """Apply a change of the sources; False if it is a device change."""
    kind = change["type"]
    if kind == ChangeType.ASSIGN_SOURCE:
        _assign_source(sources, change)
    elif kind == ChangeType.UNASSIGN_SOURCE:
        _unassign_source(sources, change["stat"])
    elif kind == ChangeType.USE_AS_HOME_METER:
        _use_as_home_meter(prefs, sources, change["stat"])
    else:
        return False
    return True


def _use_as_home_meter(
    prefs: dict[str, Any], sources: list[dict[str, Any]], stat: str
) -> None:
    """Turn an electricity device into the home meter.

    The device is removed like any removal (its children move up a level) and
    its statistic, power sensor and name become the home meter.
    """
    if any(s.get("type") == "home" for s in sources):
        raise ChangeError("home_exists", stat)
    devices: list[Device] = prefs.setdefault(KEY_DEVICES, [])
    index = _index(devices, stat)
    if index is None:
        raise ChangeError("unknown_device", stat)
    removed = devices.pop(index)
    for other in devices:
        if other.get(PARENT) == stat:
            _set_optional(other, PARENT, removed.get(PARENT))
    _assign_home(sources, stat, removed.get(RATE), removed.get(NAME))


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


def home_stats(sources: Sequence[Mapping[str, Any]]) -> list[str]:
    """Return the statistics the home consumption is read or calculated from.

    The home meter if there is one; otherwise grid import and export, solar and
    the battery. Without a grid import nothing can be calculated.
    """
    for source in sources:
        if source.get("type") == "home" and isinstance(source.get(TO), str):
            return [source[TO]]
    roles = [
        (role, stat) for role, stat in source_roles(sources) if role in _HOME_SIGNS
    ]
    if not any(role == "import" for role, _ in roles):
        return []
    return [stat for _, stat in roles]


# How each source role counts towards the calculated home consumption.
_HOME_SIGNS: dict[str, int] = {
    "import": 1,
    "export": -1,
    "production": 1,
    "discharge": 1,
    "charge": -1,
}


def home_consumption(
    sources: Sequence[Mapping[str, Any]], energy: Mapping[str, float | None]
) -> tuple[float | None, str | None]:
    """Return the home consumption and whether it is measured or calculated.

    Measured comes from the home meter. Calculated is grid import - export +
    solar + battery discharge - charge, and only when every one of these has a
    value. Gas and water never count. Returns (None, None) otherwise, and for
    a negative result (broken statistics, a home never uses less than nothing).
    """
    stats = home_stats(sources)
    if not stats:
        return None, None
    values = [energy.get(stat) for stat in stats]
    if any(value is None for value in values):
        return None, None
    if any(s.get("type") == "home" and s.get(TO) == stats[0] for s in sources):
        # A home never uses less than nothing: broken statistics give no value.
        return (values[0], "measured") if (values[0] or 0.0) >= 0 else (None, None)
    signs = {
        stat: _HOME_SIGNS[role]
        for role, stat in source_roles(sources)
        if role in _HOME_SIGNS
    }
    total = sum(
        signs[stat] * (value or 0.0) for stat, value in zip(stats, values, strict=True)
    )
    if total < 0:
        return None, None
    return round(total, 6), "calculated"


def home_untracked(
    roots: Sequence[Node], values: Mapping[str, float | None], home: float | None
) -> float | None:
    """Return the home consumption minus all top-level devices, or None."""
    if home is None:
        return None
    tops = [values.get(node.stat) for node in roots]
    if any(value is None for value in tops):
        return None
    return home - sum(value for value in tops if value is not None)


def home_plausibility(
    roots: Sequence[Node],
    energy: Mapping[str, float | None],
    home: float | None,
    ratio: float = PLAUSIBILITY_RATIO,
    min_amount: float = PLAUSIBILITY_MIN_KWH,
) -> Issue | None:
    """Warn when the top-level devices use clearly more than the home.

    The same limits as for a device and its children.
    """
    rest = home_untracked(roots, energy, home)
    if rest is None or home is None:
        return None
    excess = round(-rest, 9)
    if excess > round(ratio * home, 9) and excess > min_amount:
        return Issue(
            IssueCode.DEVICES_EXCEED_HOME,
            Severity.WARNING,
            HOME,
            {"home": home, "devices": round(home + excess, 9), "excess": excess},
        )
    return None


# Home Assistant's issue types that our own checks already report for the
# same statistic; HA's message is then not shown a second time.
_OWN_COVERS: dict[str, IssueCode] = {
    "entity_not_defined": IssueCode.STATISTIC_MISSING,
    "statistics_not_defined": IssueCode.STATISTIC_MISSING,
    "entity_unexpected_unit_energy": IssueCode.NOT_ENERGY_UNIT,
    "entity_unexpected_unit_water": IssueCode.NOT_WATER_UNIT,
}

PRICE_ISSUE_TYPES: Final = frozenset(
    {
        "entity_unexpected_unit_energy_price",
        "entity_unexpected_unit_gas_price",
        "entity_unexpected_unit_water_price",
        "entity_gas_price_unit_mismatch",
    }
)


def _entities(issue: Mapping[str, Any]) -> list[list[Any]]:
    return [
        [entity[0], entity[1]]
        for entity in issue.get("affected_entities") or []
        if isinstance(entity, list | tuple) and len(entity) == 2
    ]


def _entries(validation: Mapping[str, Any], key: str) -> list[tuple[int, Any]]:
    value = validation.get(key)
    if not isinstance(value, list):
        return []
    return [
        (index, issues)
        for index, issues in enumerate(value)
        if isinstance(issues, list)
    ]


def ha_issues(
    prefs: Prefs, validation: Mapping[str, Any], own: Sequence[Issue]
) -> list[dict[str, Any]]:
    """Attach Home Assistant's energy validation to the blocks of the diagram.

    `validation` has HA's shape: per list, one list of issues for each entry,
    indexed like the saved preferences. A device's issues go to the device; a
    source's issues go to the block whose statistic is the affected entity, or
    to the source's first block (prices, power sensors). Where one of our own
    issues already says the same about a statistic, HA's is left out.
    """
    covered = {(issue.stat, issue.kind.value, issue.code) for issue in own}
    # One entry per block and message: HA checks a sensor once per source,
    # and the home meter may be the grid import meter.
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    for kind, first, blocks, issues in _ha_targets(prefs, validation):
        for issue in issues:
            if isinstance(issue, Mapping):
                _merge_ha_issue(merged, issue, (kind, first, blocks), covered)
    return list(merged.values())


def _ha_targets(
    prefs: Prefs, validation: Mapping[str, Any]
) -> list[tuple[str, str, list[str], Any]]:
    """(kind, first block, block statistics, HA issues) per checked entry."""
    targets: list[tuple[str, str, list[str], Any]] = []
    sources = prefs.get(KEY_SOURCES, [])
    for index, issues in _entries(validation, KEY_SOURCES):
        if index >= len(sources):
            continue
        source = sources[index]
        blocks = [stat for _, stat in source_roles([source])] or power_stats(source)
        if blocks:
            targets.append((source_kind(source).value, blocks[0], blocks, issues))
    for device_kind, key in DEVICE_KEYS.items():
        devices = prefs.get(key, [])
        for index, issues in _entries(validation, key):
            if index < len(devices):
                stat = devices[index][STAT]
                targets.append((device_kind.value, stat, [stat], issues))
    return targets


def _merge_ha_issue(
    merged: dict[tuple[str, str, str], dict[str, Any]],
    issue: Mapping[str, Any],
    target: tuple[str, str, list[str]],
    covered: set[tuple[str, str, IssueCode]],
) -> None:
    """Add one HA issue to the blocks it concerns, without repeating it.

    `target` is (kind, first block, block statistics) of the checked entry.
    """
    kind, first, blocks = target
    kind_type = str(issue.get("type"))
    own_code = _OWN_COVERS.get(kind_type)
    entities = _entities(issue)
    by_block: dict[str, list[list[Any]]] = {}
    for entity in entities:
        block = entity[0] if entity[0] in blocks else first
        if own_code and entity[0] == block and (block, kind, own_code) in covered:
            continue
        by_block.setdefault(block, []).append(entity)
    if not entities:
        by_block[first] = []
    for block, found in by_block.items():
        entry = merged.setdefault(
            (block, kind, kind_type),
            {
                "stat": block,
                "kind": kind,
                "type": kind_type,
                "placeholders": issue.get("translation_placeholders"),
                "entities": [],
            },
        )
        entry["entities"].extend(
            entity for entity in found if entity not in entry["entities"]
        )


def card_ha_issues(
    issues: Sequence[Mapping[str, Any]], allowed: set[str]
) -> list[dict[str, Any]]:
    """Keep only what the card may show: never prices, only allowed entities."""
    result: list[dict[str, Any]] = []
    for issue in issues:
        if issue["type"] in PRICE_ISSUE_TYPES:
            continue
        entities = [e for e in issue["entities"] if e[0] in allowed]
        if entities:
            result.append({**issue, "entities": entities})
    return result


def child_pairs(
    stat_devices: Mapping[str, str | None],
    device_parents: Mapping[str, str],
    kind: DeviceKind,
    saved: Collection[str] | None = None,
) -> list[dict[str, str]]:
    """Return "included in" suggestions from Home Assistant's child devices.

    `stat_devices` maps each statistic of one list (devices and free meters)
    to its HA device, `device_parents` a child HA device to its parent, and
    `saved` names the statistics that are devices already (all of them when
    not given). A child statistic is paired with its parent device's
    statistic only when that parent carries exactly one: one saved device
    statistic, or with none saved, one free meter; otherwise it is unclear
    which one is the total, so there is no suggestion.
    """
    by_device: dict[str, list[str]] = {}
    free: dict[str, list[str]] = {}
    for stat, device_id in stat_devices.items():
        if device_id is not None:
            known = saved is None or stat in saved
            (by_device if known else free).setdefault(device_id, []).append(stat)
    for device_id, stats in free.items():
        by_device.setdefault(device_id, stats)
    pairs: list[dict[str, str]] = []
    for stat, device_id in stat_devices.items():
        parent_device = device_parents.get(device_id) if device_id else None
        if parent_device is None or parent_device == device_id:
            continue
        parent_stats = by_device.get(parent_device, [])
        if len(parent_stats) == 1 and parent_stats[0] != stat:
            pairs.append({"kind": kind.value, "stat": stat, "parent": parent_stats[0]})
    return pairs


def prefs_hash(prefs: Prefs) -> str:
    """Return a short, stable fingerprint of the preferences."""
    payload = json.dumps(
        prefs, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str
    )
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
