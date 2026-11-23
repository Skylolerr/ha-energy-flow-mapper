"""Find the hints the panel shows at the blocks.

A hint only explains and offers a button; it never changes anything. Hints are
computed here because they need what the panel cannot see: Home Assistant's
entity registry (disabled returned-energy sensors), config entries (the
members of a sum helper) and the recorder (energy counted lately).

- `returned_energy`: an electricity device whose HA device also counts
  returned energy, while a solar source exists. Shelly plugs and switches have
  an enabled returned sensor, every Shelly Pro EM channel a disabled one, so
  the hint needs more than the sensor: an enabled one must have counted energy
  in the last days, a disabled one needs a device with children.
- `daily_in_sum`: a meter that is a sensor group sum (ours or the user's) whose
  members mix meters that reset every day with others.
- `power_available`: a device or source without a power (flow) sensor whose HA
  device has one.
"""

from __future__ import annotations

from collections.abc import Collection, Iterator, Mapping
from enum import StrEnum
from typing import Any, Final

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.helpers import entity_registry as er

from .candidates import METER_CLASSES, rate_sensor
from .daily_reset import async_hourly_statistics
from .hierarchy import (
    DEVICE_KEYS,
    EDITABLE_SOURCE_TYPES,
    FROM,
    KEY_DEVICES,
    KEY_SOURCES,
    PARENT,
    RATE,
    SOURCE_ROLES,
    STAT,
    DeviceKind,
    Prefs,
    power_stats,
    source_energy_stats,
    source_kind,
    used_stats,
)


class HintCode(StrEnum):
    """The hints of the panel."""

    RETURNED_ENERGY = "returned_energy"
    DAILY_IN_SUM = "daily_in_sum"
    POWER_AVAILABLE = "power_available"


# Translation keys of returned (exported) energy sensors, checked in HA 2026.10
# and 2026.11. The registry keeps them for disabled entities too.
# - `energy_returned`: Shelly, every returned sensor (Gen1 `emeter`
#   `energyReturned`; Gen2+ `ret_aenergy` of switches and PM1, `emdata`
#   `total_act_ret` and per phase, `em1data` `total_act_ret_energy`);
#   `energy_returned_with_channel_name` when the channel has a name.
# - `energy_exported`: Matter (cumulative energy exported), SolarEdge Modbus
#   meters, Homevolt.
# - `energy_return`: Powerfox, Powerfox Local.
RETURNED_TRANSLATION_KEYS: Final = frozenset(
    {
        "energy_returned",
        "energy_returned_with_channel_name",
        "energy_exported",
        "energy_return",
    }
)
# Shelly's unique IDs end in the key of the sensor description
# (`<mac>-<channel>-<key>`); this finds an entry stored without translation key.
SHELLY_RETURNED_KEYS: Final = frozenset(
    {
        "energyReturned",
        "ret_energy",
        "ret_energy_pm1",
        "total_act_ret",
        "total_act_ret_energy",
        "a_total_act_ret_energy",
        "b_total_act_ret_energy",
        "c_total_act_ret_energy",
    }
)
# Fallback for other integrations: words in the entity name (the user's name or
# the integration's). The registry stores `original_name` in the language of
# the instance, so this only works where Home Assistant runs in English;
# elsewhere the translation keys above are needed.
RETURNED_NAME_WORDS: Final = ("returned", "export")
# Days in which a returned sensor must have counted energy.
COUNTED_DAYS: Final = 3

GROUP_DOMAIN: Final = "group"


def _is_returned(entry: er.RegistryEntry) -> bool:
    """Return True for a registry entry of a returned energy sensor."""
    if entry.translation_key in RETURNED_TRANSLATION_KEYS:
        return True
    if (
        entry.platform == "shelly"
        and entry.unique_id.rsplit("-", 1)[-1] in SHELLY_RETURNED_KEYS
    ):
        return True
    name = (entry.name or entry.original_name or "").casefold()
    return any(word in name for word in RETURNED_NAME_WORDS)


