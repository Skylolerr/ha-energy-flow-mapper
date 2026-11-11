"""Tests for export and import documents."""

from __future__ import annotations

from typing import Any

import pytest

from custom_components.energy_flow_mapper.transfer import (
    EXPORT_FORMAT,
    EXPORT_VERSION,
    InvalidImportError,
    build_export,
    parse_import,
)

DEVICES = [{"stat_consumption": "sensor.a", "future_field": {"keep": True}}]
SOURCES = [{"type": "solar", "stat_energy_from": "sensor.pv"}]


def test_export_current_settings() -> None:
    """Sources and both device lists are exported, unknown fields included."""
    water = [{"stat_consumption": "sensor.w"}]
    document = build_export(
        {
            "energy_sources": SOURCES,
            "device_consumption": DEVICES,
            "device_consumption_water": water,
            "other_key": [],
        },
        "2026-10-24T10:00:00+00:00",
    )
    assert document == {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported": "2026-10-24T10:00:00+00:00",
        "source": "current",
        "data": {
            "energy_sources": SOURCES,
            "device_consumption": DEVICES,
            "device_consumption_water": water,
        },
    }


def test_export_backup_names_it() -> None:
    """A backup export says which backup it is and has only its lists."""
    backup = {
        "id": "b1",
        "created": "2026-10-23T10:00:00+00:00",
        "user_id": "u1",
        "user_name": "Admin",
        "summary": {"moved": 1},
        "data": {"device_consumption": DEVICES},
    }
    document = build_export(backup["data"], "now", backup)
    assert document["source"] == "backup"
    assert document["backup"] == {
        "id": "b1",
        "created": "2026-10-23T10:00:00+00:00",
        "user_name": "Admin",
        "summary": {"moved": 1},
    }
    assert document["data"] == {"device_consumption": DEVICES}


def test_round_trip() -> None:
    """An export reads back to the same lists."""
    data = {
        "energy_sources": SOURCES,
        "device_consumption": DEVICES,
        "device_consumption_water": [{"stat_consumption": "sensor.w"}],
    }
    assert parse_import(build_export(data, "now")) == (data, None)
    # A file from 0.2.0 has no water devices; it imports as it is.
    old = {"energy_sources": SOURCES, "device_consumption": DEVICES}
    assert parse_import(build_export(old, "now")) == (old, None)


@pytest.mark.parametrize(
    "document",
    [
        None,
        [],
        {},
        {"format": "other", "version": 1, "data": {"device_consumption": []}},
        {"format": EXPORT_FORMAT, "version": 3, "data": {"device_consumption": []}},
        {"format": EXPORT_FORMAT, "version": 1},
        {"format": EXPORT_FORMAT, "version": 1, "data": {}},
        {"format": EXPORT_FORMAT, "version": 1, "data": {"device_consumption": {}}},
        {"format": EXPORT_FORMAT, "version": 1, "data": {"device_consumption": [1]}},
        {
            "format": EXPORT_FORMAT,
            "version": 1,
            "data": {"device_consumption_gas": []},
        },
    ],
)
def test_invalid_documents(document: Any) -> None:
    """Anything but a supported export is refused."""
    with pytest.raises(InvalidImportError):
        parse_import(document)


def test_extra_metadata_is_ignored() -> None:
    """Fields beside the data, like a note, do not stop an import."""
    document = {
        "format": EXPORT_FORMAT,
        "version": 1,
        "note": "before the new heat pump",
        "data": {"device_consumption": DEVICES},
    }
    assert parse_import(document) == ({"device_consumption": DEVICES}, None)


GROUPS = {
    "electricity": [
        {
            "id": "g1",
            "name": "Kitchen",
            "parent": None,
            "group": None,
            "members": ["sensor.a"],
        }
    ],
    "water": [],
}


def test_export_carries_groups() -> None:
    """Groups are written beside the lists, and read back."""
    document = build_export({"device_consumption": DEVICES}, "now", None, GROUPS)
    assert EXPORT_VERSION == 2
    assert document["data"]["groups"] == GROUPS
    assert parse_import(document) == ({"device_consumption": DEVICES}, GROUPS)
    # Groups alone are a valid file; a missing kind means no groups of it.
    only = {
        "format": EXPORT_FORMAT,
        "version": 2,
        "data": {"groups": {"electricity": GROUPS["electricity"]}},
    }
    assert parse_import(only) == ({}, GROUPS)


def test_version_1_files_still_import() -> None:
    """Files of version 1 have no groups and leave them alone."""
    document = {
        "format": EXPORT_FORMAT,
        "version": 1,
        "data": {"device_consumption": DEVICES},
    }
    assert parse_import(document) == ({"device_consumption": DEVICES}, None)


@pytest.mark.parametrize(
    "groups",
    [
        [],
        {"gas": []},
        {"electricity": {}},
        {"electricity": [1]},
        {"electricity": [{"id": "g1", "name": "x"}]},
        {
            "electricity": [
                {"id": 1, "name": "x", "parent": None, "group": None, "members": []}
            ]
        },
    ],
)
def test_invalid_groups(groups: Any) -> None:
    """Malformed groups are refused, and version 1 may not carry any."""
    document = {
        "format": EXPORT_FORMAT,
        "version": 2,
        "data": {"device_consumption": DEVICES, "groups": groups},
    }
    with pytest.raises(InvalidImportError):
        parse_import(document)


def test_version_1_with_groups_is_refused() -> None:
    """Groups only exist from version 2."""
    document = {
        "format": EXPORT_FORMAT,
        "version": 1,
        "data": {"device_consumption": DEVICES, "groups": GROUPS},
    }
    with pytest.raises(InvalidImportError):
        parse_import(document)


def test_imported_groups_keep_only_their_fields() -> None:
    """Extra keys of an imported group are dropped, like when groups are loaded."""
    group = {**GROUPS["electricity"][0], "secret": "x", "extra": [1]}
    document = {
        "format": EXPORT_FORMAT,
        "version": 2,
        "data": {"groups": {"electricity": [group]}},
    }
    _, groups = parse_import(document)
    assert groups == {"electricity": GROUPS["electricity"], "water": []}
    assert list(groups["electricity"][0]) == ["id", "name", "parent", "group", "members"]


def test_duplicate_group_ids_are_refused() -> None:
    """Two groups of one kind with the same id are not a valid import."""
    twin = {**GROUPS["electricity"][0], "name": "Twin"}
    document = {
        "format": EXPORT_FORMAT,
        "version": 2,
        "data": {"groups": {"electricity": [GROUPS["electricity"][0], twin]}},
    }
    with pytest.raises(InvalidImportError):
        parse_import(document)
    # The same id in two different kinds is fine.
    document["data"]["groups"] = {
        "electricity": [GROUPS["electricity"][0]],
        "water": [GROUPS["electricity"][0]],
    }
    parse_import(document)
