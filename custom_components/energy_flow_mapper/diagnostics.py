"""Diagnostics support for Energy Flow Mapper.

Only counts are reported, no entity IDs or names.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from homeassistant.core import HomeAssistant

from . import energy_access
from .hierarchy import (
    KEY_DEVICES,
    KEY_DEVICES_WATER,
    KEY_SOURCES,
    build_tree,
    tree_depth,
    validate,
)
from .models import EnergyFlowMapperConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: EnergyFlowMapperConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for the integration."""
    runtime = entry.runtime_data
    result: dict[str, Any] = {
        "supported": runtime.supported,
        "backups": len(runtime.backups.entries()),
        "backup_limit": runtime.backups.limit,
        "created_helpers": len(runtime.helpers.entries()),
    }
    if not runtime.supported:
        return result
    prefs = await energy_access.async_get_prefs(hass)
    devices = prefs[KEY_DEVICES]
    return result | {
        "sources": dict(Counter(source["type"] for source in prefs[KEY_SOURCES])),
        "devices": len(devices),
        "water_devices": len(prefs[KEY_DEVICES_WATER]),
        "tree_depth": tree_depth(build_tree(devices)),
        "water_tree_depth": tree_depth(build_tree(prefs[KEY_DEVICES_WATER])),
        "issues": dict(Counter(issue.code.value for issue in validate(prefs))),
    }
