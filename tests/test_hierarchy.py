"""Tests for the pure hierarchy functions."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from custom_components.energy_flow_mapper.hierarchy import (
    HOME,
    NEW_GAS,
    NEW_GRID,
    NEW_WATER,
    PRICE_ISSUE_TYPES,
    ChangeError,
    DeviceKind,
    Issue,
    IssueCode,
    Node,
    Severity,
    ambiguous_devices,
    apply_changes,
    build_tree,
    card_ha_issues,
    child_pairs,
    counted_twice,
    diff,
    ha_issues,
    has_errors,
    home_consumption,
    home_plausibility,
    home_stats,
    home_untracked,
    issue_dicts,
    new_errors,
    parent_map,
    plausibility,
    prefs_hash,
    source_energy_stats,
    source_kind,
    source_roles,
    summarize,
    tree_depth,
    untracked,
    untracked_missing,
    used_stats,
    validate,
    walk,
)

ENERGY_UNITS = ("Wh", "kWh", "MWh")
WATER_UNITS = ("L", "m³", "gal")
UNITS = {DeviceKind.ELECTRICITY: ENERGY_UNITS, DeviceKind.WATER: WATER_UNITS}


def device(stat: str, parent: str | None = None, **extra: Any) -> dict[str, Any]:
    """Return a device entry."""
    entry: dict[str, Any] = {"stat_consumption": stat, **extra}
    if parent is not None:
        entry["included_in_stat"] = parent
    return entry


def deep_devices() -> list[dict[str, Any]]:
    """Return a tree with four levels and two top-level devices."""
    return [
        device("sensor.main", stat_rate="sensor.main_power", name="Main"),
        device("sensor.kitchen", "sensor.main"),
        device("sensor.coffee", "sensor.kitchen"),
        device("sensor.grinder", "sensor.coffee", future_field={"keep": True}),
        device("sensor.office", "sensor.main"),
        device("sensor.garage"),
    ]


def prefs(devices: list[dict[str, Any]] | None = None, **extra: Any) -> dict[str, Any]:
    """Return energy preferences."""
    return {
        "energy_sources": [],
        "device_consumption": deep_devices() if devices is None else devices,
        "device_consumption_water": [],
        **extra,
    }


def shape(nodes: list[Node]) -> list[Any]:
    """Return the tree as nested (stat, children) tuples."""
    return [(node.stat, shape(node.children)) for node in nodes]


def codes(issues: list[Any]) -> list[tuple[str, str]]:
    return [(issue.code.value, issue.stat) for issue in issues]


# --- tree -------------------------------------------------------------------


def test_build_tree_keeps_order_and_nesting() -> None:
    roots = build_tree(deep_devices())
    assert shape(roots) == [
        (
            "sensor.main",
            [
                ("sensor.kitchen", [("sensor.coffee", [("sensor.grinder", [])])]),
                ("sensor.office", []),
            ],
        ),
        ("sensor.garage", []),
    ]
    assert tree_depth(roots) == 4
    assert all(node.issue is None for node in walk(roots))


def test_build_tree_children_before_parent() -> None:
    """Order in the list does not matter for nesting."""
    roots = build_tree(
        [device("sensor.child", "sensor.parent"), device("sensor.parent")]
    )
    assert shape(roots) == [("sensor.parent", [("sensor.child", [])])]


def test_build_tree_empty() -> None:
    assert build_tree([]) == []
    assert tree_depth([]) == 0


def test_build_tree_missing_parent_goes_to_top() -> None:
    roots = build_tree([device("sensor.a", "sensor.gone"), device("sensor.b")])
    assert shape(roots) == [("sensor.a", []), ("sensor.b", [])]
    assert roots[0].issue is IssueCode.MISSING_PARENT
    assert roots[1].issue is None


def test_build_tree_cycle_goes_to_top() -> None:
    roots = build_tree(
        [
            device("sensor.a", "sensor.c"),
            device("sensor.b", "sensor.a"),
            device("sensor.c", "sensor.b"),
            device("sensor.d", "sensor.a"),
            device("sensor.self", "sensor.self"),
        ]
    )
    assert shape(roots) == [
        ("sensor.a", [("sensor.d", [])]),
        ("sensor.b", []),
        ("sensor.c", []),
        ("sensor.self", []),
    ]
    assert [node.issue for node in roots] == [IssueCode.CYCLE] * 4
    assert roots[0].children[0].issue is None


def test_build_tree_ignores_duplicates() -> None:
    roots = build_tree([device("sensor.a"), device("sensor.a", "sensor.b")])
    assert shape(roots) == [("sensor.a", [])]


def test_parent_map_first_entry_wins() -> None:
    assert parent_map([device("sensor.a"), device("sensor.a", "sensor.b")]) == {
        "sensor.a": None
    }


# --- statistics in use ------------------------------------------------------


def test_source_and_used_stats() -> None:
    data = prefs(
        energy_sources=[
            {
                "type": "grid",
                "stat_energy_from": "sensor.import",
                "stat_energy_to": None,
                "stat_cost": "sensor.cost",
                "power_config": {"stat_rate_inverted": "sensor.grid_power"},
            },
            {"type": "solar", "stat_energy_from": "sensor.pv"},
        ],
        device_consumption_water=[device("sensor.garden_water")],
    )
    assert source_energy_stats(data["energy_sources"]) == {
        "sensor.import",
        "sensor.pv",
    }
    assert used_stats(data) == {
        "sensor.import",
        "sensor.cost",
        "sensor.grid_power",
        "sensor.pv",
        "sensor.main",
        "sensor.main_power",
        "sensor.kitchen",
        "sensor.coffee",
        "sensor.grinder",
        "sensor.office",
        "sensor.garage",
        "sensor.garden_water",
    }


# --- validation -------------------------------------------------------------


def test_validate_clean_tree() -> None:
    assert validate(prefs()) == []


def test_validate_errors() -> None:
    data = prefs(
        [
            device("sensor.a", "sensor.b"),
            device("sensor.b", "sensor.a"),
            device("sensor.self", "sensor.self"),
            device("sensor.orphan", "sensor.gone"),
            device("sensor.dup"),
            device("sensor.dup"),
            device("sensor.import"),
        ],
        energy_sources=[{"type": "grid", "stat_energy_from": "sensor.import"}],
    )
    issues = validate(data)
    assert codes(issues) == [
        ("duplicate", "sensor.dup"),
        ("cycle", "sensor.a"),
        ("cycle", "sensor.b"),
        ("self_parent", "sensor.self"),
        ("missing_parent", "sensor.orphan"),
        ("source_and_device", "sensor.import"),
    ]
    assert all(issue.severity is Severity.ERROR for issue in issues)
    assert issues[4].as_dict() == {
        "code": "missing_parent",
        "severity": "error",
        "stat": "sensor.orphan",
        "details": {"parent": "sensor.gone"},
        "kind": "electricity",
    }
    assert has_errors(issues)


def test_validate_device_pointing_into_cycle_is_no_error() -> None:
    issues = validate(
        prefs(
            [
                device("sensor.a", "sensor.b"),
                device("sensor.b", "sensor.a"),
                device("sensor.c", "sensor.a"),
            ]
        )
    )
    assert codes(issues) == [("cycle", "sensor.a"), ("cycle", "sensor.b")]


def test_validate_warnings_for_units() -> None:
    data = prefs([device("sensor.ok"), device("sensor.wrong"), device("sensor.gone")])
    data["device_consumption"].append(device("ext:portal", "sensor.ok"))
    issues = validate(
        data,
        stat_units={
            "sensor.ok": "kWh",
            "sensor.wrong": "W",
            "ext:portal": None,
        },
        units=UNITS,
    )
    assert codes(issues) == [
        ("not_energy_unit", "sensor.wrong"),
        ("statistic_missing", "sensor.gone"),
    ]
    assert issues[0].details == {"unit": "W"}
    assert not has_errors(issues)


def test_validate_without_device_list() -> None:
    assert validate({"energy_sources": []}) == []


def test_validate_water_devices_on_their_own() -> None:
    """Water devices are checked in their own list, with their own units."""
    data = prefs(
        [device("sensor.tap")],
        energy_sources=[{"type": "water", "stat_energy_from": "sensor.main_water"}],
        device_consumption_water=[
            device("sensor.garden", "sensor.house_water"),
            device("sensor.tap"),
            device("sensor.main_water"),
            device("sensor.litres"),
            device("sensor.kwh"),
            device("sensor.loop", "sensor.loop"),
        ],
    )
    issues = validate(
        data,
        stat_units={
            "sensor.tap": "kWh",
            "sensor.garden": "m³",
            "sensor.main_water": "m³",
            "sensor.litres": "L",
            "sensor.kwh": "kWh",
            "sensor.loop": "L",
        },
        units=UNITS,
    )
    # The same statistic in both lists is no duplicate, but kWh is no water
    # unit; the parent must be a water device.
    assert [(i.code.value, i.stat, i.kind) for i in issues] == [
        ("missing_parent", "sensor.garden", DeviceKind.WATER),
        ("self_parent", "sensor.loop", DeviceKind.WATER),
        ("source_and_device", "sensor.main_water", DeviceKind.WATER),
        ("not_water_unit", "sensor.tap", DeviceKind.WATER),
        ("not_water_unit", "sensor.kwh", DeviceKind.WATER),
    ]
    assert issues[-1].as_dict()["kind"] == "water"
    assert issues[-1].details == {"unit": "kWh"}


def test_validate_units_only_for_given_lists() -> None:
    data = prefs([device("sensor.a")], device_consumption_water=[device("sensor.w")])
    issues = validate(
        data,
        stat_units={"sensor.a": "W", "sensor.w": "W"},
        units={DeviceKind.ELECTRICITY: ENERGY_UNITS},
    )
    assert codes(issues) == [("not_energy_unit", "sensor.a")]


# --- changes ----------------------------------------------------------------


def test_apply_move_and_keep_unknown_fields() -> None:
    old = prefs()
    new = apply_changes(
        old,
        [
            {"type": "move", "stat": "sensor.grinder", "parent": "sensor.garage"},
            {"type": "move", "stat": "sensor.kitchen", "parent": None},
        ],
    )
    devices = {d["stat_consumption"]: d for d in new["device_consumption"]}
    assert devices["sensor.grinder"] == device(
        "sensor.grinder", "sensor.garage", future_field={"keep": True}
    )
    assert "included_in_stat" not in devices["sensor.kitchen"]
    assert devices["sensor.main"] == device(
        "sensor.main", stat_rate="sensor.main_power", name="Main"
    )
    # The input is not modified and other keys are copied.
    assert old == prefs()
    assert new["device_consumption_water"] == []
    assert new["device_consumption_water"] is not old["device_consumption_water"]


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        (chr(0xFEFF) + "TV", "TV"),
        (chr(0x1C) + "TV", chr(0x1C) + "TV"),
        ("TV" + chr(0x85), "TV" + chr(0x85)),
    ],
)
def test_rename_trims_like_the_panel(name: str, expected: str) -> None:
    # Exactly the characters JavaScript's String.prototype.trim() removes (draft.ts).
    new = apply_changes(
        prefs(), [{"type": "rename", "stat": "sensor.office", "name": name}]
    )
    office = next(
        d for d in new["device_consumption"] if d["stat_consumption"] == "sensor.office"
    )
    assert office["name"] == expected


def test_apply_add_rename_remove() -> None:
    new = apply_changes(
        prefs(),
        [
            {
                "type": "add",
                "stat": "sensor.printer",
                "parent": "sensor.office",
                "name": " Printer ",
                "stat_rate": "sensor.printer_power",
            },
            {"type": "add", "stat": "sensor.tv", "name": "", "parent": None},
            {"type": "rename", "stat": "sensor.office", "name": "Office"},
            {"type": "rename", "stat": "sensor.main", "name": "  "},
            {"type": "remove", "stat": "sensor.kitchen"},
        ],
    )
    devices = new["device_consumption"]
    assert devices[-2:] == [
        {
            "stat_consumption": "sensor.printer",
            "stat_rate": "sensor.printer_power",
            "name": "Printer",
            "included_in_stat": "sensor.office",
        },
        {"stat_consumption": "sensor.tv"},
    ]
    by_stat = {d["stat_consumption"]: d for d in devices}
    assert "sensor.kitchen" not in by_stat
    assert by_stat["sensor.office"]["name"] == "Office"
    assert "name" not in by_stat["sensor.main"]
    # The children of the removed kitchen move up to its parent.
    assert by_stat["sensor.coffee"]["included_in_stat"] == "sensor.main"
    assert shape(build_tree(devices))[0][0] == "sensor.main"


def test_remove_top_level_device_makes_children_top_level() -> None:
    new = apply_changes(prefs(), [{"type": "remove", "stat": "sensor.main"}])
    roots = build_tree(new["device_consumption"])
    assert [node.stat for node in roots] == [
        "sensor.kitchen",
        "sensor.office",
        "sensor.garage",
    ]


@pytest.mark.parametrize("kind", ["remove", "use_as_home_meter"])
def test_removed_device_with_a_missing_parent_makes_children_top_level(
    kind: str,
) -> None:
    """Children do not inherit a parent that is not there (an old error)."""
    data = prefs(
        device_consumption=[
            {"stat_consumption": "sensor.p", "included_in_stat": "sensor.gone"},
            {"stat_consumption": "sensor.c1", "included_in_stat": "sensor.p"},
            {"stat_consumption": "sensor.c2", "included_in_stat": "sensor.p"},
        ],
        energy_sources=[],
    )
    new = apply_changes(data, [{"type": kind, "stat": "sensor.p"}])
    assert new["device_consumption"] == [
        {"stat_consumption": "sensor.c1"},
        {"stat_consumption": "sensor.c2"},
    ]


def test_removed_device_in_a_loop_does_not_make_a_child_its_own_parent() -> None:
    """In an old loop A <-> B, removing A must not put B under itself."""
    data = prefs(
        device_consumption=[
            {"stat_consumption": "sensor.a", "included_in_stat": "sensor.b"},
            {"stat_consumption": "sensor.b", "included_in_stat": "sensor.a"},
        ]
    )
    new = apply_changes(data, [{"type": "remove", "stat": "sensor.a"}])
    assert new["device_consumption"] == [{"stat_consumption": "sensor.b"}]


def test_apply_creates_device_list() -> None:
    new = apply_changes({"energy_sources": []}, [{"type": "add", "stat": "sensor.a"}])
    assert new["device_consumption"] == [{"stat_consumption": "sensor.a"}]


def test_apply_water_changes() -> None:
    """Device changes with `kind: water` go to the water list only."""
    old = prefs(
        device_consumption_water=[
            device("sensor.house", name="House"),
            device("sensor.garden", "sensor.house", future_field=1),
            device("sensor.hose", "sensor.garden"),
        ]
    )
    new = apply_changes(
        old,
        [
            {
                "type": "add",
                "stat": "sensor.tap",
                "parent": "sensor.house",
                "kind": "water",
            },
            {"type": "rename", "stat": "sensor.house", "name": "Main", "kind": "water"},
            {"type": "move", "stat": "sensor.hose", "parent": None, "kind": "water"},
            {"type": "remove", "stat": "sensor.garden", "kind": "water"},
            {"type": "add", "stat": "sensor.tap", "kind": "electricity"},
        ],
    )
    assert new["device_consumption_water"] == [
        device("sensor.house", name="Main"),
        device("sensor.hose"),
        device("sensor.tap", "sensor.house"),
    ]
    assert new["device_consumption"] == [*deep_devices(), device("sensor.tap")]
    # A water change never matches an electricity device.
    with pytest.raises(ChangeError) as err:
        apply_changes(old, [{"type": "remove", "stat": "sensor.main", "kind": "water"}])
    assert err.value.code == "unknown_device"


def test_apply_creates_water_list() -> None:
    new = apply_changes(
        {"energy_sources": []},
        [{"type": "add", "stat": "sensor.w", "kind": "water"}],
    )
    assert new["device_consumption_water"] == [{"stat_consumption": "sensor.w"}]
    assert new["device_consumption"] == []


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"type": "add", "stat": "sensor.main"}, "device_exists"),
        ({"type": "move", "stat": "sensor.unknown", "parent": None}, "unknown_device"),
        ({"type": "rename", "stat": "sensor.unknown", "name": "x"}, "unknown_device"),
        ({"type": "remove", "stat": "sensor.unknown"}, "unknown_device"),
        ({"type": "explode", "stat": "sensor.main"}, "unknown_change"),
    ],
)
def test_apply_errors(change: dict[str, Any], code: str) -> None:
    with pytest.raises(ChangeError) as err:
        apply_changes(prefs(), [change])
    assert err.value.code == code
    assert err.value.stat == change["stat"]


def test_changes_can_build_on_each_other() -> None:
    new = apply_changes(
        prefs([]),
        [
            {"type": "add", "stat": "sensor.a"},
            {"type": "add", "stat": "sensor.b", "parent": "sensor.a"},
            {"type": "move", "stat": "sensor.b", "parent": None},
        ],
    )
    assert new["device_consumption"] == [device("sensor.a"), device("sensor.b")]


# --- diff -------------------------------------------------------------------


def test_diff_and_summary() -> None:
    old = prefs()
    new = apply_changes(
        old,
        [
            {"type": "add", "stat": "sensor.tv", "parent": "sensor.garage"},
            {"type": "remove", "stat": "sensor.office"},
            {"type": "move", "stat": "sensor.coffee", "parent": "sensor.main"},
            {"type": "rename", "stat": "sensor.main", "name": "House"},
        ],
    )
    new["device_consumption"][0]["stat_rate"] = "sensor.other_power"
    entries = diff(old, new)
    electricity = {"kind": "electricity"}
    assert entries == [
        {"type": "added", "stat": "sensor.tv", "parent": "sensor.garage"} | electricity,
        {"type": "renamed", "stat": "sensor.main", "from": "Main", "to": "House"}
        | electricity,
        {
            "type": "rate",
            "stat": "sensor.main",
            "from": "sensor.main_power",
            "to": "sensor.other_power",
        }
        | electricity,
        {
            "type": "moved",
            "stat": "sensor.coffee",
            "from": "sensor.kitchen",
            "to": "sensor.main",
        }
        | electricity,
        {"type": "removed", "stat": "sensor.office"} | electricity,
    ]
    assert summarize(entries) == {
        "added": 1,
        "renamed": 1,
        "rate": 1,
        "moved": 1,
        "removed": 1,
    }
    assert diff(old, old) == []
    assert summarize([]) == {}


def test_diff_water_devices() -> None:
    old = prefs(device_consumption_water=[device("sensor.house"), device("sensor.tap")])
    new = apply_changes(
        old,
        [
            {"type": "add", "stat": "sensor.garden", "kind": "water"},
            {
                "type": "move",
                "stat": "sensor.tap",
                "parent": "sensor.house",
                "kind": "water",
            },
            {"type": "remove", "stat": "sensor.garage"},
            {"type": "assign_source", "role": "water", "stat": "sensor.meter"},
        ],
    )
    assert diff(old, new) == [
        {"type": "added", "stat": "sensor.garden", "parent": None, "kind": "water"},
        {"type": "source_added", "stat": "sensor.meter", "role": "water"},
        {"type": "removed", "stat": "sensor.garage", "kind": "electricity"},
        {
            "type": "moved",
            "stat": "sensor.tap",
            "from": None,
            "to": "sensor.house",
            "kind": "water",
        },
    ]
    # Without a water list on either side there is nothing to compare.
    assert diff({"device_consumption": []}, {"device_consumption": []}) == []


# --- untracked and plausibility --------------------------------------------


def test_untracked() -> None:
    roots = build_tree(deep_devices())
    values = {
        "sensor.main": 50.0,
        "sensor.kitchen": 30.0,
        "sensor.coffee": 20.0,
        "sensor.grinder": 5.0,
        "sensor.office": 10.0,
    }
    assert untracked(roots, values) == {
        "sensor.main": 10.0,
        "sensor.kitchen": 10.0,
        "sensor.coffee": 15.0,
    }
    # A child without a value measures nothing: its share is untracked.
    # Only a parent without a value has no untracked value.
    del values["sensor.office"]
    values["sensor.coffee"] = None  # type: ignore[assignment]
    assert untracked(roots, values) == {
        "sensor.main": 20.0,
        "sensor.kitchen": 30.0,
        "sensor.coffee": None,
    }


def test_untracked_missing() -> None:
    """The children without a value, for each parent that has one."""
    roots = build_tree(deep_devices())
    values = {
        "sensor.main": 50.0,
        "sensor.kitchen": 30.0,
        "sensor.coffee": 20.0,
        "sensor.grinder": 5.0,
        "sensor.office": 10.0,
    }
    assert untracked_missing(roots, values) == {}
    del values["sensor.office"]
    values["sensor.coffee"] = None  # type: ignore[assignment]
    assert untracked_missing(roots, values) == {
        "sensor.main": ["sensor.office"],
        "sensor.kitchen": ["sensor.coffee"],
    }


@pytest.mark.parametrize(
    ("parent", "children", "warn"),
    [
        (10.0, 10.5, False),  # exactly 5 %: not more than 5 %
        (10.0, 10.51, True),
        (1.0, 1.1, False),  # 10 % but only 0.1 kWh
        (1.0, 1.11, True),
        (0.0, 0.11, True),
        (0.0, 0.1, False),
        (100.0, 90.0, False),
    ],
)
def test_plausibility_limits(parent: float, children: float, warn: bool) -> None:
    roots = build_tree([device("sensor.p"), device("sensor.c", "sensor.p")])
    issues = plausibility(roots, {"sensor.p": parent, "sensor.c": children})
    assert bool(issues) is warn
    if warn:
        issue = issues[0]
        assert issue.code is IssueCode.CHILDREN_EXCEED_PARENT
        assert issue.severity is Severity.WARNING
        assert issue.stat == "sensor.p"
        assert issue.details["parent"] == parent
        assert issue.details["children"] == pytest.approx(children)
        assert issue.details["excess"] == pytest.approx(children - parent)


def test_plausibility_for_water() -> None:
    """Water uses its own minimum (in litres) and marks the issue as water."""
    roots = build_tree([device("sensor.p"), device("sensor.c", "sensor.p")])
    values = {"sensor.p": 100.0, "sensor.c": 108.0}
    assert plausibility(roots, values, min_amount=10.0, kind=DeviceKind.WATER) == []
    (issue,) = plausibility(
        roots, values | {"sensor.c": 111.0}, min_amount=10.0, kind=DeviceKind.WATER
    )
    assert issue.kind is DeviceKind.WATER
    assert issue.as_dict()["kind"] == "water"


def test_plausibility_skips_unknown_values() -> None:
    roots = build_tree([device("sensor.p"), device("sensor.c", "sensor.p")])
    assert plausibility(roots, {"sensor.c": 5.0}) == []
    assert plausibility(roots, {}) == []
    # A child without a value still means no warning, as before.
    roots = build_tree(
        [
            device("sensor.p"),
            device("sensor.c", "sensor.p"),
            device("sensor.d", "sensor.p"),
        ]
    )
    assert plausibility(roots, {"sensor.p": 1.0, "sensor.c": 5.0}) == []


# --- hash -------------------------------------------------------------------


def test_prefs_hash_is_stable() -> None:
    first = prefs()
    second = {key: first[key] for key in reversed(list(first))}
    assert prefs_hash(first) == prefs_hash(second)
    assert len(prefs_hash(first)) == 16
    changed = apply_changes(first, [{"type": "remove", "stat": "sensor.garage"}])
    assert prefs_hash(changed) != prefs_hash(first)


# --- sources ----------------------------------------------------------------

GRID_WITH_PRICES = {
    "type": "grid",
    "stat_energy_from": "sensor.import",
    "stat_energy_to": None,
    "stat_cost": None,
    "entity_energy_price": None,
    "number_energy_price": 0.3,
    "stat_compensation": None,
    "entity_energy_price_export": None,
    "number_energy_price_export": None,
    "cost_adjustment_day": 0.0,
    "power_config": {"stat_rate": "sensor.grid_power"},
}


def test_source_roles() -> None:
    sources = [
        GRID_WITH_PRICES,
        {"type": "solar", "stat_energy_from": "sensor.pv"},
        {
            "type": "battery",
            "stat_energy_from": "sensor.out",
            "stat_energy_to": "sensor.in",
        },
        {"type": "gas", "stat_energy_from": "sensor.gas"},
        {"type": "water", "stat_energy_from": "sensor.water"},
        {"type": "heat", "stat_energy_from": "sensor.heat"},
    ]
    assert source_roles(sources) == [
        ("import", "sensor.import"),
        ("production", "sensor.pv"),
        ("discharge", "sensor.out"),
        ("charge", "sensor.in"),
        ("gas", "sensor.gas"),
        ("water", "sensor.water"),
    ]


def test_assign_grid_keeps_prices_and_power() -> None:
    old = prefs(energy_sources=[deepcopy(GRID_WITH_PRICES)])
    new = apply_changes(
        old,
        [
            {"type": "assign_source", "role": "export", "stat": "sensor.export"},
            {"type": "assign_source", "role": "import", "stat": "sensor.new_import"},
        ],
    )
    (grid,) = new["energy_sources"]
    assert grid == GRID_WITH_PRICES | {
        "stat_energy_from": "sensor.new_import",
        "stat_energy_to": "sensor.export",
    }
    assert old["energy_sources"] == [GRID_WITH_PRICES]


def test_assign_grid_replaces_the_given_meter() -> None:
    """With two grid connections, `replace` picks the one to change."""
    second = NEW_GRID | {"stat_energy_from": "sensor.b", "number_energy_price": 0.2}
    old = prefs(energy_sources=[deepcopy(GRID_WITH_PRICES), deepcopy(second)])
    new = apply_changes(
        old,
        [
            {
                "type": "assign_source",
                "role": "import",
                "stat": "sensor.c",
                "replace": "sensor.b",
            }
        ],
    )
    assert new["energy_sources"] == [
        GRID_WITH_PRICES,
        second | {"stat_energy_from": "sensor.c"},
    ]
    with pytest.raises(ChangeError) as err:
        apply_changes(
            old,
            [
                {
                    "type": "assign_source",
                    "role": "export",
                    "stat": "sensor.c",
                    "replace": "sensor.b",
                }
            ],
        )
    assert (err.value.code, err.value.stat) == ("unknown_source", "sensor.b")


def test_assign_grid_creates_connection_without_costs() -> None:
    new = apply_changes(
        prefs(), [{"type": "assign_source", "role": "export", "stat": "sensor.export"}]
    )
    assert new["energy_sources"] == [NEW_GRID | {"stat_energy_to": "sensor.export"}]
    # The template is not shared between calls.
    assert NEW_GRID["stat_energy_to"] is None


def test_assign_solar_and_battery_add_sources() -> None:
    new = apply_changes(
        {"device_consumption": []},
        [
            {"type": "assign_source", "role": "production", "stat": "sensor.pv1"},
            {"type": "assign_source", "role": "production", "stat": "sensor.pv2"},
            {
                "type": "assign_source",
                "role": "battery",
                "stat": "sensor.out",
                "stat_to": "sensor.in",
            },
        ],
    )
    assert new["energy_sources"] == [
        {
            "type": "solar",
            "stat_energy_from": "sensor.pv1",
            "config_entry_solar_forecast": None,
        },
        {
            "type": "solar",
            "stat_energy_from": "sensor.pv2",
            "config_entry_solar_forecast": None,
        },
        {
            "type": "battery",
            "stat_energy_from": "sensor.out",
            "stat_energy_to": "sensor.in",
        },
    ]


@pytest.mark.parametrize(
    "change",
    [
        {"type": "assign_source", "role": "battery", "stat": "sensor.out"},
        {"type": "assign_source", "stat": "sensor.x"},
    ],
)
def test_assign_errors(change: dict[str, Any]) -> None:
    with pytest.raises(ChangeError) as err:
        apply_changes(prefs(), [change])
    assert err.value.code == "unknown_change"


def test_unassign_sources() -> None:
    sources = [
        deepcopy(GRID_WITH_PRICES) | {"stat_energy_to": "sensor.export"},
        {"type": "grid", "stat_energy_from": "sensor.second", "stat_energy_to": None},
        {"type": "solar", "stat_energy_from": "sensor.pv"},
        {
            "type": "battery",
            "stat_energy_from": "sensor.out",
            "stat_energy_to": "sensor.in",
        },
    ]
    new = apply_changes(
        prefs(energy_sources=sources),
        [
            {"type": "unassign_source", "stat": "sensor.import"},
            {"type": "unassign_source", "stat": "sensor.second"},
            {"type": "unassign_source", "stat": "sensor.pv"},
            {"type": "unassign_source", "stat": "sensor.in"},
        ],
    )
    # The first grid keeps its export meter, prices and power; the second one
    # had nothing left and is gone, as are solar and the battery.
    assert new["energy_sources"] == [
        GRID_WITH_PRICES | {"stat_energy_from": None, "stat_energy_to": "sensor.export"}
    ]
    # Without export and power the first grid disappears too.
    bare = apply_changes(
        prefs(energy_sources=[NEW_GRID | {"stat_energy_from": "sensor.a"}]),
        [{"type": "unassign_source", "stat": "sensor.a"}],
    )
    assert bare["energy_sources"] == []
    with pytest.raises(ChangeError) as err:
        apply_changes(prefs(), [{"type": "unassign_source", "stat": "sensor.nope"}])
    assert err.value.code == "unknown_source"


GAS_WITH_PRICE = {
    "type": "gas",
    "stat_energy_from": "sensor.gas_a",
    "stat_rate": "sensor.gas_flow",
    "stat_cost": None,
    "entity_energy_price": None,
    "number_energy_price": 1.4,
    "name": "Boiler",
    "future_field": True,
}


def test_assign_gas_adds_or_replaces() -> None:
    """A new gas meter has no costs; replacing one keeps its other fields."""
    water = NEW_WATER | {"stat_energy_from": "sensor.water"}
    old = prefs(energy_sources=[deepcopy(GAS_WITH_PRICE), deepcopy(water)])
    new = apply_changes(
        old,
        [
            {
                "type": "assign_source",
                "role": "gas",
                "stat": "sensor.gas_b",
                "replace": "sensor.gas_a",
            },
            {"type": "assign_source", "role": "gas", "stat": "sensor.gas_c"},
        ],
    )
    assert new["energy_sources"] == [
        GAS_WITH_PRICE | {"stat_energy_from": "sensor.gas_b"},
        water,
        NEW_GAS | {"stat_energy_from": "sensor.gas_c"},
    ]
    assert NEW_GAS == {
        "type": "gas",
        "stat_energy_from": None,
        "stat_cost": None,
        "entity_energy_price": None,
        "number_energy_price": None,
    }
    # A water meter is no gas meter.
    with pytest.raises(ChangeError) as err:
        apply_changes(
            old,
            [
                {
                    "type": "assign_source",
                    "role": "gas",
                    "stat": "sensor.x",
                    "replace": "sensor.water",
                }
            ],
        )
    assert (err.value.code, err.value.stat) == ("unknown_source", "sensor.water")


def test_unknown_source_types_cannot_be_unassigned() -> None:
    """A source type the panel does not know (a future one) stays as it is."""
    sources = [{"type": "wind", "stat_energy_from": "sensor.wind"}]
    with pytest.raises(ChangeError) as err:
        apply_changes(
            prefs(energy_sources=deepcopy(sources)),
            [{"type": "unassign_source", "stat": "sensor.wind"}],
        )
    assert err.value.code == "unknown_source"


def test_unassign_gas() -> None:
    """A gas meter is removed with its source, prices and all."""
    new = apply_changes(
        prefs(energy_sources=[deepcopy(GAS_WITH_PRICE)]),
        [{"type": "unassign_source", "stat": "sensor.gas_a"}],
    )
    assert new["energy_sources"] == []


@pytest.mark.parametrize(
    ("source", "kind"),
    [
        ({"type": "grid"}, DeviceKind.ELECTRICITY),
        ({"type": "home"}, DeviceKind.ELECTRICITY),
        ({"type": "water"}, DeviceKind.WATER),
        ({"type": "gas"}, DeviceKind.GAS),
    ],
)
def test_source_kind(source: dict[str, Any], kind: DeviceKind) -> None:
    """Gas has its own tab now, apart from electricity."""
    assert source_kind(source) is kind


def test_duplicate_gas_source_belongs_to_gas() -> None:
    gas = {"type": "gas", "stat_energy_from": "sensor.gas"}
    issues = validate(prefs(energy_sources=[gas, dict(gas)]))
    assert [(i.code, i.kind) for i in issues] == [("duplicate_source", DeviceKind.GAS)]
    assert issues[0].as_dict()["kind"] == "gas"


WATER_WITH_PRICE = {
    "type": "water",
    "stat_energy_from": "sensor.water_a",
    "stat_rate": "sensor.water_flow",
    "stat_cost": None,
    "entity_energy_price": None,
    "number_energy_price": 2.1,
    "name": "House",
    "future_field": True,
}


def test_assign_water_adds_or_replaces() -> None:
    """A new water meter has no costs; replacing one keeps its other fields."""
    gas = {"type": "gas", "stat_energy_from": "sensor.gas"}
    second = NEW_WATER | {"stat_energy_from": "sensor.water_b"}
    old = prefs(energy_sources=[deepcopy(gas), deepcopy(WATER_WITH_PRICE), second])
    new = apply_changes(
        old,
        [
            {
                "type": "assign_source",
                "role": "water",
                "stat": "sensor.water_c",
                "replace": "sensor.water_b",
            },
            {
                "type": "assign_source",
                "role": "water",
                "stat": "sensor.water_d",
                "replace": "sensor.water_a",
            },
            {"type": "assign_source", "role": "water", "stat": "sensor.water_e"},
        ],
    )
    assert new["energy_sources"] == [
        gas,
        WATER_WITH_PRICE | {"stat_energy_from": "sensor.water_d"},
        NEW_WATER | {"stat_energy_from": "sensor.water_c"},
        NEW_WATER | {"stat_energy_from": "sensor.water_e"},
    ]
    # The template is not shared between calls.
    assert NEW_WATER["stat_energy_from"] is None
    # Only water meters can be replaced this way.
    with pytest.raises(ChangeError) as err:
        apply_changes(
            old,
            [
                {
                    "type": "assign_source",
                    "role": "water",
                    "stat": "sensor.x",
                    "replace": "sensor.gas",
                }
            ],
        )
    assert (err.value.code, err.value.stat) == ("unknown_source", "sensor.gas")


def test_unassign_water() -> None:
    old = prefs(energy_sources=[deepcopy(WATER_WITH_PRICE)])
    new = apply_changes(old, [{"type": "unassign_source", "stat": "sensor.water_a"}])
    assert new["energy_sources"] == []


def test_validate_duplicate_source() -> None:
    data = prefs(
        energy_sources=[
            {
                "type": "grid",
                "stat_energy_from": "sensor.a",
                "stat_energy_to": "sensor.a",
            },
            {"type": "solar", "stat_energy_from": "sensor.b"},
        ]
    )
    assert codes(validate(data)) == [("duplicate_source", "sensor.a")]
    water = prefs(
        energy_sources=[
            {"type": "water", "stat_energy_from": "sensor.w"},
            {"type": "water", "stat_energy_from": "sensor.w"},
        ]
    )
    (issue,) = validate(water)
    assert (issue.code, issue.kind) == (IssueCode.DUPLICATE_SOURCE, DeviceKind.WATER)


def test_diff_sources() -> None:
    old = prefs(energy_sources=[deepcopy(GRID_WITH_PRICES)])
    new = apply_changes(
        old,
        [
            {"type": "assign_source", "role": "import", "stat": "sensor.new_import"},
            {"type": "assign_source", "role": "production", "stat": "sensor.pv"},
        ],
    )
    assert diff(old, new) == [
        {"type": "source_added", "stat": "sensor.new_import", "role": "import"},
        {"type": "source_added", "stat": "sensor.pv", "role": "production"},
        {"type": "source_removed", "stat": "sensor.import", "role": "import"},
    ]


def test_diff_source_rate() -> None:
    """A changed power sensor of a source shows once per source.

    HA derives `stat_rate` from `power_config`, so the derived value alone is
    no change; a source whose energy meter was replaced is matched by its other
    meter.
    """
    grid = {
        "type": "grid",
        "stat_energy_from": "sensor.imp",
        "stat_energy_to": "sensor.exp",
        "stat_rate": "sensor.grid_power",
        "power_config": {"stat_rate": "sensor.grid_power"},
    }
    solar = {"type": "solar", "stat_energy_from": "sensor.pv"}
    old = prefs(energy_sources=[grid, solar])
    same = apply_changes(
        old,
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.exp",
                "role": "export",
                "power_config": {"stat_rate": "sensor.grid_power"},
            }
        ],
    )
    assert diff(old, same) == []
    new = apply_changes(
        old,
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.exp",
                "role": "export",
                "power_config": {"stat_rate_inverted": "sensor.grid_power"},
            },
            {
                "type": "set_source_rate",
                "stat": "sensor.pv",
                "role": "production",
                "stat_rate": "sensor.pv_power",
            },
            {"type": "assign_source", "role": "import", "stat": "sensor.imp2"},
        ],
    )
    assert diff(old, new) == [
        {"type": "source_added", "stat": "sensor.imp2", "role": "import"},
        {"type": "source_removed", "stat": "sensor.imp", "role": "import"},
        {"type": "source_rate", "stat": "sensor.exp", "role": "export"},
        {"type": "source_rate", "stat": "sensor.pv", "role": "production"},
    ]
    cleared = apply_changes(
        old, [{"type": "set_source_rate", "stat": "sensor.imp", "role": "import"}]
    )
    assert diff(old, cleared) == [
        {"type": "source_rate", "stat": "sensor.imp", "role": "import"}
    ]
    assert summarize(diff(old, cleared)) == {"source_rate": 1}


def test_diff_source_rate_with_replaced_meter() -> None:
    """A power sensor set in the same draft that replaces the meter still shows.

    A source that keeps no meter is matched with the next unmatched source of
    its type; a new source with a power sensor has none before.
    """
    water = {"type": "water", "stat_energy_from": "sensor.w1"}
    grid = {"type": "grid", "stat_energy_from": "sensor.i1"}
    old = prefs(energy_sources=[grid, water])
    new = apply_changes(
        old,
        [
            {
                "type": "assign_source",
                "role": "water",
                "stat": "sensor.w2",
                "replace": "sensor.w1",
            },
            {
                "type": "set_source_rate",
                "stat": "sensor.w2",
                "role": "water",
                "stat_rate": "sensor.flow",
            },
            {
                "type": "assign_source",
                "role": "import",
                "stat": "sensor.i2",
                "replace": "sensor.i1",
            },
            {
                "type": "set_source_rate",
                "stat": "sensor.i2",
                "role": "import",
                "power_config": {"stat_rate": "sensor.p"},
            },
            {"type": "assign_source", "role": "production", "stat": "sensor.pv"},
            {
                "type": "set_source_rate",
                "stat": "sensor.pv",
                "role": "production",
                "stat_rate": "sensor.pv_power",
            },
        ],
    )
    rates = [entry for entry in diff(old, new) if entry["type"] == "source_rate"]
    assert rates == [
        {"type": "source_rate", "stat": "sensor.i2", "role": "import"},
        {"type": "source_rate", "stat": "sensor.w2", "role": "water"},
        {"type": "source_rate", "stat": "sensor.pv", "role": "production"},
    ]
    # A replaced meter whose power sensor stays is no power change.
    with_flow = prefs(energy_sources=[{**water, "stat_rate": "sensor.flow"}])
    replaced = apply_changes(
        with_flow,
        [
            {
                "type": "assign_source",
                "role": "water",
                "stat": "sensor.w2",
                "replace": "sensor.w1",
            }
        ],
    )
    assert [e["type"] for e in diff(with_flow, replaced)] == [
        "source_added",
        "source_removed",
    ]
    # Solar A (with a power sensor) removed, solar B (without) added: B never
    # had one, so nothing changed for B. With one, B's sensor is new.
    solar_a = {
        "type": "solar",
        "stat_energy_from": "sensor.a",
        "stat_rate": "sensor.pa",
    }
    old_solar = prefs(energy_sources=[solar_a])
    swapped = apply_changes(
        old_solar,
        [
            {"type": "unassign_source", "stat": "sensor.a", "role": "production"},
            {"type": "assign_source", "role": "production", "stat": "sensor.b"},
        ],
    )
    assert [e["type"] for e in diff(old_solar, swapped)] == [
        "source_added",
        "source_removed",
    ]
    with_power = apply_changes(
        swapped,
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.b",
                "role": "production",
                "stat_rate": "sensor.pb",
            }
        ],
    )
    assert diff(old_solar, with_power)[-1] == {
        "type": "source_rate",
        "stat": "sensor.b",
        "role": "production",
    }
    # A source without any meter cannot be named; it is left out.
    unknown = prefs(energy_sources=[{"type": "unknown", "stat_rate": "sensor.z"}])
    assert diff(prefs(), unknown) == []


# --- home meter ---------------------------------------------------------------

HOME_SOURCE: dict[str, Any] = {
    "type": "home",
    "stat_energy_to": "sensor.main_meter",
    "stat_rate": "sensor.main_meter_power",
    "name": "Main panel",
    "future_field": {"keep": True},
}


def test_home_source_roles() -> None:
    sources = [{"type": "home", "stat_energy_to": "sensor.main_meter"}]
    assert source_roles(sources) == [("home", "sensor.main_meter")]
    assert source_energy_stats(sources) == {"sensor.main_meter"}


def test_assign_home_adds_then_replaces() -> None:
    new = apply_changes(
        prefs(), [{"type": "assign_source", "role": "home", "stat": "sensor.a"}]
    )
    assert new["energy_sources"] == [{"type": "home", "stat_energy_to": "sensor.a"}]
    old = prefs(energy_sources=[deepcopy(HOME_SOURCE)])
    new = apply_changes(
        old, [{"type": "assign_source", "role": "home", "stat": "sensor.b"}]
    )
    assert new["energy_sources"] == [HOME_SOURCE | {"stat_energy_to": "sensor.b"}]


def test_unassign_home_removes_source() -> None:
    old = prefs(energy_sources=[deepcopy(HOME_SOURCE)])
    new = apply_changes(old, [{"type": "unassign_source", "stat": "sensor.main_meter"}])
    assert new["energy_sources"] == []


def test_untouched_home_source_survives() -> None:
    old = prefs(energy_sources=[deepcopy(HOME_SOURCE)])
    new = apply_changes(
        old, [{"type": "move", "stat": "sensor.garage", "parent": "sensor.main"}]
    )
    assert new["energy_sources"] == [HOME_SOURCE]


def test_use_as_home_meter() -> None:
    new = apply_changes(prefs(), [{"type": "use_as_home_meter", "stat": "sensor.main"}])
    stats = {d["stat_consumption"]: d for d in new["device_consumption"]}
    assert "sensor.main" not in stats
    assert "included_in_stat" not in stats["sensor.kitchen"]
    assert "included_in_stat" not in stats["sensor.office"]
    assert new["energy_sources"] == [
        {
            "type": "home",
            "stat_energy_to": "sensor.main",
            "stat_rate": "sensor.main_power",
            "name": "Main",
        }
    ]
    with pytest.raises(ChangeError) as err:
        apply_changes(
            prefs(energy_sources=[deepcopy(HOME_SOURCE)]),
            [{"type": "use_as_home_meter", "stat": "sensor.main"}],
        )
    assert err.value.code == "home_exists"
    with pytest.raises(ChangeError) as err:
        apply_changes(prefs(), [{"type": "use_as_home_meter", "stat": "sensor.gone"}])
    assert err.value.code == "unknown_device"


def test_use_as_home_meter_without_power_sensor() -> None:
    new = apply_changes(
        prefs(), [{"type": "use_as_home_meter", "stat": "sensor.garage"}]
    )
    assert new["energy_sources"] == [
        {"type": "home", "stat_energy_to": "sensor.garage"}
    ]


SOURCES_FOR_HOME: list[dict[str, Any]] = [
    {"type": "grid", "stat_energy_from": "sensor.imp", "stat_energy_to": "sensor.exp"},
    {"type": "solar", "stat_energy_from": "sensor.pv"},
    {
        "type": "battery",
        "stat_energy_from": "sensor.out",
        "stat_energy_to": "sensor.in",
    },
    {"type": "gas", "stat_energy_from": "sensor.gas"},
    {"type": "water", "stat_energy_from": "sensor.water"},
]
ENERGY_FOR_HOME: dict[str, float | None] = {
    "sensor.imp": 10.0,
    "sensor.exp": 2.0,
    "sensor.pv": 4.0,
    "sensor.out": 1.0,
    "sensor.in": 3.0,
    "sensor.gas": 50.0,
    "sensor.water": 900.0,
}


def test_home_stats() -> None:
    assert home_stats([deepcopy(HOME_SOURCE), *SOURCES_FOR_HOME]) == [
        "sensor.main_meter"
    ]
    assert home_stats(SOURCES_FOR_HOME) == [
        "sensor.imp",
        "sensor.exp",
        "sensor.pv",
        "sensor.out",
        "sensor.in",
    ]
    assert home_stats([{"type": "grid", "stat_energy_to": "sensor.exp"}]) == []
    assert home_stats([]) == []


def test_home_consumption() -> None:
    measured = [deepcopy(HOME_SOURCE), *SOURCES_FOR_HOME]
    assert home_consumption(measured, {"sensor.main_meter": 5.0}) == (5.0, "measured")
    assert home_consumption(measured, {"sensor.main_meter": None}) == (None, None)
    assert home_consumption(SOURCES_FOR_HOME, ENERGY_FOR_HOME) == (10.0, "calculated")
    only_export = [{"type": "grid", "stat_energy_to": "sensor.exp"}]
    assert home_consumption(only_export, ENERGY_FOR_HOME) == (None, None)
    missing = ENERGY_FOR_HOME | {"sensor.in": None}
    assert home_consumption(SOURCES_FOR_HOME, missing) == (None, None)
    assert home_consumption([], {}) == (None, None)
    # A home never uses less than nothing: broken statistics give no value.
    negative = ENERGY_FOR_HOME | {"sensor.imp": -10.0}
    assert home_consumption(SOURCES_FOR_HOME, negative) == (None, None)
    assert home_consumption(measured, {"sensor.main_meter": -0.5}) == (None, None)
    assert home_consumption(measured, {"sensor.main_meter": 0.0}) == (0.0, "measured")


def test_home_untracked_and_plausibility() -> None:
    roots = build_tree(
        [device("sensor.a"), device("sensor.b"), device("sensor.c", "sensor.a")]
    )
    values = {"sensor.a": 3.0, "sensor.b": 4.0, "sensor.c": 100.0}
    assert home_untracked(roots, values, 10.0) == 3.0
    # A top-level device without a value counts as untracked.
    assert home_untracked(roots, values | {"sensor.b": None}, 10.0) == 7.0
    assert home_untracked(roots, values, None) is None
    assert home_untracked([], {}, 10.0) == 10.0
    issue = home_plausibility(roots, values, 6.0)
    assert issue is not None
    assert (issue.code, issue.severity, issue.stat) == (
        IssueCode.DEVICES_EXCEED_HOME,
        Severity.WARNING,
        HOME,
    )
    assert issue.details == {"home": 6.0, "devices": 7.0, "excess": 1.0}
    assert home_plausibility(roots, {"sensor.a": 3.0, "sensor.b": 7.3}, 10.0) is None
    assert home_plausibility(roots, values, None) is None
    assert home_plausibility(roots, values | {"sensor.b": None}, 6.0) is None


def test_diff_home_source() -> None:
    old = prefs()
    new = apply_changes(
        old, [{"type": "assign_source", "role": "home", "stat": "sensor.m"}]
    )
    assert diff(old, new) == [
        {"type": "source_added", "stat": "sensor.m", "role": "home"}
    ]


def test_home_meter_may_share_the_grid_import() -> None:
    """Home Assistant allows the home meter to be the grid import meter."""
    data = prefs(
        energy_sources=[
            {"type": "grid", "stat_energy_from": "sensor.meter"},
            {"type": "home", "stat_energy_to": "sensor.meter"},
        ]
    )
    assert codes(validate(data)) == []


SHARED_METER = prefs(
    energy_sources=[
        deepcopy(GRID_WITH_PRICES) | {"stat_energy_from": "sensor.meter"},
        {"type": "home", "stat_energy_to": "sensor.meter"},
    ]
)


def test_unassign_home_meter_that_is_the_grid_import() -> None:
    """With the role, only the home meter goes; the grid keeps its prices."""
    new = apply_changes(
        SHARED_METER,
        [{"type": "unassign_source", "stat": "sensor.meter", "role": "home"}],
    )
    assert new["energy_sources"] == [
        GRID_WITH_PRICES | {"stat_energy_from": "sensor.meter"}
    ]


def test_unassign_grid_import_that_is_the_home_meter() -> None:
    """With the role, only the grid import goes; the home meter stays."""
    new = apply_changes(
        SHARED_METER,
        [{"type": "unassign_source", "stat": "sensor.meter", "role": "import"}],
    )
    assert new["energy_sources"] == [
        GRID_WITH_PRICES | {"stat_energy_from": None},
        {"type": "home", "stat_energy_to": "sensor.meter"},
    ]


def test_unassign_without_role_prefers_other_sources() -> None:
    """Old clients without a role: a shared meter leaves the grid, not Home."""
    shared = prefs(
        energy_sources=[
            {"type": "home", "stat_energy_to": "sensor.meter"},
            NEW_GRID | {"stat_energy_from": "sensor.meter"},
        ]
    )
    new = apply_changes(shared, [{"type": "unassign_source", "stat": "sensor.meter"}])
    assert new["energy_sources"] == [{"type": "home", "stat_energy_to": "sensor.meter"}]
    # Once only the home meter has it, it goes.
    again = apply_changes(new, [{"type": "unassign_source", "stat": "sensor.meter"}])
    assert again["energy_sources"] == []


def test_unassign_grid_with_the_same_meter_twice() -> None:
    """Without a role every key with the meter is cleared; with one only its key."""
    grid = NEW_GRID | {"stat_energy_from": "sensor.x", "stat_energy_to": "sensor.x"}
    data = prefs(energy_sources=[deepcopy(grid)])
    new = apply_changes(data, [{"type": "unassign_source", "stat": "sensor.x"}])
    assert new["energy_sources"] == []
    new = apply_changes(
        data, [{"type": "unassign_source", "stat": "sensor.x", "role": "export"}]
    )
    assert new["energy_sources"] == [grid | {"stat_energy_to": None}]


@pytest.mark.parametrize(
    ("role", "left"),
    [
        ("production", ["battery"]),
        ("discharge", ["solar"]),
        ("charge", ["solar"]),
        ("gas", ["solar", "battery"]),
    ],
)
def test_unassign_with_role_matches_only_that_role(role: str, left: list[str]) -> None:
    """A role picks the source by its role; another role of the stat is no match."""
    data = prefs(
        energy_sources=[
            {"type": "solar", "stat_energy_from": "sensor.s"},
            {
                "type": "battery",
                "stat_energy_from": "sensor.s",
                "stat_energy_to": "sensor.s",
            },
        ]
    )
    if role == "gas":
        with pytest.raises(ChangeError) as err:
            apply_changes(
                data, [{"type": "unassign_source", "stat": "sensor.s", "role": role}]
            )
        assert err.value.code == "unknown_source"
        return
    new = apply_changes(
        data, [{"type": "unassign_source", "stat": "sensor.s", "role": role}]
    )
    assert [s["type"] for s in new["energy_sources"]] == left


def test_unassign_grid_with_empty_power_config() -> None:
    """An empty power configuration is nothing left: the grid goes."""
    data = prefs(
        energy_sources=[NEW_GRID | {"stat_energy_to": "sensor.exp", "power_config": {}}]
    )
    new = apply_changes(data, [{"type": "unassign_source", "stat": "sensor.exp"}])
    assert new["energy_sources"] == []


def test_use_as_home_meter_keeps_the_name() -> None:
    """A name set for the device stays as the home meter's name."""
    new = apply_changes(prefs(), [{"type": "use_as_home_meter", "stat": "sensor.main"}])
    assert new["energy_sources"] == [
        {
            "type": "home",
            "stat_energy_to": "sensor.main",
            "stat_rate": "sensor.main_power",
            "name": "Main",
        }
    ]


