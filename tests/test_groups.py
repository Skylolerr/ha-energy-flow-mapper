"""Tests for the pure group functions."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from custom_components.energy_flow_mapper.groups import (
    Group,
    Groups,
    all_devices,
    clean_groups,
    empty_groups,
    groups_of,
)
from custom_components.energy_flow_mapper.hierarchy import DeviceKind


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
