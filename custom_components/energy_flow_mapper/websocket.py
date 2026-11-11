"""WebSocket commands of the panel and the dashboard card.

All of them require an admin, except `card`: it only reads what the energy
dashboard shows every user anyway (see SPEC.md §2).
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from datetime import datetime
from time import monotonic
from typing import Any

import probatio as vol
from homeassistant.components.websocket_api import async_register_command
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import (
    async_response,
    require_admin,
    websocket_command,
)
from homeassistant.core import HomeAssistant, callback, valid_entity_id
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_conversion import VolumeConverter

from . import energy_access
from .candidates import (
    UNITS,
    async_candidates,
    async_child_pairs,
    async_external_candidates,
    async_external_statistics,
    async_mark_created,
    async_power_candidates,
    async_stat_info,
    async_stat_units,
    async_stats_info,
)
from .const import DOMAIN, PLAUSIBILITY_MIN_KWH, PLAUSIBILITY_MIN_LITERS
from .energy_stats import (
    PERIODS,
    async_energy,
    async_last_ends,
    gas_unit,
    period_range,
    stale_stat,
    water_unit,
)
from .groups import (
    Groups,
    apply_all,
    clean_groups,
    diff_groups,
    groups_of,
    state_hash,
)
from .hierarchy import (
    DEVICE_KEYS,
    HOME,
    KEY_DEVICES,
    KEY_DEVICES_WATER,
    KEY_SOURCES,
    NAME,
    PARENT,
    RATE,
    SOURCE_ROLES,
    STAT,
    AssignRole,
    ChangeError,
    ChangeType,
    DeviceKind,
    Prefs,
    Severity,
    build_tree,
    card_ha_issues,
    diff,
    ha_issues,
    has_errors,
    home_consumption,
    home_plausibility,
    home_stats,
    home_untracked,
    plausibility,
    prefs_hash,
    source_energy_stats,
    source_kind,
    summarize,
    untracked,
    validate,
)
from .integral import async_create_integral
from .models import EnergyFlowMapperData
from .sum_meter import async_create_sum, check_sum_members
from .transfer import InvalidImportError, build_export, parse_import

ATTR_BASE_HASH = "base_hash"
ATTR_CHANGES = "changes"
ATTR_BACKUP_ID = "backup_id"
ATTR_POWER_ENTITY_ID = "power_entity_id"
ATTR_NAME = "name"
ATTR_PERIOD = "period"
ATTR_DOCUMENT = "document"
ATTR_KIND = "kind"

# Keys the panel may change.
EDITABLE_KEYS = (KEY_SOURCES, KEY_DEVICES, KEY_DEVICES_WATER)

_OPTIONAL_TEXT = vol.Any(str, None)
# Device changes name their list; without `kind` they change electricity.
_KIND = vol.Optional("kind")
# Only the kinds with devices; gas has sources only.
_KINDS = vol.In([kind.value for kind in DEVICE_KEYS])
# Every card asks every minute; HA's check of the energy dashboard runs at most
# once a minute for all of them.
CARD_VALIDATION_SECONDS = 60
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
                _KIND: _KINDS,
            }
        ),
        ChangeType.MOVE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.MOVE.value,
                vol.Required("stat"): str,
                vol.Required("parent"): _OPTIONAL_TEXT,
                _KIND: _KINDS,
            }
        ),
        ChangeType.RENAME.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.RENAME.value,
                vol.Required("stat"): str,
                vol.Required("name"): _OPTIONAL_TEXT,
                _KIND: _KINDS,
            }
        ),
        ChangeType.REMOVE.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.REMOVE.value,
                vol.Required("stat"): str,
                _KIND: _KINDS,
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
        ChangeType.USE_AS_HOME_METER.value: vol.Schema(
            {
                vol.Required("type"): ChangeType.USE_AS_HOME_METER.value,
                vol.Required("stat"): str,
            }
        ),
        "create_group": vol.Schema(
            {
                vol.Required("type"): "create_group",
                vol.Required("id"): str,
                vol.Required("name"): str,
                vol.Required("parent"): _OPTIONAL_TEXT,
                vol.Optional("group"): _OPTIONAL_TEXT,
                vol.Required("members"): [str],
                vol.Required("groups"): [str],
                _KIND: _KINDS,
            }
        ),
        "rename_group": vol.Schema(
            {
                vol.Required("type"): "rename_group",
                vol.Required("id"): str,
                vol.Required("name"): str,
                _KIND: _KINDS,
            }
        ),
        # Exactly one of `stat` and `group_id`; `apply_all` checks that.
        "set_group": vol.Schema(
            {
                vol.Required("type"): "set_group",
                vol.Optional("stat"): str,
                vol.Optional("group_id"): str,
                vol.Required("group"): _OPTIONAL_TEXT,
                _KIND: _KINDS,
            }
        ),
        "dissolve_group": vol.Schema(
            {
                vol.Required("type"): "dissolve_group",
                vol.Required("id"): str,
                _KIND: _KINDS,
            }
        ),
        "move_group": vol.Schema(
            {
                vol.Required("type"): "move_group",
                vol.Required("id"): str,
                vol.Required("parent"): _OPTIONAL_TEXT,
                vol.Optional("group"): _OPTIONAL_TEXT,
                _KIND: _KINDS,
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
    async_register_command(hass, websocket_create_sum_meter)
    async_register_command(hass, websocket_energy)
    async_register_command(hass, websocket_export)
    async_register_command(hass, websocket_import_check)
    async_register_command(hass, websocket_import)
    async_register_command(hass, websocket_card)
    async_register_command(hass, websocket_ignore_suggestion)
    async_register_command(hass, websocket_clear_suggestions)


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
    return validate(prefs, async_stat_units(hass, prefs), UNITS)


async def _async_current(
    hass: HomeAssistant, runtime: EnergyFlowMapperData, base_hash: str
) -> tuple[dict[str, Any], Groups]:
    """Return the current preferences and cleaned groups, or raise on a change.

    The hash covers both: a draft is stale when either changed meanwhile.
    """
    prefs = await energy_access.async_get_prefs(hass)
    groups = clean_groups(runtime.groups.groups(), prefs)
    if state_hash(prefs, groups) != base_hash:
        raise _error("conflict")
    return prefs, groups


def _refuse_home_without_support(update: Mapping[str, Any]) -> None:
    """Refuse a home meter in restored or imported sources before HA 2026.11."""
    if not energy_access.home_supported() and any(
        source.get("type") == "home" for source in update.get(KEY_SOURCES, [])
    ):
        raise _error("home_not_supported")


def _apply(
    prefs: Prefs, groups: Groups, changes: list[dict[str, Any]]
) -> tuple[dict[str, Any], Groups]:
    """Apply a draft; the home meter only where Home Assistant knows it."""
    if not energy_access.home_supported() and any(
        change["type"] == ChangeType.USE_AS_HOME_METER
        or change.get("role") == AssignRole.HOME
        for change in changes
    ):
        raise _error("home_not_supported")
    try:
        return apply_all(prefs, groups, changes)
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
    `water_candidates` and `gas_candidates` the same for water and gas,
    `power_candidates` power sensors
    without an energy meter and `flow_candidates` flow sensors without a water
    meter.
    """
    runtime = _runtime(hass)
    prefs = await energy_access.async_get_prefs(hass)
    groups = clean_groups(runtime.groups.groups(), prefs)
    external = await async_external_statistics(hass)
    stats = async_stats_info(hass, prefs, external)
    candidates, water, gas = (
        async_candidates(hass, prefs, kind)
        + async_external_candidates(hass, prefs, external, kind)
        for kind in (DeviceKind.ELECTRICITY, DeviceKind.WATER, DeviceKind.GAS)
    )
    created = runtime.helpers.entries()
    async_mark_created(hass, [*stats.values(), *candidates, *water, *gas], created)
    issues = _issues(hass, prefs)
    validation = await energy_access.async_validation(hass)
    connection.send_result(
        msg["id"],
        {
            "prefs": prefs,
            "groups": groups,
            "hash": state_hash(prefs, groups),
            "stats": stats,
            "candidates": candidates,
            "water_candidates": water,
            "gas_candidates": gas,
            "power_candidates": async_power_candidates(hass, prefs),
            "flow_candidates": async_power_candidates(hass, prefs, DeviceKind.WATER),
            "issues": [issue.as_dict() for issue in issues],
            "home_supported": energy_access.home_supported(),
            "ha_issues": ha_issues(prefs, validation or {}, issues),
            "child_pairs": async_child_pairs(
                hass,
                prefs,
                {
                    DeviceKind.ELECTRICITY: [c["stat"] for c in candidates],
                    DeviceKind.WATER: [c["stat"] for c in water],
                },
            ),
            "ignored_suggestions": runtime.suggestions.ignored(),
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
    runtime = _runtime(hass)
    prefs, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
    new, new_groups = _apply(prefs, groups, msg[ATTR_CHANGES])
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
            "diff": [*diff(prefs, new), *diff_groups(groups, new_groups)],
        },
    )