# Suggestions from child devices


def test_child_pairs_exactly_one_parent_stat() -> None:
    stat_devices = {"sensor.strip": "dev_strip", "sensor.outlet_1": "dev_o1"}
    parents = {"dev_o1": "dev_strip"}
    assert child_pairs(stat_devices, parents, DeviceKind.ELECTRICITY) == [
        {"kind": "electricity", "stat": "sensor.outlet_1", "parent": "sensor.strip"}
    ]


def test_child_pairs_none_or_several_parent_stats() -> None:
    parents = {"dev_o1": "dev_strip"}
    none = {"sensor.outlet_1": "dev_o1"}
    several = {
        "sensor.strip_a": "dev_strip",
        "sensor.strip_b": "dev_strip",
        "sensor.outlet_1": "dev_o1",
    }
    assert child_pairs(none, parents, DeviceKind.ELECTRICITY) == []
    assert child_pairs(several, parents, DeviceKind.ELECTRICITY) == []


def test_child_pairs_ignores_devices_without_registry_device() -> None:
    stat_devices = {"sensor.strip": "dev_strip", "sensor.external": None}
    assert child_pairs(stat_devices, {}, DeviceKind.ELECTRICITY) == []


def test_child_pairs_other_list_parent() -> None:
    # The parent HA device only carries a water meter: no electricity pair.
    electricity = {"sensor.outlet_1": "dev_o1"}
    water = {"sensor.water": "dev_strip"}
    parents = {"dev_o1": "dev_strip"}
    assert child_pairs(electricity, parents, DeviceKind.ELECTRICITY) == []
    assert child_pairs(water, parents, DeviceKind.WATER) == []


