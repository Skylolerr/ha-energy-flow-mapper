"""Export and import of energy settings as files.

An export holds the energy sources and both device lists (electricity and
water), either as they are now or as a backup kept them. Importing one goes
through the same checks, confirmation and backup as any other save. No Home
Assistant imports, so it can be tested in isolation.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import probatio as vol

from .groups import GROUP_KINDS, Groups, empty_groups, is_group
from .hierarchy import KEY_DEVICES, KEY_DEVICES_WATER, KEY_SOURCES

EXPORT_FORMAT = "energy_flow_mapper"
# Version 2 adds the groups (`data.groups`); version 1 files still import.
EXPORT_VERSION = 2
KEY_GROUPS = "groups"

# Keys an export may contain. Files from 0.2.0 have no water devices; they
# import as they are and leave the water devices alone.
TRANSFER_KEYS = (KEY_SOURCES, KEY_DEVICES, KEY_DEVICES_WATER)

_DOCUMENT_SCHEMA = vol.Schema(
    {
        vol.Required("format"): EXPORT_FORMAT,
        vol.Required("version"): vol.In([1, EXPORT_VERSION]),
        # Only the known lists; anything else is refused.
        vol.Required("data"): vol.All(
            vol.Schema(
                {
                    **{vol.Optional(key): [dict] for key in TRANSFER_KEYS},
                    vol.Optional(KEY_GROUPS): vol.Schema(
                        {vol.Optional(kind.value): [dict] for kind in GROUP_KINDS},
                        extra=vol.PREVENT_EXTRA,
                    ),
                },
                extra=vol.PREVENT_EXTRA,
            ),
            vol.Length(min=1),
        ),
    },
    extra=vol.ALLOW_EXTRA,
)


class InvalidImportError(Exception):
    """The file is not an Energy Flow Mapper export."""


def build_export(
    data: Mapping[str, Any],
    exported: str,
    backup: Mapping[str, Any] | None = None,
    groups: Groups | None = None,
) -> dict[str, Any]:
    """Return an export document for the given lists.

    `backup` is the backup entry (without content) the lists come from, or
    None for the current settings. `groups` are written too when given.
    """
    document: dict[str, Any] = {
        "format": EXPORT_FORMAT,
        "version": EXPORT_VERSION,
        "exported": exported,
        "source": "current" if backup is None else "backup",
    }
    if backup is not None:
        document["backup"] = {
            key: backup.get(key) for key in ("id", "created", "user_name", "summary")
        }
    document["data"] = {key: data[key] for key in TRANSFER_KEYS if key in data}
    if groups is not None:
        document["data"][KEY_GROUPS] = groups
    return document


def parse_import(document: Any) -> tuple[dict[str, list[Any]], Groups | None]:
    """Return the lists and the groups of an export document.

    The groups are None for a file without any (version 1); a kind missing from
    a file with groups has none. Raises InvalidImportError when it is not a
    supported export.
    """
    try:
        valid = _DOCUMENT_SCHEMA(document)
    except vol.Invalid as err:
        raise InvalidImportError(str(err)) from err
    data = dict(valid["data"])
    raw = data.pop(KEY_GROUPS, None)
    if raw is None:
        return data, None
    if valid["version"] < 2:
        raise InvalidImportError("groups need an export of version 2")
    groups = empty_groups()
    for kind, entries in raw.items():
        if not all(is_group(entry) for entry in entries):
            raise InvalidImportError(f"invalid {kind} groups")
        groups[kind] = entries
    return data, groups
