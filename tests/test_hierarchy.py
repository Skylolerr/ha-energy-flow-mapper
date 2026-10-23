"""Tests for the pure hierarchy functions."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from custom_components.energy_flow_mapper.hierarchy import (
    NEW_GRID,
    ChangeError,
    IssueCode,
    Node,
    Severity,
    apply_changes,
    build_tree,
    diff,
    has_errors,
    parent_map,
    plausibility,
    prefs_hash,
    source_energy_stats,
    source_roles,
    summarize,
    tree_depth,
    untracked,
    used_stats,
    validate,
    walk,
)

ENERGY_UNITS = ("Wh", "kWh", "MWh")


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
        energy_units=ENERGY_UNITS,
    )
    assert codes(issues) == [
        ("not_energy_unit", "sensor.wrong"),
        ("statistic_missing", "sensor.gone"),
    ]
    assert issues[0].details == {"unit": "W"}
    assert not has_errors(issues)


def test_validate_without_device_list() -> None:
    assert validate({"energy_sources": []}) == []


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


def test_apply_creates_device_list() -> None:
    new = apply_changes({"energy_sources": []}, [{"type": "add", "stat": "sensor.a"}])
    assert new["device_consumption"] == [{"stat_consumption": "sensor.a"}]


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
    assert entries == [
        {"type": "added", "stat": "sensor.tv", "parent": "sensor.garage"},
        {"type": "renamed", "stat": "sensor.main", "from": "Main", "to": "House"},
        {
            "type": "rate",
            "stat": "sensor.main",
            "from": "sensor.main_power",
            "to": "sensor.other_power",
        },
        {
            "type": "moved",
            "stat": "sensor.coffee",
            "from": "sensor.kitchen",
            "to": "sensor.main",
        },
        {"type": "removed", "stat": "sensor.office"},
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
    del values["sensor.office"]
    values["sensor.coffee"] = None  # type: ignore[assignment]
    assert untracked(roots, values) == {
        "sensor.main": None,
        "sensor.kitchen": None,
        "sensor.coffee": None,
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


def test_plausibility_skips_unknown_values() -> None:
    roots = build_tree([device("sensor.p"), device("sensor.c", "sensor.p")])
    assert plausibility(roots, {"sensor.c": 5.0}) == []
    assert plausibility(roots, {}) == []


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
        {"type": "heat", "stat_energy_from": "sensor.heat"},
    ]
    assert source_roles(sources) == [
        ("import", "sensor.import"),
        ("production", "sensor.pv"),
        ("discharge", "sensor.out"),
        ("charge", "sensor.in"),
        ("consumption", "sensor.gas"),
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
        {"type": "assign_source", "role": "gas", "stat": "sensor.gas"},
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