def test_child_pairs_free_child_below_saved_parent() -> None:
    # A free meter (new in a draft) below a device: only the saved meter of the
    # parent device counts, a second free meter there does not make it unclear.
    stat_devices = {
        "sensor.strip": "dev_strip",
        "sensor.strip_return": "dev_strip",
        "sensor.outlet_1": "dev_o1",
    }
    parents = {"dev_o1": "dev_strip"}
    assert child_pairs(
        stat_devices, parents, DeviceKind.ELECTRICITY, saved={"sensor.strip"}
    ) == [{"kind": "electricity", "stat": "sensor.outlet_1", "parent": "sensor.strip"}]


def test_child_pairs_free_parent_only_when_unique() -> None:
    # Without a saved meter on the parent device, its one free meter counts.
    parents = {"dev_o1": "dev_strip"}
    one = {"sensor.strip": "dev_strip", "sensor.outlet_1": "dev_o1"}
    two = {
        "sensor.strip_a": "dev_strip",
        "sensor.strip_b": "dev_strip",
        "sensor.outlet_1": "dev_o1",
    }
    assert child_pairs(one, parents, DeviceKind.ELECTRICITY, saved=set()) == [
        {"kind": "electricity", "stat": "sensor.outlet_1", "parent": "sensor.strip"}
    ]
    assert child_pairs(two, parents, DeviceKind.ELECTRICITY, saved=set()) == []


