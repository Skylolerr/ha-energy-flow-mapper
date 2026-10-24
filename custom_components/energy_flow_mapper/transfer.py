"""Export and import of energy settings as files.

An export holds the energy sources and devices, either as they are now or as
a backup kept them. Importing one goes through the same checks, confirmation
and backup as any other save. No Home Assistant imports, so it can be tested
in isolation.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import probatio as vol

from .hierarchy import KEY_DEVICES, KEY_SOURCES

EXPORT_FORMAT = "energy_flow_mapper"
EXPORT_VERSION = 1

# Keys an export may contain; water devices follow in phase 4.
TRANSFER_KEYS = (KEY_SOURCES, KEY_DEVICES)

_DOCUMENT_SCHEMA = vol.Schema(
    {
        vol.Required("format"): EXPORT_FORMAT,
        vol.Required("version"): vol.In([EXPORT_VERSION]),
        # Only the known lists; anything else (like water devices) is refused.
        vol.Required("data"): vol.All(
            vol.Schema(
                {vol.Optional(key): [dict] for key in TRANSFER_KEYS},
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
) -> dict[str, Any]:
    """Return an export document for the given lists.

    `backup` is the backup entry (without content) the lists come from, or
    None for the current settings.
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
    return document


def parse_import(document: Any) -> dict[str, list[Any]]:
    """Return the lists of an export document.

    Raises InvalidImportError when it is not a supported export.
    """
    try:
        valid = _DOCUMENT_SCHEMA(document)
    except vol.Invalid as err:
        raise InvalidImportError(str(err)) from err
    return dict(valid["data"])
