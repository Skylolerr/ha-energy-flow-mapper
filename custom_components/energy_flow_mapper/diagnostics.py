"""Diagnostics support for Energy Flow Mapper.

Only counts are reported, no entity IDs or names.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from homeassistant.core import HomeAssistant

from . import energy_access
from .groups import GROUP_KINDS, Group
from .hierarchy import (
    KEY_DEVICES,
    KEY_DEVICES_WATER,
    KEY_SOURCES,
    build_tree,
    tree_depth,
    validate,
)
from .models import EnergyFlowMapperConfigEntry


def _group_depth(groups: list[Group]) -> int:
    """Return the nesting depth: 0 = no group, 1 = top level only."""
    by_id = {group["id"]: group for group in groups}
    depth = 0
    for group in groups:
        level, seen = 1, {group["id"]}
        enclosing = group["group"]
        while enclosing in by_id and enclosing not in seen:
            seen.add(enclosing)
            level += 1
            enclosing = by_id[enclosing]["group"]
        depth = max(depth, level)
    return depth


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: EnergyFlowMapperConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for the integration."""
    runtime = entry.runtime_data
    groups = runtime.groups.groups()
    result: dict[str, Any] = {
        "supported": runtime.supported,
        "backups": len(runtime.backups.entries()),
        "backup_limit": runtime.backups.limit,
        "created_helpers": len(runtime.helpers.entries()),
        "ignored_suggestions": len(runtime.suggestions.ignored()),
        "groups": {
            kind.value: {
                "count": len(groups[kind.value]),
                "max_depth": _group_depth(groups[kind.value]),
            }
            for kind in GROUP_KINDS
        },
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