def test_child_pairs_never_itself() -> None:
    # A child device whose parent is its own device (broken registry data).
    stat_devices = {"sensor.outlet_1": "dev_o1"}
    assert child_pairs(stat_devices, {"dev_o1": "dev_o1"}, DeviceKind.WATER) == []


# Home Assistant's energy validation at the blocks

HA_PREFS: dict[str, Any] = {
    "energy_sources": [
        {
            "type": "grid",
            "stat_energy_from": "sensor.grid_import",
            "stat_energy_to": "sensor.grid_export",
            "entity_energy_price": "sensor.price",
        },
        {"type": "solar", "stat_energy_from": "sensor.solar"},
    ],
    "device_consumption": [
        {"stat_consumption": "sensor.fridge", "stat_rate": "sensor.fridge_power"},
        {"stat_consumption": "sensor.tv"},
    ],
    "device_consumption_water": [{"stat_consumption": "sensor.shower"}],
}


def _issue(kind: str, entities: list[list[Any]], **placeholders: str) -> dict[str, Any]:
    return {
        "type": kind,
        "affected_entities": entities,
        "translation_placeholders": placeholders or None,
    }


def _validation(**lists: list[list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        "energy_sources": lists.get("sources", [[], []]),
        "device_consumption": lists.get("devices", [[], []]),
        "device_consumption_water": lists.get("water", [[]]),
    }


def test_ha_issues_device_by_index() -> None:
    validation = _validation(
        devices=[[], [_issue("entity_unavailable", [["sensor.tv", "unavailable"]])]],
        water=[[_issue("entity_negative_state", [["sensor.shower", -3]])]],
    )
    assert ha_issues(HA_PREFS, validation, []) == [
        {
            "stat": "sensor.tv",
            "kind": "electricity",
            "type": "entity_unavailable",
            "placeholders": None,
            "entities": [["sensor.tv", "unavailable"]],
        },
        {
            "stat": "sensor.shower",
            "kind": "water",
            "type": "entity_negative_state",
            "placeholders": None,
            "entities": [["sensor.shower", -3]],
        },
    ]


def test_ha_issues_grid_export_entity_goes_to_export_block() -> None:
    validation = _validation(
        sources=[[_issue("entity_unavailable", [["sensor.grid_export", None]])], []]
    )
    (issue,) = ha_issues(HA_PREFS, validation, [])
    assert issue["stat"] == "sensor.grid_export"


def test_ha_issues_price_entity_goes_to_first_source_block() -> None:
    validation = _validation(
        sources=[
            [
                _issue(
                    "entity_unexpected_unit_energy_price",
                    [["sensor.price", "EUR"]],
                    price_units="EUR/kWh",
                )
            ],
            [],
        ]
    )
    (issue,) = ha_issues(HA_PREFS, validation, [])
    assert issue["stat"] == "sensor.grid_import"
    assert issue["placeholders"] == {"price_units": "EUR/kWh"}


def test_ha_issues_index_beyond_list_dropped() -> None:
    validation = _validation(
        devices=[[], [], [_issue("entity_unavailable", [["sensor.x", None]])]],
        sources=[[], [], [_issue("entity_unavailable", [["sensor.y", None]])]],
    )
    assert ha_issues(HA_PREFS, validation, []) == []


def test_ha_issues_overlap_with_own_issue_dropped() -> None:
    validation = _validation(
        devices=[
            [
                _issue("statistics_not_defined", [["sensor.fridge", None]]),
                _issue("entity_unexpected_unit_energy", [["sensor.fridge", "W"]]),
                _issue("entity_unavailable", [["sensor.fridge_power", None]]),
            ],
            [],
        ]
    )
    own = [
        Issue(IssueCode.STATISTIC_MISSING, Severity.ERROR, "sensor.fridge"),
        Issue(IssueCode.NOT_ENERGY_UNIT, Severity.WARNING, "sensor.fridge"),
    ]
    assert [i["type"] for i in ha_issues(HA_PREFS, validation, own)] == [
        "entity_unavailable"
    ]


def test_ha_issues_overlap_only_for_the_same_kind() -> None:
    validation = _validation(
        water=[[_issue("entity_unexpected_unit_water", [["sensor.shower", "W"]])]]
    )
    own = [Issue(IssueCode.NOT_ENERGY_UNIT, Severity.WARNING, "sensor.shower")]
    assert len(ha_issues(HA_PREFS, validation, own)) == 1


def test_ha_issues_stat_both_source_and_device() -> None:
    prefs = deepcopy(HA_PREFS)
    prefs["device_consumption"][1]["stat_consumption"] = "sensor.solar"
    validation = _validation(
        sources=[[], [_issue("entity_unavailable", [["sensor.solar", None]])]],
        devices=[[], [_issue("entity_unavailable", [["sensor.solar", None]])]],
    )
    issues = ha_issues(prefs, validation, [])
    assert [(i["stat"], i["kind"]) for i in issues] == [
        ("sensor.solar", "electricity"),
    ]


def test_ha_issues_tolerates_missing_or_odd_data() -> None:
    assert ha_issues(HA_PREFS, {}, []) == []
    odd = {"device_consumption": [[{"type": "x"}], "nonsense"]}
    (issue,) = ha_issues(HA_PREFS, odd, [])
    assert issue == {
        "stat": "sensor.fridge",
        "kind": "electricity",
        "type": "x",
        "placeholders": None,
        "entities": [],
    }


def test_card_ha_issues_allowlist_and_price_types() -> None:
    issues = [
        {
            "stat": "sensor.grid_import",
            "kind": "electricity",
            "type": t,
            "placeholders": None,
            "entities": e,
        }
        for t, e in [
            ("entity_unexpected_unit_energy_price", [["sensor.grid_import", "x"]]),
            ("entity_unavailable", [["sensor.price", None]]),
            ("entity_unexpected_state_class", [["sensor.grid_import_cost", None]]),
            ("entity_unavailable", [["sensor.grid_import", None], ["sensor.price", 1]]),
        ]
    ]
    assert "entity_gas_price_unit_mismatch" in PRICE_ISSUE_TYPES
    assert card_ha_issues(issues, {"sensor.grid_import"}) == [
        {
            "stat": "sensor.grid_import",
            "kind": "electricity",
            "type": "entity_unavailable",
            "placeholders": None,
            "entities": [["sensor.grid_import", None]],
        }
    ]


def test_ha_issues_source_without_blocks_and_odd_issue() -> None:
    """A source with no statistic and a malformed issue are skipped."""
    prefs = deepcopy(HA_PREFS)
    prefs["energy_sources"].append({"type": "gas"})
    validation = _validation(
        sources=[["not an issue"], [], [_issue("entity_unavailable", [["x", None]])]]
    )
    assert ha_issues(prefs, validation, []) == []


def test_ha_issues_same_sensor_reported_twice_shows_once() -> None:
    """The home meter may be the grid import meter; HA checks it per source."""
    prefs = {
        "energy_sources": [
            {"type": "grid", "stat_energy_from": "sensor.meter"},
            {"type": "home", "stat_energy_to": "sensor.meter"},
        ],
        "device_consumption": [],
        "device_consumption_water": [],
    }
    unavailable = _issue("entity_unavailable", [["sensor.meter", "unavailable"]])
    validation = _validation(sources=[[unavailable], [dict(unavailable)]])
    assert [(i["stat"], i["type"]) for i in ha_issues(prefs, validation, [])] == [
        ("sensor.meter", "entity_unavailable")
    ]


def test_ha_issues_missing_entity_covered_by_own_check() -> None:
    validation = _validation(
        devices=[[_issue("entity_not_defined", [["sensor.fridge", None]])], []]
    )
    own = [Issue(IssueCode.STATISTIC_MISSING, Severity.ERROR, "sensor.fridge")]
    assert ha_issues(HA_PREFS, validation, own) == []


def test_ha_issues_power_only_grid_goes_to_its_power_sensor() -> None:
    """A grid connection with only power sensors shows HA's messages there."""
    prefs = {
        "energy_sources": [
            {
                "type": "grid",
                "stat_energy_from": None,
                "stat_energy_to": None,
                "power_config": {
                    "stat_rate_from": "sensor.grid_power_in",
                    "stat_rate_to": "sensor.grid_power_out",
                },
            },
            {"type": "grid", "stat_rate": "sensor.grid_2_power"},
            {"type": "grid", "stat_energy_from": None},
        ]
    }
    validation = {
        "energy_sources": [
            [
                _issue("entity_unavailable", [["sensor.grid_power_out", None]]),
                _issue("entity_not_numeric", []),
            ],
            [_issue("entity_unavailable", [["sensor.grid_2_power", None]])],
            [_issue("entity_unavailable", [])],
        ]
    }
    assert [
        (i["stat"], i["kind"], i["type"]) for i in ha_issues(prefs, validation, [])
    ] == [
        ("sensor.grid_power_out", "electricity", "entity_unavailable"),
        ("sensor.grid_power_in", "electricity", "entity_not_numeric"),
        ("sensor.grid_2_power", "electricity", "entity_unavailable"),
    ]


# --- errors a change adds ----------------------------------------------------


def _errors(**extra: Any) -> list[Issue]:
    return validate(prefs(**extra))


def test_new_errors_ignores_errors_that_were_there() -> None:
    before = _errors(
        device_consumption=[
            {"stat_consumption": "sensor.a", "included_in_stat": "sensor.gone"}
        ]
    )
    after = _errors(
        device_consumption=[
            {"stat_consumption": "sensor.a", "included_in_stat": "sensor.gone"},
            {"stat_consumption": "sensor.b"},
        ]
    )
    assert new_errors(before, after) == []
    assert [d["existing"] for d in issue_dicts(before, after)] == [True]


def test_new_errors_sees_a_worse_error_under_the_same_name() -> None:
    a = {"stat_consumption": "sensor.a"}
    # A third copy of a doubled device.
    assert new_errors(
        _errors(device_consumption=[a, a]), _errors(device_consumption=[a, a, a])
    )
    # Another missing parent for the same device.
    old = [{"stat_consumption": "sensor.a", "included_in_stat": "sensor.x"}]
    new = [{"stat_consumption": "sensor.a", "included_in_stat": "sensor.y"}]
    (error,) = new_errors(
        _errors(device_consumption=old), _errors(device_consumption=new)
    )
    assert error.code is IssueCode.MISSING_PARENT
    # A meter used by a third source.
    solar = {"type": "solar", "stat_energy_from": "sensor.s"}
    twice = _errors(energy_sources=[solar, solar], device_consumption=[])
    thrice = _errors(energy_sources=[solar, solar, solar], device_consumption=[])
    assert twice[0].details == {"count": 2}
    assert [i.code for i in new_errors(twice, thrice)] == [IssueCode.DUPLICATE_SOURCE]
    marked = issue_dicts(twice, thrice)
    assert [d["existing"] for d in marked] == [False]


def test_new_errors_ignores_the_list_of_a_doubled_source() -> None:
    """Which source's list a doubled meter belongs to may change by itself."""
    solar = {"type": "solar", "stat_energy_from": "sensor.s"}
    gas = {"type": "gas", "stat_energy_from": "sensor.s"}
    before = _errors(energy_sources=[solar, gas, solar], device_consumption=[])
    after = _errors(energy_sources=[solar, gas], device_consumption=[])
    assert new_errors(before, after) == []


def test_issue_dicts_marks_warnings_that_were_there() -> None:
    """Statistics unknown to the recorder: the old ones are marked."""
    known = {"sensor.other": "kWh"}
    units = {DeviceKind.ELECTRICITY: ("kWh",), DeviceKind.WATER: ("L",)}
    before = validate(prefs(), known, units)
    devices = [*deep_devices(), {"stat_consumption": "sensor.new"}]
    after = validate(prefs(devices), known, units)
    marks = {(d["stat"], d["existing"]) for d in issue_dicts(before, after)}
    assert ("sensor.main", True) in marks
    assert ("sensor.new", False) in marks


def test_new_errors_keeps_the_lists_apart() -> None:
    """The same error in the water list is not the old one of electricity."""
    broken = [{"stat_consumption": "sensor.a", "included_in_stat": "sensor.gone"}]
    before = _errors(device_consumption=broken)
    after = _errors(device_consumption=broken, device_consumption_water=broken)
    (error,) = new_errors(before, after)
    assert error.kind is DeviceKind.WATER


# --- names of devices with several meters -----------------------------------


def test_ambiguous_devices_share_a_label_within_one_list() -> None:
    """Like HA: devices whose label collides get the entity part; own names win."""
    devices = [
        {"stat_consumption": "sensor.ch1"},
        {"stat_consumption": "sensor.ch2"},
        {"stat_consumption": "sensor.ch3", "name": "Pro EM"},
        {"stat_consumption": "sensor.lamp"},
        {"stat_consumption": "sensor.portal"},
    ]
    labels = {
        "sensor.ch1": "Pro EM",
        "sensor.ch2": "Pro EM",
        "sensor.ch3": "Pro EM",
        "sensor.lamp": "Lamp",
        "sensor.portal": None,
    }
    assert ambiguous_devices(devices, labels) == {"sensor.ch1", "sensor.ch2"}
    # A user-set name counts towards a collision, but never gives way.
    assert ambiguous_devices(devices[2:4] + devices[:1], labels) == {"sensor.ch1"}
    assert ambiguous_devices(devices[3:], labels) == set()


def test_set_rate_sets_and_clears() -> None:
    """A power sensor is set on a device, trimmed away when empty, others stay."""
    prefs = {"device_consumption": [{"stat_consumption": "sensor.a", "x_unknown": 1}]}
    out = apply_changes(
        prefs, [{"type": "set_rate", "stat": "sensor.a", "stat_rate": "sensor.a_power"}]
    )
    assert out["device_consumption"][0] == {
        "stat_consumption": "sensor.a",
        "x_unknown": 1,
        "stat_rate": "sensor.a_power",
    }
    out = apply_changes(
        out, [{"type": "set_rate", "stat": "sensor.a", "stat_rate": None}]
    )
    assert out["device_consumption"][0] == {
        "stat_consumption": "sensor.a",
        "x_unknown": 1,
    }


def test_set_rate_unknown_device() -> None:
    with pytest.raises(ChangeError, match="unknown_device"):
        apply_changes(
            {"device_consumption": []},
            [{"type": "set_rate", "stat": "sensor.x", "stat_rate": None}],
        )


def test_set_rate_water_list() -> None:
    """With kind "water" only the water list changes."""
    prefs = {
        "device_consumption": [{"stat_consumption": "sensor.a"}],
        "device_consumption_water": [{"stat_consumption": "sensor.a"}],
    }
    out = apply_changes(
        prefs,
        [
            {
                "type": "set_rate",
                "stat": "sensor.a",
                "stat_rate": "sensor.a_flow",
                "kind": "water",
            }
        ],
    )
    assert out["device_consumption_water"] == [
        {"stat_consumption": "sensor.a", "stat_rate": "sensor.a_flow"}
    ]
    assert out["device_consumption"] == [{"stat_consumption": "sensor.a"}]


@pytest.mark.parametrize(
    "config",
    [
        {"stat_rate": "sensor.grid_w"},
        {"stat_rate_inverted": "sensor.grid_w"},
        {"stat_rate_from": "sensor.imp_w", "stat_rate_to": "sensor.exp_w"},
    ],
)
def test_set_source_rate_grid_variants(config: dict[str, str]) -> None:
    """A grid's power sensor is written as power_config; HA derives stat_rate."""
    grid = {
        "type": "grid",
        "stat_energy_from": "sensor.imp",
        "stat_energy_to": "sensor.exp",
        "stat_rate": "old",
        "x": 1,
    }
    out = apply_changes(
        prefs(energy_sources=[grid]),
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.imp",
                "role": "import",
                "power_config": config,
            }
        ],
    )
    result = out["energy_sources"][0]
    assert result["power_config"] == config
    assert "stat_rate" not in result
    assert result["x"] == 1


