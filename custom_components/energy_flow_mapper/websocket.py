"""WebSocket commands used by the panel; all of them require an admin."""

from __future__ import annotations

from typing import Any

import probatio as vol
from homeassistant.components.websocket_api import async_register_command
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import (
    async_response,
    require_admin,
    websocket_command,
)
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from . import energy_access
from .candidates import (
    ENERGY_UNITS,
    async_candidates,
    async_external_candidates,
    async_external_statistics,
    async_mark_created,
    async_power_candidates,
    async_stat_units,
    async_stats_info,
)
from .const import DOMAIN
from .energy_stats import PERIODS, async_energy, period_range
from .hierarchy import (
    KEY_DEVICES,
    KEY_SOURCES,
    STAT,
    AssignRole,
    ChangeError,
    ChangeType,
    Prefs,
    Severity,
    apply_changes,
    build_tree,
    diff,
    has_errors,
    plausibility,
    prefs_hash,
    source_energy_stats,
    summarize,
    untracked,
    validate,
)
from .integral import async_create_integral
from .models import EnergyFlowMapperData

ATTR_BASE_HASH = "base_hash"
ATTR_CHANGES = "changes"
ATTR_BACKUP_ID = "backup_id"
ATTR_POWER_ENTITY_ID = "power_entity_id"
ATTR_NAME = "name"
ATTR_PERIOD = "period"

# Keys the panel may change; water devices follow in phase 4.
EDITABLE_KEYS = (KEY_SOURCES, KEY_DEVICES)

_OPTIONAL_TEXT = vol.Any(str, None)
CHANGE_SCHEMA = cv.key_value_schemas(
    "type",
    {
        ChangeType.ADD.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.ADD.value,
                vol.Required("stat"): str,
                vol.Optional("parent"): _OPTIONAL_TEXT,
                vol.Optional("name"): _OPTIONAL_TEXT,
                vol.Optional("stat_rate"): _OPTIONAL_TEXT,
            }
        ),
        ChangeType.MOVE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.MOVE.value,
                vol.Required("stat"): str,
                vol.Required("parent"): _OPTIONAL_TEXT,
            }
        ),
        ChangeType.RENAME.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.RENAME.value,
                vol.Required("stat"): str,
                vol.Required("name"): _OPTIONAL_TEXT,
            }
        ),
        ChangeType.REMOVE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.REMOVE.value,
                vol.Required("stat"): str,
            }
        ),
        ChangeType.ASSIGN_SOURCE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.ASSIGN_SOURCE.value,
                vol.Required("role"): vol.In([role.value for role in AssignRole]),
                vol.Required("stat"): str,
                vol.Optional("stat_to"): str,
                vol.Optional("replace"): _OPTIONAL_TEXT,
            }
        ),
        ChangeType.UNASSIGN_SOURCE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.UNASSIGN_SOURCE.value,
                vol.Required("stat"): str,
            }
        ),
    },
)


@callback
def async_setup_websocket(hass: HomeAssistant) -> None:
    """Register the WebSocket commands."""
    async_register_command(hass, websocket_get)
    async_register_command(hass, websocket_validate)
    async_register_command(hass, websocket_save)
    async_register_command(hass, websocket_backups)
    async_register_command(hass, websocket_restore)
    async_register_command(hass, websocket_create_integral)
    async_register_command(hass, websocket_energy)


def _error(key: str, **placeholders: str) -> HomeAssistantError:
    return HomeAssistantError(
        translation_domain=DOMAIN,
        translation_key=key,
        translation_placeholders=placeholders or None,
    )


def _runtime(hass: HomeAssistant) -> EnergyFlowMapperData:
    """Return the runtime data, or raise if the integration cannot work."""
    entries = hass.config_entries.async_loaded_entries(DOMAIN)
    if not entries:
        raise _error("not_loaded")
    runtime: EnergyFlowMapperData = entries[0].runtime_data
    if not runtime.supported:
        raise energy_access.unsupported_error()
    return runtime


def _issues(hass: HomeAssistant, prefs: Prefs) -> list[Any]:
    return validate(prefs, async_stat_units(hass, prefs), ENERGY_UNITS)