def returned_sensors(
    hass: HomeAssistant, meter_entity_id: str, *, exclude: Collection[str] = ()
) -> list[tuple[str, bool]]:
    """Return (entity ID, disabled) of every returned sensor of a meter's device.

    Looks at every energy sensor of the meter's HA device, disabled ones too
    (they have no state, only a registry entry). Enabled sensors come first,
    then by entity ID. Sensors in `exclude` (those already used in the energy
    settings, such as a solar or grid export statistic) are left out: their
    energy is counted already.
    """
    registry = er.async_get(hass)
    meter = registry.async_get(meter_entity_id)
    if meter is None or meter.device_id is None:
        return []
    found = [
        entry
        for entry in er.async_entries_for_device(
            registry, meter.device_id, include_disabled_entities=True
        )
        if entry.entity_id != meter_entity_id
        and entry.entity_id not in exclude
        and entry.domain == "sensor"
        and (entry.device_class or entry.original_device_class)
        == SensorDeviceClass.ENERGY
        and _is_returned(entry)
    ]
    return [
        (entry.entity_id, entry.disabled)
        for entry in sorted(found, key=lambda entry: (entry.disabled, entry.entity_id))
    ]


def returned_sensor(
    hass: HomeAssistant, meter_entity_id: str, *, exclude: Collection[str] = ()
) -> tuple[str, bool] | None:
    """Return (entity ID, disabled) of the returned sensor of a meter's device.

    The first of `returned_sensors`: an enabled sensor before a disabled one.
    None when the meter has no device or the device has no returned sensor
    outside `exclude`.
    """
    found = returned_sensors(hass, meter_entity_id, exclude=exclude)
    return found[0] if found else None


def _sum_helper(hass: HomeAssistant, stat: str) -> tuple[str, list[str]] | None:
    """Return (config entry ID, members) of a sensor group helper of type sum."""
    if not valid_entity_id(stat):
        return None
    entry = er.async_get(hass).async_get(stat)
    config_entry = (
        hass.config_entries.async_get_entry(entry.config_entry_id)
        if entry is not None and entry.config_entry_id
        else None
    )
    if (
        config_entry is None
        or config_entry.domain != GROUP_DOMAIN
        or config_entry.options.get("group_type") != "sensor"
        or config_entry.options.get("type") != "sum"
    ):
        return None
    members = [str(member) for member in config_entry.options.get("entities", [])]
    return config_entry.entry_id, members


def sum_members(hass: HomeAssistant, stat: str) -> list[str] | None:
    """Return the members if `stat` is a sensor group helper of type sum."""
    helper = _sum_helper(hass, stat)
    return helper[1] if helper is not None else None


def meter_stats(prefs: Prefs) -> set[str]:
    """Return the meters of all devices and the energy meters of all sources."""
    return {
        device[STAT] for key in DEVICE_KEYS.values() for device in prefs.get(key, [])
    } | source_energy_stats(prefs.get(KEY_SOURCES, []))


def meter_powers(prefs: Prefs) -> dict[str, str]:
    """Return the power sensor of each electricity device and solar source meter.

    A meter's own power explains its falls (a net meter exporting near 0).
    Grid and battery powers are left out: their sign is not the meter's.
    """
    powers = {
        device[STAT]: device[RATE]
        for device in prefs.get(KEY_DEVICES, [])
        if isinstance(device.get(RATE), str)
    }
    powers |= {
        source[FROM]: source[RATE]
        for source in prefs.get(KEY_SOURCES, [])
        if source.get("type") == "solar"
        and isinstance(source.get(FROM), str)
        and isinstance(source.get(RATE), str)
    }
    return powers


def async_sum_members(hass: HomeAssistant, prefs: Prefs) -> set[str]:
    """Return the members of every sum helper used as a device or source meter.

    `get` reads their daily resets together with the other meters'.
    """
    return {
        member
        for stat in meter_stats(prefs)
        for member in sum_members(hass, stat) or []
    }


def _hint(
    code: HintCode, stat: str, kind: DeviceKind, data: dict[str, Any]
) -> dict[str, Any]:
    return {"code": code, "stat": stat, "kind": kind, "data": data}


def _daily_hint(
    hass: HomeAssistant, stat: str, kind: DeviceKind, daily: set[str]
) -> dict[str, Any] | None:
    """Return the hint of a sum helper that mixes daily and other members."""
    if (helper := _sum_helper(hass, stat)) is None:
        return None
    entry_id, members = helper
    daily_members = [member for member in members if member in daily]
    if not daily_members or len(daily_members) == len(members):
        return None
    return _hint(
        HintCode.DAILY_IN_SUM,
        stat,
        kind,
        {"entry_id": entry_id, "members": members, "daily": daily_members},
    )


def _power(
    hass: HomeAssistant,
    stats: Mapping[str, dict[str, Any]],
    stat: str,
    kind: DeviceKind,
) -> str | None:
    """Return the power (flow) sensor of the statistic's HA device, if any."""
    return rate_sensor(
        hass, (stats.get(stat) or {}).get("device_id"), METER_CLASSES[kind][1]
    )