def test_set_source_rate_clear_grid_and_battery() -> None:
    """power_config None removes power_config and stat_rate."""
    sources = [
        {
            "type": "grid",
            "stat_energy_from": "sensor.imp",
            "stat_energy_to": None,
            "stat_rate": "old",
            "power_config": {"stat_rate": "old"},
        },
        {
            "type": "battery",
            "stat_energy_from": "sensor.dis",
            "stat_energy_to": "sensor.chg",
            "power_config": {"stat_rate_inverted": "sensor.b"},
        },
    ]
    out = apply_changes(
        prefs(energy_sources=sources),
        [
            {"type": "set_source_rate", "stat": "sensor.imp", "role": "import"},
            {
                "type": "set_source_rate",
                "stat": "sensor.chg",
                "role": "charge",
                "power_config": None,
            },
        ],
    )
    for source in out["energy_sources"]:
        assert "power_config" not in source
        assert "stat_rate" not in source


def test_set_source_rate_battery_config() -> None:
    """A battery takes power_config too."""
    battery = {
        "type": "battery",
        "stat_energy_from": "sensor.dis",
        "stat_energy_to": "sensor.chg",
    }
    config = {"stat_rate_from": "sensor.a", "stat_rate_to": "sensor.b"}
    out = apply_changes(
        prefs(energy_sources=[battery]),
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.dis",
                "role": "discharge",
                "power_config": config,
            }
        ],
    )
    assert out["energy_sources"][0]["power_config"] == config