async def _async_current(hass: HomeAssistant, base_hash: str) -> dict[str, Any]:
    """Return the current preferences, or raise if they changed meanwhile."""
    prefs = await energy_access.async_get_prefs(hass)
    if prefs_hash(prefs) != base_hash:
        raise _error("conflict")
    return prefs


def _apply(prefs: Prefs, changes: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        return apply_changes(prefs, changes)
    except ChangeError as err:
        raise _error(err.code, stat=err.stat) from err


def _changed_keys(old: Prefs, new: Prefs) -> list[str]:
    return [key for key in EDITABLE_KEYS if old.get(key) != new.get(key)]


@websocket_command({vol.Required("type"): f"{DOMAIN}/get"})
@require_admin
@async_response
async def websocket_get(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the preferences with metadata, issues and unused sensors.

    `candidates` are unused energy meters and external statistics,
    `power_candidates` power sensors without an energy meter.
    """
    runtime = _runtime(hass)
    prefs = await energy_access.async_get_prefs(hass)
    external = await async_external_statistics(hass)
    stats = async_stats_info(hass, prefs, external)
    candidates = async_candidates(hass, prefs) + async_external_candidates(
        hass, prefs, external
    )
    created = runtime.helpers.entries()
    async_mark_created(hass, [*stats.values(), *candidates], created)
    connection.send_result(
        msg["id"],
        {
            "prefs": prefs,
            "hash": prefs_hash(prefs),
            "stats": stats,
            "candidates": candidates,
            "power_candidates": async_power_candidates(hass, prefs),
            "issues": [issue.as_dict() for issue in _issues(hass, prefs)],
        },
    )


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/validate",
        vol.Required(ATTR_BASE_HASH): str,
        vol.Required(ATTR_CHANGES): [CHANGE_SCHEMA],
    }
)
@require_admin
@async_response
async def websocket_validate(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Check a draft without saving it.

    Besides the hierarchy checks, the changed lists go through Home
    Assistant's own schemas; `rejected` holds its (English) message.
    """
    _runtime(hass)
    prefs = await _async_current(hass, msg[ATTR_BASE_HASH])
    new = _apply(prefs, msg[ATTR_CHANGES])
    issues = _issues(hass, new)
    rejected = energy_access.schema_error(
        {key: new[key] for key in _changed_keys(prefs, new)}
    )
    connection.send_result(
        msg["id"],
        {
            "valid": not has_errors(issues) and rejected is None,
            "issues": [issue.as_dict() for issue in issues],
            "rejected": rejected,
            "diff": diff(prefs, new),
        },
    )


async def _async_write_with_backup(
    connection: ActiveConnection,
    runtime: EnergyFlowMapperData,
    old: Prefs,
    update: dict[str, list[Any]],
    summary: dict[str, int],
) -> dict[str, Any]:
    """Back up the old content of the updated keys, then write.

    The lists are checked before the backup is stored. Storing the backup
    waits for the disk, so the preferences are compared with `old` again right
    before the write; a change made elsewhere meanwhile is a conflict. Once
    the write has started, the backup is kept even if it fails, because Home
    Assistant may already use the new settings.
    """
    energy_access.validate(update)
    backup_id = await runtime.backups.async_add(
        {key: old[key] for key in update},
        connection.user.id,
        connection.user.name,
        summary,
    )
    try:
        await energy_access.async_write(
            connection.hass, update, expected_hash=prefs_hash(old)
        )
    except energy_access.PrefsChangedError as err:
        await runtime.backups.async_discard(backup_id)
        raise _error("conflict") from err
    prefs = await energy_access.async_get_prefs(connection.hass)
    return {"hash": prefs_hash(prefs), ATTR_BACKUP_ID: backup_id}


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save",
        vol.Required(ATTR_BASE_HASH): str,
        vol.Required(ATTR_CHANGES): [CHANGE_SCHEMA],
    }
)
@require_admin
@async_response
async def websocket_save(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Validate, back up and write a draft in one step."""
    runtime = _runtime(hass)
    async with runtime.lock:
        prefs = await _async_current(hass, msg[ATTR_BASE_HASH])
        new = _apply(prefs, msg[ATTR_CHANGES])
        issues = _issues(hass, new)
        if has_errors(issues):
            raise _error(
                "invalid_changes",
                issues=", ".join(
                    f"{issue.code.value} ({issue.stat})"
                    for issue in issues
                    if issue.severity is Severity.ERROR
                ),
            )
        keys = _changed_keys(prefs, new)
        if not keys:
            connection.send_result(
                msg["id"], {"hash": msg[ATTR_BASE_HASH], ATTR_BACKUP_ID: None}
            )
            return
        result = await _async_write_with_backup(
            connection,
            runtime,
            prefs,
            {key: new[key] for key in keys},
            summarize(diff(prefs, new)),
        )
    connection.send_result(msg["id"], result)


@websocket_command({vol.Required("type"): f"{DOMAIN}/backups"})
@require_admin
@callback
def websocket_backups(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """List the backups, newest first."""
    runtime = _runtime(hass)
    connection.send_result(msg["id"], {"backups": runtime.backups.entries()})


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/restore",
        vol.Required(ATTR_BACKUP_ID): str,
        vol.Required(ATTR_BASE_HASH): str,
    }
)
@require_admin
@async_response
async def websocket_restore(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Restore a backup; the current content is backed up first."""
    runtime = _runtime(hass)
    async with runtime.lock:
        backup = runtime.backups.get(msg[ATTR_BACKUP_ID])
        if backup is None:
            raise _error("backup_not_found", backup_id=msg[ATTR_BACKUP_ID])
        prefs = await _async_current(hass, msg[ATTR_BASE_HASH])
        update = {
            key: value
            for key, value in backup["data"].items()
            if prefs.get(key) != value
        }
        if not update:
            connection.send_result(
                msg["id"], {"hash": msg[ATTR_BASE_HASH], ATTR_BACKUP_ID: None}
            )
            return
        result = await _async_write_with_backup(
            connection, runtime, prefs, update, {"restored": 1}
        )
    connection.send_result(msg["id"], result)


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/create_integral",
        vol.Required(ATTR_POWER_ENTITY_ID): str,
        vol.Required(ATTR_NAME): str,
    }
)
@require_admin
@async_response
async def websocket_create_integral(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Create an integral helper for a power sensor without energy meter.

    The helper is created at once, not on save; the panel then adds its
    energy sensor to the draft.
    """
    runtime = _runtime(hass)
    power = msg[ATTR_POWER_ENTITY_ID]
    prefs = await energy_access.async_get_prefs(hass)
    if power not in {c["stat"] for c in async_power_candidates(hass, prefs)}:
        raise _error("not_a_power_candidate", entity_id=power)
    entry_id, entity_id = await async_create_integral(
        hass, power, msg[ATTR_NAME].strip() or power
    )
    await runtime.helpers.async_add(entry_id)
    connection.send_result(msg["id"], {"entity_id": entity_id, "stat_rate": power})


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/energy",
        vol.Required(ATTR_PERIOD): vol.In(list(PERIODS)),
        vol.Inclusive(ATTR_BASE_HASH, "draft"): str,
        vol.Inclusive(ATTR_CHANGES, "draft"): [CHANGE_SCHEMA],
    }
)
@require_admin
@async_response
async def websocket_energy(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the energy of devices and sources in a period.

    With a draft (`base_hash` and `changes`), untracked energy and warnings
    follow the draft's tree. Warnings flag devices whose children used clearly
    more energy than they did.
    """
    _runtime(hass)
    if ATTR_CHANGES in msg:
        prefs = _apply(
            await _async_current(hass, msg[ATTR_BASE_HASH]), msg[ATTR_CHANGES]
        )
    else:
        prefs = await energy_access.async_get_prefs(hass)
    devices = prefs.get(KEY_DEVICES, [])
    stats = [device[STAT] for device in devices]
    stats += sorted(source_energy_stats(prefs.get(KEY_SOURCES, [])) - set(stats))
    now = dt_util.now()
    energy = await async_energy(hass, stats, msg[ATTR_PERIOD], now)
    roots = build_tree(devices)
    start, end = period_range(msg[ATTR_PERIOD], now)
    connection.send_result(
        msg["id"],
        {
            "period": msg[ATTR_PERIOD],
            "start": start.isoformat(),
            "end": end.isoformat(),
            "energy": energy,
            "untracked": untracked(roots, energy),
            "issues": [issue.as_dict() for issue in plausibility(roots, energy)],
        },
    )
