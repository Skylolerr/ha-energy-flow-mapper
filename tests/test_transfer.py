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
    """Only sources and devices are exported, unknown fields included."""
    document = build_export(
        {
            "energy_sources": SOURCES,
            "device_consumption": DEVICES,
            "device_consumption_water": [{"stat_consumption": "sensor.w"}],
        },
        "2026-10-24T10:00:00+00:00",
    )
    assert document == {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported": "2026-10-24T10:00:00+00:00",
        "source": "current",
        "data": {"energy_sources": SOURCES, "device_consumption": DEVICES},
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
    data = {"energy_sources": SOURCES, "device_consumption": DEVICES}
    assert parse_import(build_export(data, "now")) == data


@pytest.mark.parametrize(
    "document",
    [
        None,
        [],
        {},
        {"format": "other", "version": 1, "data": {"device_consumption": []}},
        {"format": EXPORT_FORMAT, "version": 2, "data": {"device_consumption": []}},
        {"format": EXPORT_FORMAT, "version": 1},
        {"format": EXPORT_FORMAT, "version": 1, "data": {}},
        {"format": EXPORT_FORMAT, "version": 1, "data": {"device_consumption": {}}},
        {"format": EXPORT_FORMAT, "version": 1, "data": {"device_consumption": [1]}},
        {
            "format": EXPORT_FORMAT,
            "version": 1,
            "data": {"device_consumption_water": []},
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
    assert parse_import(document) == {"device_consumption": DEVICES}