@pytest.mark.parametrize(
    ("source", "role"),
    [
        ({"type": "solar", "stat_energy_from": "sensor.pv"}, "production"),
        ({"type": "gas", "stat_energy_from": "sensor.pv"}, "gas"),
        ({"type": "water", "stat_energy_from": "sensor.pv"}, "water"),
        ({"type": "home", "stat_energy_to": "sensor.pv"}, "home"),
    ],
)
def test_set_source_rate_plain_sources(source: dict[str, Any], role: str) -> None:
    """Solar, gas, water and home only take stat_rate; None removes it."""
    base = prefs(energy_sources=[{**source, "x": 1}])
    change = {"type": "set_source_rate", "stat": "sensor.pv", "role": role}
    out = apply_changes(base, [{**change, "stat_rate": "sensor.pv_w"}])
    assert out["energy_sources"][0]["stat_rate"] == "sensor.pv_w"
    assert out["energy_sources"][0]["x"] == 1
    out = apply_changes(out, [{**change, "stat_rate": None}])
    assert "stat_rate" not in out["energy_sources"][0]
    with pytest.raises(ChangeError) as err:
        apply_changes(base, [{**change, "power_config": {"stat_rate": "sensor.pv_w"}}])
    assert err.value.code == "invalid_power_config"


def test_set_source_rate_role_picks_grid_not_home() -> None:
    """The home meter may share the grid import's statistic; the role decides."""
    sources = [
        {"type": "home", "stat_energy_to": "sensor.main"},
        {"type": "grid", "stat_energy_from": "sensor.main", "stat_energy_to": None},
    ]
    base = prefs(energy_sources=sources)
    out = apply_changes(
        base,
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.main",
                "role": "import",
                "power_config": {"stat_rate": "sensor.g"},
            }
        ],
    )
    assert "stat_rate" not in out["energy_sources"][0]
    assert out["energy_sources"][1]["power_config"] == {"stat_rate": "sensor.g"}
    out = apply_changes(
        base,
        [
            {
                "type": "set_source_rate",
                "stat": "sensor.main",
                "role": "home",
                "stat_rate": "sensor.h",
            }
        ],
    )
    assert out["energy_sources"][0]["stat_rate"] == "sensor.h"
    assert "power_config" not in out["energy_sources"][1]