async def _async_write_with_backup(
    connection: ActiveConnection,
    runtime: EnergyFlowMapperData,
    before: tuple[Prefs, Groups],
    after: tuple[dict[str, list[Any]], Groups | None],
    summary: dict[str, int],
) -> dict[str, Any]:
    """Back up the old content of what changes, then write it.

    `before` are the current preferences and groups, `after` the changed lists
    of the energy settings and the groups to store (equal to the old ones when
    they stay as they are). The
    lists are checked before the backup is stored. Storing the backup waits for
    the disk, so the preferences are compared with `old` again right before the
    write; a change made elsewhere meanwhile is a conflict. Once the write has
    started, the backup is kept even if it fails, because Home Assistant may
    already use the new settings. The groups are stored last, so a write that
    Home Assistant refuses leaves them as they were. The result's hash covers
    the preferences and the stored groups as they are afterwards. `after`'s groups
    are None when the stored groups stay as they are.
    """
    old, _ = before
    update, new_groups = after
    energy_access.validate(update)
    groups_changed = new_groups is not None
    backup_id = await runtime.backups.async_add(
        {key: old[key] for key in update},
        connection.user.id,
        connection.user.name,
        summary,
        runtime.groups.groups() if groups_changed else None,
    )
    if update:
        try:
            await energy_access.async_write(
                connection.hass, update, expected_hash=prefs_hash(old)
            )
        except energy_access.PrefsChangedError as err:
            await runtime.backups.async_discard(backup_id)
            raise _error("conflict") from err
    if new_groups is not None:
        await runtime.groups.async_save(new_groups)
    prefs = await energy_access.async_get_prefs(connection.hass)
    return {
        "hash": state_hash(prefs, clean_groups(runtime.groups.groups(), prefs)),
        ATTR_BACKUP_ID: backup_id,
    }


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
        prefs, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
        new, new_groups = _apply(prefs, groups, msg[ATTR_CHANGES])
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
        if not keys and new_groups == groups:
            connection.send_result(
                msg["id"], {"hash": msg[ATTR_BASE_HASH], ATTR_BACKUP_ID: None}
            )
            return
        result = await _async_write_with_backup(
            connection,
            runtime,
            (prefs, groups),
            (
                {key: new[key] for key in keys},
                new_groups if new_groups != groups else None,
            ),
            summarize([*diff(prefs, new), *diff_groups(groups, new_groups)]),
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
        prefs, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
        update = {
            key: value
            for key, value in backup["data"].items()
            if prefs.get(key) != value
        }
        _refuse_home_without_support(update)
        # Groups are restored as stored; a backup from before groups existed
        # (or one that did not touch them) leaves the groups alone.
        restored = backup.get("groups")
        new_groups = groups
        groups_changed = restored is not None and restored != runtime.groups.groups()
        if restored is not None and groups_changed:
            new_groups = restored
        if not update and (
            not groups_changed or clean_groups(new_groups, prefs) == groups
        ):
            connection.send_result(
                msg["id"], {"hash": msg[ATTR_BASE_HASH], ATTR_BACKUP_ID: None}
            )
            return
        result = await _async_write_with_backup(
            connection,
            runtime,
            (prefs, groups),
            (update, new_groups if groups_changed else None),
            {"restored": 1},
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
    """Create an integral helper for a power or flow sensor without meter.

    The helper is created at once, not on save; the panel then adds its meter
    to the draft, in the list `kind` names.
    """
    runtime = _runtime(hass)
    power = msg[ATTR_POWER_ENTITY_ID]
    prefs = await energy_access.async_get_prefs(hass)
    kind = next(
        (
            kind
            for kind in DEVICE_KEYS
            if power in {c["stat"] for c in async_power_candidates(hass, prefs, kind)}
        ),
        None,
    )
    if kind is None:
        raise _error("not_a_power_candidate", entity_id=power)
    entry_id, entity_id = await async_create_integral(
        hass, power, msg[ATTR_NAME].strip() or power, kind
    )
    await runtime.helpers.async_add(entry_id)
    connection.send_result(
        msg["id"], {"entity_id": entity_id, "stat_rate": power, "kind": kind}
    )


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/create_sum_meter",
        vol.Required(ATTR_KIND): _KINDS,
        vol.Required(ATTR_NAME): str,
        vol.Required("entity_ids"): vol.All([str], vol.Length(min=1)),
        vol.Optional("rate_entity_ids"): [str],
        vol.Optional("rate_name"): str,
    }
)
@require_admin
@async_response
async def websocket_create_sum_meter(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Create a sum helper of meters, and one of their rate sensors if given.

    The helpers are created at once, not on save; the panel then adds the
    meter to the draft. `name` is passed ready (translated) by the panel; the
    rate sum is named `rate_name`, or `name` plus " power" / " flow".
    """
    runtime = _runtime(hass)
    kind = DeviceKind(msg[ATTR_KIND])
    name = msg[ATTR_NAME].strip()
    check_sum_members(hass, msg["entity_ids"], kind)
    entry_id, entity_id = await async_create_sum(hass, name, msg["entity_ids"])
    await runtime.helpers.async_add(entry_id)
    stat_rate = None
    if msg.get("rate_entity_ids"):
        suffix = " power" if kind is DeviceKind.ELECTRICITY else " flow"
        rate_entry_id, stat_rate = await async_create_sum(
            hass, msg.get("rate_name", name + suffix), msg["rate_entity_ids"]
        )
        await runtime.helpers.async_add(rate_entry_id)
    connection.send_result(msg["id"], {"entity_id": entity_id, "stat_rate": stat_rate})


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

    Electricity is in kWh, water in `water_unit` (litres or gallons), gas in
    kWh or `gas_unit` (m³ or ft³). With a draft (`base_hash` and `changes`),
    untracked values and warnings follow the draft's trees. Warnings flag
    devices whose children used clearly more than they did.
    """
    runtime = _runtime(hass)
    if ATTR_CHANGES in msg:
        current, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
        prefs, _ = _apply(current, groups, msg[ATTR_CHANGES])
    else:
        prefs = await energy_access.async_get_prefs(hass)
    lists = {kind: prefs.get(key, []) for kind, key in DEVICE_KEYS.items()}
    sources = source_energy_stats(prefs.get(KEY_SOURCES, []))
    connection.send_result(
        msg["id"],
        await _async_period(
            hass, lists, sources, msg[ATTR_PERIOD], prefs.get(KEY_SOURCES, [])
        ),
    )


async def _async_period(
    hass: HomeAssistant,
    lists: dict[DeviceKind, list[Any]],
    sources: set[str],
    period: str,
    home_sources: list[Any] | None = None,
) -> dict[str, Any]:
    """Return energy, untracked values and warnings of device lists in a period.

    Electricity is in kWh, water in `water_unit`; the energy of `sources` is
    included too. With `home_sources` (the sources of the electricity list,
    or all of them), `home` holds the home consumption and what no top-level
    device covers; gas meters among them come in `gas_unit` if they measure
    a volume.
    """
    gas = source_energy_stats(
        [s for s in home_sources or [] if source_kind(s) is DeviceKind.GAS]
    )
    stats = list(dict.fromkeys(d[STAT] for devices in lists.values() for d in devices))
    stats += sorted(sources - gas - set(stats))
    now = dt_util.now()
    energy = await async_energy(hass, stats, period, now)
    if gas:
        energy |= await async_energy(hass, sorted(gas), period, now, gas_unit(hass))
    unit = water_unit(hass)
    minimum = {
        DeviceKind.ELECTRICITY: PLAUSIBILITY_MIN_KWH,
        DeviceKind.WATER: VolumeConverter.convert(PLAUSIBILITY_MIN_LITERS, "L", unit),
    }
    rest: dict[str, float | None] = {}
    issues: list[dict[str, Any]] = []
    for kind, devices in lists.items():
        roots = build_tree(devices)
        rest |= untracked(roots, energy)
        issues += [
            issue.as_dict()
            for issue in plausibility(
                roots, energy, min_amount=minimum[kind], kind=kind
            )
        ]
    start, end = period_range(period, now)
    result: dict[str, Any] = {
        "period": period,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "energy": energy,
        "water_unit": unit,
        "gas_unit": gas_unit(hass),
        "untracked": rest,
        "issues": issues,
    }
    if home_sources is not None and DeviceKind.ELECTRICITY in lists:
        roots = build_tree(lists[DeviceKind.ELECTRICITY])
        home = await _async_home(hass, home_sources, energy, period, end)
        home["untracked"] = home_untracked(roots, energy, home["value"])
        result["home"] = home
        if home["untracked"] is not None:
            rest[HOME] = home["untracked"]
        if issue := home_plausibility(roots, energy, home["value"]):
            issues.append(issue.as_dict())
    return result


async def _async_home(
    hass: HomeAssistant,
    sources: list[Any],
    energy: dict[str, float | None],
    period: str,
    end: datetime,
) -> dict[str, Any]:
    """Return the home consumption of a period, unless its data is too late.

    The caller adds `untracked`, what no top-level device covers.

    `stale` names the first meter behind it whose statistics end too long
    before `end`; then there is no value, untracked value or warning. A home
    meter without 5-minute statistics (an external one) is too late for today.
    """
    value, basis = home_consumption(sources, energy)
    stats = home_stats(sources)
    meter = any(source.get("type") == "home" for source in sources)
    stale = None
    if meter and stats and value is None and period == "today":
        stale = stats[0]
    elif value is not None or meter:
        stale = stale_stat(stats, await async_last_ends(hass, stats), end)
    if stale is not None:
        value = basis = None
    return {"value": value, "basis": basis, "stale": stale}


async def _async_card_validation(
    hass: HomeAssistant, runtime: EnergyFlowMapperData, prefs: Prefs
) -> dict[str, Any] | None:
    """Return HA's energy validation, at most once a minute for all cards.

    The result is indexed like the energy settings, so a change of them
    (another device order) asks again at once.
    """
    now = monotonic()
    current = prefs_hash(prefs)
    cache = runtime.validation_cache
    if (
        cache is not None
        and cache[1] == current
        and now - cache[0] < CARD_VALIDATION_SECONDS
    ):
        return cache[2]
    running = runtime.validation_running
    if running is None or running[0] != current:
        task = hass.async_create_task(
            energy_access.async_validation(hass), "energy_flow_mapper validation"
        )
        running = runtime.validation_running = (current, task)
    try:
        validation = await asyncio.shield(running[1])
    finally:
        if runtime.validation_running is running and running[1].done():
            runtime.validation_running = None
    runtime.validation_cache = (now, current, validation)
    return validation


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/card",
        vol.Optional(ATTR_KIND, default=DeviceKind.ELECTRICITY.value): _KINDS,
        vol.Optional(ATTR_PERIOD): vol.In(list(PERIODS)),
    }
)
@async_response
async def websocket_card(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return one device tree for the dashboard card; every user may read it.

    Only what the card shows: the devices of the list with name, parent, rate
    sensor and area, the groups and sources of the list, and with `period` the energy,
    untracked values and warnings. No prices or costs, and nothing to change.
    """
    runtime = _runtime(hass)
    kind = DeviceKind(msg[ATTR_KIND])
    prefs = await energy_access.async_get_prefs(hass)
    groups = clean_groups(runtime.groups.groups(), prefs)
    devices: list[Any] = prefs.get(DEVICE_KEYS[kind], [])
    sources = [s for s in prefs.get(KEY_SOURCES, []) if source_kind(s) == kind]
    rows = [
        (source, role, stat)
        for source in sources
        for key, role in SOURCE_ROLES.get(source.get("type", ""), {}).items()
        if isinstance(stat := source.get(key), str)
    ]
    stats = {d[STAT] for d in devices} | {stat for _, _, stat in rows}
    # Every card asks every minute: only the external statistics it shows are
    # looked up, from the recorder's cache.
    external = await async_external_statistics(
        hass, {stat for stat in stats if not valid_entity_id(stat)}
    )
    info = {stat: async_stat_info(hass, stat, external) for stat in stats}
    result: dict[str, Any] = {
        "kind": kind,
        "devices": [
            {
                "stat": device[STAT],
                "name": device.get(NAME)
                or info[device[STAT]]["energy_name"]
                or info[device[STAT]]["name"]
                or device[STAT],
                "parent": device.get(PARENT),
                "stat_rate": device.get(RATE),
                "area": info[device[STAT]]["area_name"],
            }
            for device in devices
        ],
        "sources": [
            {
                "type": source["type"],
                "role": role,
                "stat": stat,
                "name": source.get(NAME) or info[stat]["name"] or stat,
                # Home now comes from the home meter's power sensor.
                **(
                    {"stat_rate": source[RATE]}
                    if role == "home" and isinstance(source.get(RATE), str)
                    else {}
                ),
            }
            for source, role, stat in rows
        ],
        "groups": groups_of(groups, kind),
        "water_unit": water_unit(hass),
        "home_supported": energy_access.home_supported(),
    }
    allowed = stats | {
        rate for item in (*devices, *sources) if isinstance(rate := item.get(RATE), str)
    }
    validation = await _async_card_validation(hass, runtime, prefs)
    result["ha_issues"] = card_ha_issues(
        ha_issues(prefs, validation or {}, _issues(hass, prefs)), allowed
    )
    if ATTR_PERIOD in msg:
        result |= await _async_period(
            hass,
            {kind: devices},
            {stat for _, _, stat in rows},
            msg[ATTR_PERIOD],
            sources if kind == DeviceKind.ELECTRICITY else None,
        )
    connection.send_result(msg["id"], result)


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/export",
        vol.Optional(ATTR_BACKUP_ID): str,
    }
)
@require_admin
@async_response
async def websocket_export(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the sources, devices and groups as an export document.

    With `backup_id`, the content of that backup (its groups when it has
    them); otherwise the current settings and groups.
    """
    runtime = _runtime(hass)
    exported = dt_util.utcnow().isoformat()
    if ATTR_BACKUP_ID in msg:
        backup = runtime.backups.get(msg[ATTR_BACKUP_ID])
        if backup is None:
            raise _error("backup_not_found", backup_id=msg[ATTR_BACKUP_ID])
        document = build_export(backup["data"], exported, backup, backup.get("groups"))
    else:
        prefs = await energy_access.async_get_prefs(hass)
        document = build_export(
            prefs, exported, None, clean_groups(runtime.groups.groups(), prefs)
        )
    connection.send_result(msg["id"], document)


def _imported(
    prefs: Prefs, document: Any
) -> tuple[dict[str, Any], dict[str, Any], Groups | None]:
    """Return the preferences with an import applied, the changed lists and groups.

    The groups are the imported ones as given, or None for a file without any.
    """
    try:
        data, imported_groups = parse_import(document)
    except InvalidImportError as err:
        raise _error("invalid_import", error=str(err)) from err
    update = {key: value for key, value in data.items() if prefs.get(key) != value}
    _refuse_home_without_support(update)
    return dict(prefs) | update, update, imported_groups


def _imported_groups_change(
    runtime: EnergyFlowMapperData, new: Mapping[str, Any], imported: Groups | None
) -> bool:
    """Return whether an import changes the groups as they will look afterwards.

    Both sides are cleaned against the imported preferences `new`, so a device
    that comes back with the import counts as it will be seen. Only call this
    once the imported lists have passed Home Assistant's schemas; cleaning
    needs well-formed devices.
    """
    return imported is not None and clean_groups(imported, new) != clean_groups(
        runtime.groups.groups(), new
    )


_IMPORT_SCHEMA: dict[vol.Marker | str, Any] = {
    vol.Required(ATTR_BASE_HASH): str,
    vol.Required(ATTR_DOCUMENT): dict,
}


@websocket_command({vol.Required("type"): f"{DOMAIN}/import_check", **_IMPORT_SCHEMA})
@require_admin
@async_response
async def websocket_import_check(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Check an export document against the current settings without saving.

    Answers like `validate`; `changed` is False when the file holds the
    current settings already.
    """
    runtime = _runtime(hass)
    prefs, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
    new, update, imported_groups = _imported(prefs, msg[ATTR_DOCUMENT])
    # A file is not checked like a draft: its lists may be malformed, so
    # Home Assistant's schemas come first and the hierarchy only after them.
    rejected = energy_access.schema_error(update)
    issues = _issues(hass, new) if rejected is None else []
    groups_changed = False
    new_groups = groups
    if rejected is None:
        groups_changed = _imported_groups_change(runtime, new, imported_groups)
        new_groups = clean_groups(
            imported_groups
            if groups_changed and imported_groups
            else runtime.groups.groups(),
            new,
        )
    connection.send_result(
        msg["id"],
        {
            "valid": not has_errors(issues) and rejected is None,
            "changed": bool(update) or groups_changed,
            "issues": [issue.as_dict() for issue in issues],
            "rejected": rejected,
            "diff": (
                [*diff(prefs, new), *diff_groups(groups, new_groups)]
                if rejected is None
                else []
            ),
        },
    )


@websocket_command({vol.Required("type"): f"{DOMAIN}/import", **_IMPORT_SCHEMA})
@require_admin
@async_response
async def websocket_import(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Import an export document; the current content is backed up first."""
    runtime = _runtime(hass)
    async with runtime.lock:
        prefs, groups = await _async_current(hass, runtime, msg[ATTR_BASE_HASH])
        new, update, imported_groups = _imported(prefs, msg[ATTR_DOCUMENT])
        energy_access.validate(update)
        groups_changed = _imported_groups_change(runtime, new, imported_groups)
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
        if not update and not groups_changed:
            connection.send_result(
                msg["id"], {"hash": msg[ATTR_BASE_HASH], ATTR_BACKUP_ID: None}
            )
            return
        result = await _async_write_with_backup(
            connection,
            runtime,
            (prefs, groups),
            (update, imported_groups if groups_changed else None),
            {"imported": 1},
        )
    connection.send_result(msg["id"], result)


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/ignore_suggestion",
        vol.Required(ATTR_KIND): _KINDS,
        vol.Required("stat"): str,
        vol.Required("parent"): str,
    }
)
@require_admin
@async_response
async def websocket_ignore_suggestion(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Stop suggesting `stat` below `parent`; returns the ignored list."""
    runtime = _runtime(hass)
    prefs = await energy_access.async_get_prefs(hass)
    # Devices and free meters: a draft may add a free meter as a device.
    known = {
        (kind.value, device[STAT])
        for kind, key in DEVICE_KEYS.items()
        for device in prefs.get(key, [])
    } | {
        (kind.value, candidate["stat"])
        for kind in DEVICE_KEYS
        for candidate in async_candidates(hass, prefs, kind)
    }
    await runtime.suggestions.async_ignore(
        {"kind": msg[ATTR_KIND], "stat": msg["stat"], "parent": msg["parent"]}, known
    )
    connection.send_result(msg["id"], {"ignored": runtime.suggestions.ignored()})


@websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/clear_suggestions",
        vol.Optional(ATTR_KIND): _KINDS,
    }
)
@require_admin
@async_response
async def websocket_clear_suggestions(
    hass: HomeAssistant, connection: ActiveConnection, msg: dict[str, Any]
) -> None:
    """Show the ignored suggestions of one list (or all) again."""
    runtime = _runtime(hass)
    await runtime.suggestions.async_clear(msg.get(ATTR_KIND))
    connection.send_result(msg["id"], {"ignored": runtime.suggestions.ignored()})
