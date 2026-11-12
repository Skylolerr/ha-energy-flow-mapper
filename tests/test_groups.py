"""Tests for the pure group functions."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from custom_components.energy_flow_mapper.groups import (
    GROUP_CHANGE_TYPES,
    Group,
    Groups,
    all_devices,
    apply_all,
    clean_groups,
    diff_groups,
    empty_groups,
    groups_of,
    state_hash,
)
from custom_components.energy_flow_mapper.hierarchy import ChangeError, DeviceKind


def dev(stat: str, parent: str | None = None) -> dict[str, Any]:
    """Return a device entry."""
    return {"stat_consumption": stat, "included_in_stat": parent}


def grp(
    gid: str,
    members: list[str],
    parent: str | None = None,
    group: str | None = None,
) -> Group:
    """Return a group."""
    return {
        "id": gid,
        "name": gid,
        "parent": parent,
        "group": group,
        "members": members,
    }


def prefs(*devices: dict[str, Any], water: list[dict[str, Any]] | None = None) -> dict:
    """Return energy preferences with the given devices."""
    return {
        "energy_sources": [],
        "device_consumption": list(devices),
        "device_consumption_water": water or [],
    }


def electricity(*items: Group) -> Groups:
    """Return groups holding the given electricity groups."""
    return {"electricity": list(items), "water": []}


def test_empty_groups_and_groups_of() -> None:
    assert empty_groups() == {"electricity": [], "water": []}
    assert groups_of({}, DeviceKind.WATER) == []
    stored = electricity(grp("g", ["a"]))
    assert groups_of(stored, DeviceKind.ELECTRICITY) == stored["electricity"]


def test_clean_keeps_a_valid_group() -> None:
    stored = electricity(grp("g", ["b", "c"], parent="a"))
    p = prefs(dev("a"), dev("b", "a"), dev("c", "a"))
    original = deepcopy(stored)
    assert clean_groups(stored, p) == original
    assert stored == original


def test_clean_handles_missing_kind() -> None:
    assert clean_groups({}, prefs(dev("a"))) == empty_groups()


def test_clean_drops_devices_no_longer_in_the_list() -> None:
    stored = electricity(grp("g", ["a", "b", "gone"]))
    cleaned = clean_groups(stored, prefs(dev("a"), dev("b")))
    assert cleaned["electricity"][0]["members"] == ["a", "b"]


def test_clean_adopts_new_common_parent() -> None:
    stored = electricity(grp("g", ["b", "c"], parent="a"))
    p = prefs(dev("p"), dev("b"), dev("c"))
    cleaned = clean_groups(stored, p)
    assert cleaned["electricity"][0]["parent"] is None
    assert cleaned["electricity"][0]["members"] == ["b", "c"]


def test_clean_adopts_parent_of_nested_devices_too() -> None:
    stored = electricity(
        grp("outer", [], parent="a"),
        grp("inner", ["b"], parent="a", group="outer"),
    )
    cleaned = clean_groups(stored, prefs(dev("b", "p"), dev("p")))
    assert [g["parent"] for g in cleaned["electricity"]] == ["p", "p"]
    assert cleaned["electricity"][1]["group"] == "outer"


def test_clean_drops_member_with_other_parent() -> None:
    stored = electricity(grp("g", ["b", "c", "d"], parent="a"))
    p = prefs(dev("a"), dev("x"), dev("b", "a"), dev("c", "a"), dev("d", "x"))
    cleaned = clean_groups(stored, p)
    assert cleaned["electricity"][0]["members"] == ["b", "c"]
    assert cleaned["electricity"][0]["parent"] == "a"


def test_clean_moves_nested_group_with_other_parent_to_top() -> None:
    stored = electricity(
        grp("outer", ["b"], parent="a"),
        grp("inner", ["c"], parent="x", group="outer"),
    )
    p = prefs(dev("a"), dev("x"), dev("b", "a"), dev("c", "x"))
    cleaned = clean_groups(stored, p)
    assert [(g["id"], g["group"]) for g in cleaned["electricity"]] == [
        ("outer", None),
        ("inner", None),
    ]


def test_clean_keeps_nested_group_with_same_parent() -> None:
    stored = electricity(
        grp("outer", ["b"], parent="a"),
        grp("inner", ["c"], parent="a", group="outer"),
    )
    p = prefs(dev("a"), dev("b", "a"), dev("c", "a"))
    assert clean_groups(stored, p) == stored


def test_clean_removes_groups_without_devices() -> None:
    stored = electricity(
        grp("empty", ["gone"]),
        grp("outer", [], parent=None),
        grp("inner", ["gone2"], group="outer"),
        grp("ok", ["a"]),
    )
    cleaned = clean_groups(stored, prefs(dev("a")))
    assert [g["id"] for g in cleaned["electricity"]] == ["ok"]


def test_clean_device_in_two_groups_keeps_first() -> None:
    stored = electricity(grp("one", ["a"]), grp("two", ["a", "b"]))
    cleaned = clean_groups(stored, prefs(dev("a"), dev("b")))
    assert [(g["id"], g["members"]) for g in cleaned["electricity"]] == [
        ("one", ["a"]),
        ("two", ["b"]),
    ]


def test_clean_unknown_enclosing_group_becomes_top_level() -> None:
    stored = electricity(grp("g", ["a"], group="missing"))
    cleaned = clean_groups(stored, prefs(dev("a")))
    assert cleaned["electricity"][0]["group"] is None


def test_clean_breaks_looping_enclosing_groups() -> None:
    stored = electricity(
        grp("a", ["x"], group="b"),
        grp("b", ["y"], group="a"),
        grp("c", ["z"], group="c"),
    )
    cleaned = clean_groups(stored, prefs(dev("x"), dev("y"), dev("z")))
    # Breaking the loop at "a" leaves a valid chain: b inside a.
    assert [g["group"] for g in cleaned["electricity"]] == [None, "a", None]


def test_clean_water_groups_use_water_devices() -> None:
    stored = {"electricity": [], "water": [grp("w", ["tap", "gone"])]}
    p = prefs(dev("tap"), water=[dev("tap"), dev("shower")])
    cleaned = clean_groups(stored, p)
    assert cleaned["water"][0]["members"] == ["tap"]
    assert cleaned["electricity"] == []
    assert clean_groups(stored, prefs(dev("tap")))["water"] == []


def titled(gid: str, name: str, members: list[str], **extra: Any) -> Group:
    """Return a group with its own name."""
    return grp(gid, members, **extra) | {"name": name}


def test_clean_drops_later_groups_with_a_known_id() -> None:
    """A damaged store with one id twice keeps the first; clean is a fixpoint."""
    stored = electricity(grp("g", ["a"]), grp("g", ["b"], group="x"))
    p = prefs(dev("a"), dev("b"))
    cleaned = clean_groups(stored, p)
    assert cleaned["electricity"] == [grp("g", ["a"])]
    assert clean_groups(cleaned, p) == cleaned


def test_clean_trims_names_and_drops_blank_ones() -> None:
    """Names are trimmed like the panel does; a blank one ungroups its members."""
    stored = electricity(
        titled("g1", "  Kitchen　", ["a"]),
        titled("g2", " 	﻿", ["b"]),
        titled("g3", "Inner", ["c"], group="g2"),
    )
    p = prefs(dev("a"), dev("b"), dev("c"))
    cleaned = clean_groups(stored, p)["electricity"]
    assert [(g["id"], g["name"], g["group"]) for g in cleaned] == [
        ("g1", "Kitchen", None),
        ("g3", "Inner", None),
    ]


def test_clean_numbers_duplicate_names_below_one_parent() -> None:
    """The earlier group keeps its name; later ones get the first free number."""
    stored = electricity(
        titled("g1", "K", ["a"], parent="p"),
        titled("g2", " K ", ["b"], parent="p"),
        titled("g3", "K (2)", ["c"], parent="p"),
        titled("g4", "K", ["d"], parent="p", group="g1"),
        titled("g5", "K", ["e"]),
    )
    p = prefs(
        dev("p"), dev("a", "p"), dev("b", "p"), dev("c", "p"), dev("d", "p"), dev("e")
    )
    cleaned = clean_groups(stored, p)
    assert [g["name"] for g in cleaned["electricity"]] == [
        "K",
        "K (3)",
        "K (2)",
        "K (4)",
        "K",
    ]
    assert clean_groups(cleaned, p) == cleaned


def test_name_check_compares_trimmed_names() -> None:
    """A stored name that is not trimmed still takes its name."""
    stored = electricity(titled("g", " Kitchen ", ["a"], parent="p"))
    change = {
        "type": "create_group",
        "id": "n",
        "name": "Kitchen",
        "parent": "p",
        "members": ["b"],
        "groups": [],
    }
    with pytest.raises(ChangeError) as err:
        apply_all(base(), stored, [change])
    assert err.value.code == "group_name_taken"


def test_all_devices_includes_nested_groups() -> None:
    items = [
        grp("outer", ["a"]),
        grp("inner", ["b", "c"], group="outer"),
        grp("deep", ["d"], group="inner"),
        grp("other", ["e"]),
    ]
    assert all_devices(items, "outer") == ["a", "b", "c", "d"]
    assert all_devices(items, "inner") == ["b", "c", "d"]
    assert all_devices(items, "missing") == []


def test_all_devices_survives_a_loop() -> None:
    items = [grp("a", ["x"], group="b"), grp("b", ["y"], group="a")]
    assert all_devices(items, "a") == ["x", "y"]


# --- applying changes -------------------------------------------------------


def create(gid: str, members: list[str], parent: str | None = None, **extra: Any):
    """Return a create_group change."""
    return {
        "type": "create_group",
        "id": gid,
        "name": extra.pop("name", gid),
        "parent": parent,
        "members": members,
        "groups": extra.pop("groups", []),
        **extra,
    }


def base() -> dict:
    """Return prefs: p under Home; a, b, c, d under p; e under Home."""
    return prefs(
        dev("p"),
        dev("a", "p"),
        dev("b", "p"),
        dev("c", "p"),
        dev("d", "p"),
        dev("e"),
    )


def run(changes: list[dict], stored: Groups | None = None):
    """Apply changes to the base prefs."""
    return apply_all(base(), stored or empty_groups(), changes)


def code_of(changes: list[dict], stored: Groups | None = None) -> str:
    """Return the code of the ChangeError the changes raise."""
    with pytest.raises(ChangeError) as err:
        run(changes, stored)
    return err.value.code


def test_create_group() -> None:
    _, result = run([create("g", ["a", "b"], "p", name=" Kitchen ")])
    assert result["electricity"] == [
        {
            "id": "g",
            "name": "Kitchen",
            "parent": "p",
            "group": None,
            "members": ["a", "b"],
        }
    ]
    assert result["water"] == []


def test_create_group_members_leave_previous_group() -> None:
    stored = electricity(grp("old", ["a", "b"], "p"))
    _, result = run([create("g", ["a"], "p")], stored)
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["old"]["members"] == ["b"]
    assert by_id["g"]["members"] == ["a"]


def test_create_group_refuses_members_of_other_parents() -> None:
    assert code_of([create("g", ["a", "e"], "p")]) == "group_parents_differ"


def test_create_group_refuses_unknown_member() -> None:
    assert code_of([create("g", ["zzz"], "p")]) == "unknown_device"


def test_create_group_nests_groups() -> None:
    stored = electricity(grp("in", ["a"], "p"))
    _, result = run([create("g", ["b"], "p", groups=["in"])], stored)
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["in"]["group"] == "g"
    assert by_id["g"]["group"] is None


def test_create_group_inside_enclosing_group() -> None:
    stored = electricity(grp("out", ["a"], "p"))
    _, result = run([create("g", ["b"], "p", group="out")], stored)
    assert {g["id"]: g["group"] for g in result["electricity"]} == {
        "out": None,
        "g": "out",
    }


def test_create_group_refuses_other_parent_groups_and_enclosing() -> None:
    stored = electricity(grp("top", ["e"], None))
    for extra in ({"groups": ["top"]}, {"group": "top"}):
        assert code_of([create("g", ["a"], "p", **extra)], stored) == (
            "group_parents_differ"
        )


def test_create_group_refuses_a_loop_through_enclosing() -> None:
    stored = electricity(grp("in", ["a"], "p"), grp("deep", ["b"], "p", "in"))
    for enclosing in ("in", "deep"):
        change = create("g", ["c"], "p", groups=["in"], group=enclosing)
        assert code_of([change], stored) == "group_loop"


def test_create_group_refuses_existing_id() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    assert code_of([create("g", ["b"], "p")], stored) == "group_exists"


def test_group_name_rules() -> None:
    assert code_of([create("g", ["a"], "p", name="  ")]) == "group_name_empty"
    stored = electricity(grp("one", ["a"], "p"))
    assert code_of([create("g", ["b"], "p", name="one")], stored) == (
        "group_name_taken"
    )
    # The same name below another parent is fine.
    _, result = run([create("g", ["e"], None, name="one")], stored)
    assert len(result["electricity"]) == 2


def test_rename_group() -> None:
    stored = electricity(grp("one", ["a"], "p"), grp("two", ["b"], "p"))
    _, result = run([{"type": "rename_group", "id": "one", "name": " Neu "}], stored)
    assert result["electricity"][0]["name"] == "Neu"
    for name, code in (("", "group_name_empty"), ("two", "group_name_taken")):
        change = {"type": "rename_group", "id": "one", "name": name}
        assert code_of([change], stored) == code
    # Keeping its own name is not a clash.
    run([{"type": "rename_group", "id": "one", "name": "one"}], stored)


def test_set_group_in_and_out() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("h", ["b"], "p"))
    _, result = run(
        [
            {"type": "set_group", "stat": "c", "group": "g"},
            {"type": "set_group", "stat": "a", "group": None},
        ],
        stored,
    )
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["g"]["members"] == ["c"]
    assert by_id["h"]["members"] == ["b"]
    # Moving between groups takes the device out of the old one.
    _, result = run([{"type": "set_group", "stat": "b", "group": "g"}], stored)
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["g"]["members"] == ["a", "b"]
    assert "h" not in by_id  # empty groups disappear


def test_set_group_nests_and_unnests_a_group() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("h", ["b"], "p"))
    _, nested = run([{"type": "set_group", "group_id": "h", "group": "g"}], stored)
    assert {g["id"]: g["group"] for g in nested["electricity"]} == {
        "g": None,
        "h": "g",
    }
    _, out = apply_all(
        base(), nested, [{"type": "set_group", "group_id": "h", "group": None}]
    )
    assert {g["id"]: g["group"] for g in out["electricity"]} == {"g": None, "h": None}


def test_set_group_refuses_other_parents() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("top", ["e"], None))
    for change in (
        {"type": "set_group", "stat": "e", "group": "g"},
        {"type": "set_group", "group_id": "top", "group": "g"},
    ):
        assert code_of([change], stored) == "group_parents_differ"


def test_set_group_refuses_loop() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("h", ["b"], "p", "g"))
    for target in ("g", "h"):
        change = {"type": "set_group", "group_id": "g", "group": target}
        assert code_of([change], stored) == "group_loop"


def test_set_group_needs_exactly_one_subject() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    for change in (
        {"type": "set_group", "group": "g"},
        {"type": "set_group", "stat": "b", "group_id": "g", "group": "g"},
    ):
        assert code_of([change], stored) == "unknown_change"


def test_set_group_unknown_device() -> None:
    change = {"type": "set_group", "stat": "zzz", "group": None}
    assert code_of([change]) == "unknown_device"


def test_dissolve_group_moves_members_up_one_level() -> None:
    stored = electricity(
        grp("out", ["a"], "p"),
        grp("mid", ["b"], "p", "out"),
        grp("in", ["c"], "p", "mid"),
    )
    _, result = run([{"type": "dissolve_group", "id": "mid"}], stored)
    by_id = {g["id"]: g for g in result["electricity"]}
    assert set(by_id) == {"out", "in"}
    assert by_id["out"]["members"] == ["a", "b"]
    assert by_id["in"]["group"] == "out"
    # A top-level group has no enclosing group: everything goes to the top.
    _, result = apply_all(base(), result, [{"type": "dissolve_group", "id": "out"}])
    assert [g["id"] for g in result["electricity"]] == ["in"]
    assert result["electricity"][0]["group"] is None


def test_dissolve_top_level_group_frees_members() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    _, result = run([{"type": "dissolve_group", "id": "g"}], stored)
    assert result["electricity"] == []


def test_move_group_moves_all_devices_and_nested_groups() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("h", ["b"], "p", "g"))
    new_prefs, result = run([{"type": "move_group", "id": "g", "parent": "e"}], stored)
    parents = {
        d["stat_consumption"]: d.get("included_in_stat")
        for d in new_prefs["device_consumption"]
    }
    assert parents["a"] == parents["b"] == "e"
    assert parents["c"] == "p"
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["g"]["parent"] == by_id["h"]["parent"] == "e"
    assert by_id["g"]["group"] is None
    assert by_id["h"]["group"] == "g"


def test_move_group_to_home_and_into_group() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("t", ["e"], None))
    new_prefs, result = run(
        [{"type": "move_group", "id": "g", "parent": None, "group": "t"}], stored
    )
    moved = next(
        d for d in new_prefs["device_consumption"] if d["stat_consumption"] == "a"
    )
    assert moved.get("included_in_stat") is None
    by_id = {g["id"]: g for g in result["electricity"]}
    assert by_id["g"]["parent"] is None
    assert by_id["g"]["group"] == "t"


def test_move_group_without_group_goes_to_top_level() -> None:
    stored = electricity(grp("o", ["b"], "p"), grp("g", ["a"], "p", "o"))
    _, result = run([{"type": "move_group", "id": "g", "parent": "e"}], stored)
    assert {g["id"]: g["group"] for g in result["electricity"]}["g"] is None


def test_move_group_refusals() -> None:
    stored = electricity(
        grp("g", ["a"], "p"), grp("h", ["b"], "p", "g"), grp("x", ["c"], "p")
    )
    cases = (
        ({"id": "g", "parent": "a"}, "group_loop"),
        ({"id": "g", "parent": "b"}, "group_loop"),
        ({"id": "g", "parent": "p", "group": "g"}, "group_loop"),
        ({"id": "g", "parent": "p", "group": "h"}, "group_loop"),
        ({"id": "g", "parent": "e", "group": "x"}, "group_parents_differ"),
        ({"id": "g", "parent": "zzz"}, "unknown_device"),
    )
    for fields, code in cases:
        assert code_of([{"type": "move_group", **fields}], stored) == code


def test_move_out_of_parent_leaves_group() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    _, result = run([{"type": "move", "stat": "a", "parent": "e"}], stored)
    assert result["electricity"][0]["members"] == ["b"]


def test_remove_parent_keeps_groups_below_it() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    _, result = run([{"type": "remove", "stat": "p"}], stored)
    group = result["electricity"][0]
    assert group["parent"] is None
    assert group["members"] == ["a", "b"]


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("\ufeffKitchen", "Kitchen"),
        ("\u3000Kitchen\u2028", "Kitchen"),
        ("\x1cB", "\x1cB"),
        ("\x1c", "\x1c"),
        ("B\x85", "B\x85"),
    ],
)
def test_group_names_are_trimmed_like_the_panel(name: str, expected: str) -> None:
    # Exactly the characters JavaScript's String.prototype.trim() removes.
    _, result = run([create("g", ["a"], "p", name=name)])
    assert result["electricity"][0]["name"] == expected


def named(gid: str, name: str, members: list[str], parent: str | None) -> Group:
    """Return a group with its own name."""
    return {**grp(gid, members, parent), "name": name}


def test_remove_parent_numbers_a_name_taken_at_the_grandparent() -> None:
    stored = electricity(
        named("home1", "Kitchen", ["e"], None),
        named("g1", "Kitchen", ["a", "b"], "p"),
        named("g2", "Office", ["c"], "p"),
    )
    # Office does not clash.
    _, result = run([{"type": "remove", "stat": "p"}], stored)
    names = {g["id"]: (g["name"], g["parent"]) for g in result["electricity"]}
    assert names == {
        "home1": ("Kitchen", None),
        "g1": ("Kitchen (2)", None),
        "g2": ("Office", None),
    }


def test_remove_parent_numbers_from_the_base_name() -> None:
    # p with a, b, c below it; e and f at Home.
    p = prefs(dev("p"), dev("a", "p"), dev("b", "p"), dev("c", "p"), dev("e"), dev("f"))
    stored = electricity(
        named("home1", "Kitchen", ["e"], None),
        named("home2", "Kitchen (2)", ["f"], None),
        named("g1", "Kitchen", ["a"], "p"),
        named("g2", "Kitchen (2)", ["b"], "p"),
        named("g3", "Office", ["c"], "p"),
    )
    # Same case as in the panel's groups.test.ts, so both give the same names.
    _, result = apply_all(p, stored, [{"type": "remove", "stat": "p"}])
    assert [g["name"] for g in result["electricity"]] == [
        "Kitchen",
        "Kitchen (2)",
        "Kitchen (3)",
        "Kitchen (4)",
        "Office",
    ]


def test_remove_parent_ignores_a_group_that_disappears() -> None:
    # The Home group "Kitchen" holds only p; removing p empties it.
    stored = electricity(
        named("home1", "Kitchen", ["p"], None),
        named("g1", "Kitchen", ["a", "b"], "p"),
    )
    _, result = run([{"type": "remove", "stat": "p"}], stored)
    assert [(g["id"], g["name"]) for g in result["electricity"]] == [("g1", "Kitchen")]


def test_clean_adoption_ignores_a_later_group_that_disappears() -> None:
    # g1 comes first in the list; the Home group lost its only device.
    stored = electricity(
        named("g1", "Kitchen", ["a"], "p"),
        named("home1", "Kitchen", ["gone"], None),
    )
    cleaned = clean_groups(stored, prefs(dev("a")))
    assert [(g["id"], g["name"]) for g in cleaned["electricity"]] == [("g1", "Kitchen")]


def test_clean_adoption_keeps_the_first_of_two_moved_names() -> None:
    # p1 and p2 were removed outside the mapper; both groups move to Home.
    stored = electricity(
        named("g1", "Kitchen", ["a"], "p1"),
        named("g2", "Kitchen", ["b"], "p2"),
    )
    cleaned = clean_groups(stored, prefs(dev("a"), dev("b")))
    assert [g["name"] for g in cleaned["electricity"]] == ["Kitchen", "Kitchen (2)"]


def test_clean_adoption_numbers_a_name_taken_at_the_new_parent() -> None:
    # The parent p was removed outside the mapper; a and b moved up to Home.
    stored = electricity(
        named("home1", "Kitchen", ["e"], None),
        named("g1", "Kitchen", ["a", "b"], "p"),
    )
    cleaned = clean_groups(stored, prefs(dev("a"), dev("b"), dev("e")))
    assert [(g["name"], g["parent"]) for g in cleaned["electricity"]] == [
        ("Kitchen", None),
        ("Kitchen (2)", None),
    ]


def test_remove_member_keeps_the_rest() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    _, result = run([{"type": "remove", "stat": "a"}], stored)
    assert result["electricity"][0]["members"] == ["b"]


def test_remove_in_other_kind_leaves_electricity_groups() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    mixed = base()
    mixed["device_consumption_water"] = [dev("p")]
    change = {"type": "remove", "stat": "p", "kind": "water"}
    _, result = apply_all(mixed, stored, [change])
    assert result["electricity"][0]["parent"] == "p"


def test_use_as_home_meter_keeps_groups_below_it() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    new_prefs, result = run([{"type": "use_as_home_meter", "stat": "p"}], stored)
    group = result["electricity"][0]
    assert group["parent"] is None
    assert group["members"] == ["a", "b"]
    assert new_prefs["energy_sources"][0]["type"] == "home"


def test_remove_unknown_device_still_raises() -> None:
    assert code_of([{"type": "remove", "stat": "zzz"}]) == "unknown_device"


def test_water_group() -> None:
    water = prefs(water=[dev("w1"), dev("w2")])
    change = {
        "type": "create_group",
        "kind": "water",
        "id": "g",
        "name": "G",
        "parent": None,
        "members": ["w1", "w2"],
        "groups": [],
    }
    _, result = apply_all(water, empty_groups(), [change])
    assert result["water"][0]["members"] == ["w1", "w2"]
    assert result["electricity"] == []


def test_unknown_group_id() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    for change in (
        create("n", ["b"], "p", groups=["zzz"]),
        create("n", ["b"], "p", group="zzz"),
        {"type": "rename_group", "id": "zzz", "name": "x"},
        {"type": "set_group", "group_id": "zzz", "group": None},
        {"type": "set_group", "group_id": "g", "group": "zzz"},
        {"type": "set_group", "stat": "b", "group": "zzz"},
        {"type": "dissolve_group", "id": "zzz"},
        {"type": "move_group", "id": "zzz", "parent": None},
    ):
        assert code_of([change], stored) == "unknown_group"


def test_apply_all_leaves_inputs_unchanged() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    source = base()
    apply_all(
        source,
        stored,
        [
            {"type": "set_group", "stat": "a", "group": None},
            {"type": "remove", "stat": "p"},
        ],
    )
    assert source == base()
    assert stored == electricity(grp("g", ["a", "b"], "p"))


def test_apply_all_without_changes_copies() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    new_prefs, result = apply_all(base(), stored, [])
    assert new_prefs == base()
    assert result == stored
    assert result is not stored


def test_group_change_types() -> None:
    assert {
        "create_group",
        "rename_group",
        "set_group",
        "dissolve_group",
        "move_group",
    } == GROUP_CHANGE_TYPES


def test_diff_groups() -> None:
    old = electricity(
        grp("keep", ["a"], "p"),
        grp("ren", ["b"], "p"),
        grp("gone", ["c"], "p"),
        grp("chg", ["d"], "p"),
    )
    new = electricity(
        grp("keep", ["a"], "p"),
        grp("ren", ["b"], "p"),
        grp("chg", ["d", "c"], "p"),
        grp("new", ["e"]),
    )
    new["electricity"][1]["name"] = "Renamed"
    new["water"] = [grp("w", ["w1"])]
    ele, wat = DeviceKind.ELECTRICITY, DeviceKind.WATER
    assert diff_groups(old, new) == [
        {
            "type": "group_created",
            "id": "new",
            "name": "new",
            "count": 1,
            "kind": ele,
            "stat": "group:new",
        },
        {
            "type": "group_created",
            "id": "w",
            "name": "w",
            "count": 1,
            "kind": wat,
            "stat": "group:w",
        },
        {
            "type": "group_renamed",
            "id": "ren",
            "from": "ren",
            "to": "Renamed",
            "kind": ele,
            "stat": "group:ren",
        },
        {
            "type": "group_dissolved",
            "id": "gone",
            "name": "gone",
            "kind": ele,
            "stat": "group:gone",
        },
        {
            "type": "group_changed",
            "id": "chg",
            "name": "chg",
            "count": 2,
            "kind": ele,
            "stat": "group:chg",
        },
    ]
    assert diff_groups(old, old) == []


def test_state_hash_changes_with_groups() -> None:
    one = electricity(grp("g", ["a"], "p"))
    two = electricity(grp("g", ["a", "b"], "p"))
    assert state_hash(base(), one) == state_hash(base(), deepcopy(one))
    assert state_hash(base(), one) != state_hash(base(), two)
    assert state_hash(base(), one) != state_hash(prefs(), one)
    reordered = {"water": [], "electricity": one["electricity"]}
    assert state_hash(base(), one) == state_hash(base(), reordered)


def test_move_single_member_leaves_its_group() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    new_prefs, result = run([{"type": "move", "stat": "a", "parent": "e"}], stored)
    assert result["electricity"] == []
    moved = next(
        d for d in new_prefs["device_consumption"] if d["stat_consumption"] == "a"
    )
    assert moved["included_in_stat"] == "e"


@pytest.mark.parametrize("parent", [None, "", " "])
def test_move_to_home_with_a_blank_parent_stays_in_group(parent: str | None) -> None:
    """A blank parent means Home, like the move itself reads it."""
    stored = electricity(grp("g", ["e", "p"]))
    new_prefs, result = run([{"type": "move", "stat": "e", "parent": parent}], stored)
    assert result["electricity"][0]["members"] == ["e", "p"]
    moved = next(
        d for d in new_prefs["device_consumption"] if d["stat_consumption"] == "e"
    )
    assert "included_in_stat" not in moved


def test_move_within_the_same_parent_stays_in_group() -> None:
    stored = electricity(grp("g", ["a", "b"], "p"))
    _, result = run([{"type": "move", "stat": "a", "parent": "p"}], stored)
    assert result["electricity"][0]["members"] == ["a", "b"]


def test_move_group_refuses_a_descendant_of_its_devices() -> None:
    # B is below A; moving the group of A below B would put A below itself.
    p = prefs(dev("A"), dev("B", "A"), dev("C", "B"))
    stored = electricity(grp("g", ["A"], None))
    for parent in ("B", "C"):
        change = {"type": "move_group", "id": "g", "parent": parent}
        with pytest.raises(ChangeError) as err:
            apply_all(p, stored, [change])
        assert err.value.code == "group_loop"


def test_move_group_refuses_a_name_taken_at_the_new_parent() -> None:
    stored = electricity(grp("g", ["a"], "p"), grp("same", ["e"], None))
    stored["electricity"][1]["name"] = "g"
    change = {"type": "move_group", "id": "g", "parent": None}
    assert code_of([change], stored) == "group_name_taken"


def test_other_device_changes_pass_through() -> None:
    stored = electricity(grp("g", ["a"], "p"))
    change = {"type": "rename", "stat": "a", "name": "Lamp"}
    new_prefs, result = run([change], stored)
    assert result == stored
    assert {"stat_consumption": "a", "included_in_stat": "p", "name": "Lamp"} in (
        new_prefs["device_consumption"]
    )


def _parents(new_prefs: dict) -> dict[str, str | None]:
    return {
        d["stat_consumption"]: d.get("included_in_stat")
        for d in new_prefs["device_consumption"]
    }


def test_sum_meter_draft_sequence_for_a_group_with_a_nested_group() -> None:
    """The draft the panel sends to replace a group by a sum meter."""
    stored = electricity(grp("g", ["a", "b"], "p"), grp("h", ["c"], "p", "g"))
    new_prefs, result = run(
        [
            {"type": "add", "stat": "new", "parent": "p"},
            {"type": "move_group", "id": "h", "parent": "new"},
            {"type": "move", "stat": "a", "parent": "new"},
            {"type": "move", "stat": "b", "parent": "new"},
        ],
        stored,
    )
    parents = _parents(new_prefs)
    assert parents["new"] == "p"
    assert parents["a"] == parents["b"] == parents["c"] == "new"
    assert parents["d"] == "p"
    by_id = {g["id"]: g for g in result["electricity"]}
    assert set(by_id) == {"h"}
    assert by_id["h"]["parent"] == "new"
    assert by_id["h"]["group"] is None
    assert by_id["h"]["members"] == ["c"]


def test_sum_meter_draft_sequence_for_a_group_nested_in_another() -> None:
    """The enclosing group survives and holds the sum meter instead."""
    stored = electricity(grp("e", [], "p"), grp("g", ["a", "b"], "p", "e"))
    new_prefs, result = run(
        [
            {"type": "add", "stat": "new", "parent": "p"},
            {"type": "set_group", "stat": "new", "group": "e"},
            {"type": "move", "stat": "a", "parent": "new"},
            {"type": "move", "stat": "b", "parent": "new"},
        ],
        stored,
    )
    parents = _parents(new_prefs)
    assert parents["new"] == "p"
    assert parents["a"] == parents["b"] == "new"
    by_id = {g["id"]: g for g in result["electricity"]}
    assert set(by_id) == {"e"}
    assert by_id["e"]["members"] == ["new"]
    assert by_id["e"]["parent"] == "p"