@pytest.mark.parametrize(
    "change",
    [
        {"stat_rate": "sensor.w"},
        {"power_config": {}},
        {"power_config": {"stat_rate": "a", "stat_rate_inverted": "b"}},
        {"power_config": {"stat_rate_from": "a"}},
        {"power_config": {"stat_rate": ""}},
        {"power_config": {"other": "a"}},
    ],
)
def test_set_source_rate_rejects_bad_grid_config(change: dict[str, Any]) -> None:
    """Grid and battery need exactly one valid power_config shape."""
    base = prefs(
        energy_sources=[
            {"type": "grid", "stat_energy_from": "sensor.imp", "stat_energy_to": None}
        ]
    )
    with pytest.raises(ChangeError) as err:
        apply_changes(
            base,
            [
                {
                    "type": "set_source_rate",
                    "stat": "sensor.imp",
                    "role": "import",
                    **change,
                }
            ],
        )
    assert err.value.code == "invalid_power_config"


def test_set_source_rate_unknown_source() -> None:
    """No source with that statistic and role raises unknown_source."""
    base = prefs(
        energy_sources=[
            {"type": "grid", "stat_energy_from": "sensor.imp", "stat_energy_to": None}
        ]
    )
    for stat, role in (("sensor.gone", "import"), ("sensor.imp", "export")):
        with pytest.raises(ChangeError) as err:
            apply_changes(
                base,
                [
                    {
                        "type": "set_source_rate",
                        "stat": stat,
                        "role": role,
                        "power_config": None,
                    }
                ],
            )
        assert err.value.code == "unknown_source"