def _returned_by_device(prefs: Prefs) -> Iterator[tuple[str, set[str]]]:
    """Yield (electricity device stat, used statistics) while solar exists."""
    sources = prefs.get(KEY_SOURCES, [])
    if not any(source.get("type") == "solar" for source in sources):
        return
    used = used_stats(prefs)
    for device in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], []):
        yield device[STAT], used


async def async_counted_returned(hass: HomeAssistant, prefs: Prefs) -> set[str]:
    """Return the enabled returned sensors that counted energy in the last days.

    Only sensors that can give a hint are read, all in one query: enabled
    returned sensors of electricity devices, not used in the settings, while
    a solar source exists. A failing recorder gives an empty set.
    """
    entity_ids = {
        entity_id
        for stat, used in _returned_by_device(prefs)
        for entity_id, disabled in returned_sensors(hass, stat, exclude=used)
        if not disabled
    }
    if not entity_ids:
        return set()
    rows = await async_hourly_statistics(hass, entity_ids, COUNTED_DAYS, {"change"})
    return {
        entity_id
        for entity_id in entity_ids
        if sum(row.get("change") or 0 for row in (rows or {}).get(entity_id, [])) > 0
    }


def _returned_hints(
    hass: HomeAssistant, prefs: Prefs, counted: set[str]
) -> dict[str, dict[str, Any]]:
    """Return the returned-energy hint of each electricity device, by stat.

    A device gets it when any of its returned sensors qualifies: enabled and
    in `counted`, or disabled and the device has children. `data` names the
    first one that does.
    """
    parents = {
        device.get(PARENT)
        for device in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], [])
    }
    hints: dict[str, dict[str, Any]] = {}
    for stat, used in _returned_by_device(prefs):
        for entity_id, disabled in returned_sensors(hass, stat, exclude=used):
            if (stat in parents) if disabled else (entity_id in counted):
                hints[stat] = _hint(
                    HintCode.RETURNED_ENERGY,
                    stat,
                    DeviceKind.ELECTRICITY,
                    {"entity_id": entity_id, "disabled": disabled},
                )
                break
    return hints


def _source_hints(
    hass: HomeAssistant,
    source: Mapping[str, Any],
    stats: Mapping[str, dict[str, Any]],
    daily: set[str],
) -> list[dict[str, Any]]:
    """Return the hints of a source; a power hint names the role it is for."""
    kind = source_kind(source)
    roles = [
        (role, stat)
        for key, role in SOURCE_ROLES[source["type"]].items()
        if isinstance(stat := source.get(key), str)
    ]
    hints = [
        hint
        for _, stat in roles
        if (hint := _daily_hint(hass, stat, kind, daily)) is not None
    ]
    # Grid and battery: no power sensor means neither `stat_rate` nor
    # `power_config`. The first role whose HA device has one gets the hint.
    if not power_stats(source):
        hints.extend(
            [
                _hint(
                    HintCode.POWER_AVAILABLE,
                    stat,
                    kind,
                    {"entity_id": power, "role": role},
                )
                for role, stat in roles
                if (power := _power(hass, stats, stat, kind))
            ][:1]
        )
    return hints


async def async_hints(
    hass: HomeAssistant,
    prefs: Prefs,
    stats: Mapping[str, dict[str, Any]],
    daily: set[str],
    counted: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Return the hints of the devices, then the sources, in settings order.

    `stats` is the statistics info of `get` (for the HA device of a meter),
    `daily` the statistics that reset every day, `counted` the result of
    `async_counted_returned` (read here when not given; `get` reads it
    together with `daily`). Hint dicts are `{code, stat, kind, data}`;
    dismissals are left to the panel.
    """
    if counted is None:
        counted = await async_counted_returned(hass, prefs)
    returned = _returned_hints(hass, prefs, counted)
    hints: list[dict[str, Any]] = []
    for kind, key in DEVICE_KEYS.items():
        for device in prefs.get(key, []):
            stat = device[STAT]
            if kind is DeviceKind.ELECTRICITY and stat in returned:
                hints.append(returned[stat])
            if (hint := _daily_hint(hass, stat, kind, daily)) is not None:
                hints.append(hint)
            if not device.get(RATE) and (power := _power(hass, stats, stat, kind)):
                hints.append(
                    _hint(HintCode.POWER_AVAILABLE, stat, kind, {"entity_id": power})
                )
    for source in prefs.get(KEY_SOURCES, []):
        if source.get("type") in EDITABLE_SOURCE_TYPES:
            hints.extend(_source_hints(hass, source, stats, daily))
    return hints