def counted(nodes: list[Node], inputs: dict[str, list[str]]) -> list[tuple[str, str]]:
    """Return (device, meter) of each counted_twice warning; check it is one."""
    issues = counted_twice(nodes, inputs)
    assert all(
        i.code is IssueCode.COUNTED_TWICE and i.severity is Severity.WARNING
        for i in issues
    )
    assert not has_errors(issues)
    return [(i.stat, i.details["meter"]) for i in issues]


def test_counted_twice_top_level() -> None:
    """A device in another device's meter, but not below it, is counted twice."""
    roots = build_tree([*deep_devices(), device("sensor.sum")])
    inputs = {"sensor.sum": ["sensor.garage", "sensor.office"]}
    assert counted(roots, inputs) == [
        ("sensor.office", "sensor.sum"),
        ("sensor.garage", "sensor.sum"),
    ]
    (issue, _) = counted_twice(roots, inputs, kind=DeviceKind.WATER)
    assert issue.kind is DeviceKind.WATER


def test_counted_twice_not_below_owner() -> None:
    """Below the meter that holds it, a device is counted once."""
    roots = build_tree(deep_devices())
    assert counted(roots, {"sensor.main": ["sensor.office", "sensor.grinder"]}) == []
    # A meter holding itself is no second device.
    assert counted(roots, {"sensor.garage": ["sensor.garage"]}) == []
    # Office is next to the kitchen, not below it.
    assert counted(roots, {"sensor.kitchen": ["sensor.office", "sensor.grinder"]}) == [
        ("sensor.office", "sensor.kitchen")
    ]


def test_counted_twice_ignores_subtracted() -> None:
    """A subtracted meter is not in the inputs: gross = meter - returned + solar."""
    roots = build_tree(
        [device("sensor.gross"), device("sensor.meter"), device("sensor.returned")]
    )
    inputs = {"sensor.gross": ["sensor.meter", "sensor.solar"]}
    assert counted(roots, inputs) == [("sensor.meter", "sensor.gross")]
