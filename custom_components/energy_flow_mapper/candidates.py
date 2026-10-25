"""Describe statistics and find sensors and statistics that are not used yet."""

from __future__ import annotations

from collections.abc import Collection, Mapping
from typing import Any

from homeassistant.components.recorder.statistics import async_list_statistic_ids
from homeassistant.components.sensor import (
    ATTR_STATE_CLASS,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.const import (
    ATTR_DEVICE_CLASS,
    ATTR_FRIENDLY_NAME,
    ATTR_UNIT_OF_MEASUREMENT,
    UnitOfEnergy,
    UnitOfPower,
    UnitOfVolume,
)
from homeassistant.core import HomeAssistant, callback, valid_entity_id
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr

from .hierarchy import DEVICE_KEYS, STAT, DeviceKind, Prefs, used_stats

ENERGY_UNITS = frozenset(unit.value for unit in UnitOfEnergy)
POWER_UNITS = frozenset(unit.value for unit in UnitOfPower)
# The units Home Assistant accepts for water meters.
WATER_UNITS = frozenset(
    unit.value
    for unit in (
        UnitOfVolume.CENTUM_CUBIC_FEET,
        UnitOfVolume.CUBIC_FEET,
        UnitOfVolume.CUBIC_METERS,
        UnitOfVolume.GALLONS,
        UnitOfVolume.LITERS,
        UnitOfVolume.MILLE_CUBIC_FEET,
    )
)
UNITS: dict[DeviceKind, frozenset[str]] = {
    DeviceKind.ELECTRICITY: ENERGY_UNITS,
    DeviceKind.WATER: WATER_UNITS,
}
# Device class of a meter, and of the sensor suggested as its `stat_rate`.
METER_CLASSES: dict[DeviceKind, tuple[SensorDeviceClass, SensorDeviceClass]] = {
    DeviceKind.ELECTRICITY: (SensorDeviceClass.ENERGY, SensorDeviceClass.POWER),
    DeviceKind.WATER: (SensorDeviceClass.WATER, SensorDeviceClass.VOLUME_FLOW_RATE),
}
METER_STATE_CLASSES = (SensorStateClass.TOTAL, SensorStateClass.TOTAL_INCREASING)
INTEGRATION_DOMAIN = "integration"


def _device_class(hass: HomeAssistant, entity_id: str) -> str | None:
    state = hass.states.get(entity_id)
    if state is not None and ATTR_DEVICE_CLASS in state.attributes:
        return str(state.attributes[ATTR_DEVICE_CLASS])
    entry = er.async_get(hass).async_get(entity_id)
    if entry is None:
        return None
    return entry.device_class or entry.original_device_class


def _entity_name(entry: er.RegistryEntry | None, device_name: str | None) -> str | None:
    """Return the full name of an entity the way Home Assistant builds it.

    A name set by the user is the full name; otherwise entities with
    `has_entity_name` combine the device name and their own name. This does
    not depend on the state, which may not be there yet after a restart.
    """
    if entry is None:
        return None
    if entry.name:
        return entry.name
    if entry.has_entity_name and device_name:
        return (
            f"{device_name} {entry.original_name}"
            if entry.original_name
            else device_name
        )
    return entry.original_name


@callback
def async_stat_info(
    hass: HomeAssistant,
    stat: str,
    external: Mapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Return name, unit, device, area and floor of a statistic.

    Statistics that are not entities (external statistics) get name and unit
    from the recorder metadata in `external`, if known, and the device class
    that fits the unit.
    """
    info: dict[str, Any] = {
        "stat": stat,
        "entity_id": None,
        "name": None,
        "unit": None,
        "device_class": None,
        "device_id": None,
        "device_name": None,
        "area_id": None,
        "area_name": None,
        "floor_id": None,
        "floor_name": None,
    }
    if not valid_entity_id(stat):
        meta = (external or {}).get(stat)
        if meta is not None:
            info["name"] = meta.get("name")
            info["unit"] = meta.get("statistics_unit_of_measurement")
            info["device_class"] = (
                SensorDeviceClass.WATER.value
                if info["unit"] in WATER_UNITS
                else SensorDeviceClass.ENERGY.value
            )
        return info

    state = hass.states.get(stat)
    entry = er.async_get(hass).async_get(stat)
    info["entity_id"] = stat
    info["device_class"] = _device_class(hass, stat)
    device = None
    if entry is not None and entry.device_id:
        device = dr.async_get(hass).async_get(entry.device_id)
    if device is not None:
        info["device_id"] = device.id
        info["device_name"] = device.name_by_user or device.name

    if state is not None:
        info["unit"] = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)
    if entry is not None:
        info["unit"] = info["unit"] or entry.unit_of_measurement
    info["name"] = _entity_name(entry, info["device_name"]) or (
        state.attributes.get(ATTR_FRIENDLY_NAME) if state is not None else None
    )

    area_id = (entry.area_id if entry else None) or (device.area_id if device else None)
    area = ar.async_get(hass).async_get_area(area_id) if area_id else None
    if area is not None:
        info["area_id"] = area.id
        info["area_name"] = area.name
        floor = (
            fr.async_get(hass).async_get_floor(area.floor_id) if area.floor_id else None
        )
        if floor is not None:
            info["floor_id"] = floor.floor_id
            info["floor_name"] = floor.name
    return info


@callback
def async_stats_info(
    hass: HomeAssistant,
    prefs: Prefs,
    external: Mapping[str, Mapping[str, Any]] | None = None,
) -> dict[str, dict[str, Any]]:
    """Describe every statistic referenced in the preferences."""
    return {
        stat: async_stat_info(hass, stat, external)
        for stat in sorted(used_stats(prefs))
    }


@callback
def async_stat_units(hass: HomeAssistant, prefs: Prefs) -> dict[str, str | None]:
    """Return the unit of each device statistic (both lists) that exists.

    Missing statistics are left out (they get a warning); external statistics
    map to None because their unit is not known here.
    """
    registry = er.async_get(hass)
    units: dict[str, str | None] = {}
    devices = [device for key in DEVICE_KEYS.values() for device in prefs.get(key, [])]
    for device in devices:
        stat = device[STAT]
        if not valid_entity_id(stat):
            units[stat] = None
            continue
        state = hass.states.get(stat)
        entry = registry.async_get(stat)
        if state is None and entry is None:
            continue
        unit = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT) if state else None
        units[stat] = unit or (entry.unit_of_measurement if entry else None)
    return units


def _rate_sensor(
    hass: HomeAssistant, device_id: str | None, device_class: SensorDeviceClass
) -> str | None:
    """Return the first sensor of a device with that class (power, flow)."""
    if device_id is None:
        return None
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    return next(
        (
            entry.entity_id
            for entry in sorted(entries, key=lambda e: e.entity_id)
            if entry.domain == "sensor"
            and _device_class(hass, entry.entity_id) == device_class
        ),
        None,
    )


@callback
def async_candidates(
    hass: HomeAssistant,
    prefs: Prefs,
    kind: DeviceKind = DeviceKind.ELECTRICITY,
) -> list[dict[str, Any]]:
    """Return energy (or water) meters that are not used in the dashboard yet.

    Each candidate suggests a power (or flow) sensor of the same device as
    `stat_rate`, in its field `power`. Disabled entities have no state and are
    therefore never listed.
    """
    meter_class, rate_class = METER_CLASSES[kind]
    used = used_stats(prefs)
    candidates = []
    for state in hass.states.async_all("sensor"):
        if (
            state.entity_id in used
            or state.attributes.get(ATTR_DEVICE_CLASS) != meter_class
            or state.attributes.get(ATTR_STATE_CLASS) not in METER_STATE_CLASSES
        ):
            continue
        info = async_stat_info(hass, state.entity_id)
        info["power"] = _rate_sensor(hass, info["device_id"], rate_class)
        candidates.append(info)
    return _sorted(candidates)


def _sorted(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        candidates,
        key=lambda c: (
            (c["area_name"] or "").casefold(),
            (c["name"] or c["stat"]).casefold(),
        ),
    )


async def async_external_statistics(hass: HomeAssistant) -> dict[str, dict[str, Any]]:
    """Return external statistics with a sum in an energy or water unit, by ID.

    External statistics (e.g. from energy supplier portals) belong to no
    entity; their ID contains a colon. Without a recorder there are none.
    """
    if "recorder" not in hass.config.components:
        return {}
    statistics = await async_list_statistic_ids(hass, statistic_type="sum")
    return {
        meta["statistic_id"]: meta
        for meta in statistics
        if not valid_entity_id(meta["statistic_id"])
        and meta.get("statistics_unit_of_measurement") in ENERGY_UNITS | WATER_UNITS
    }


@callback
def async_external_candidates(
    hass: HomeAssistant,
    prefs: Prefs,
    external: Mapping[str, Mapping[str, Any]],
    kind: DeviceKind = DeviceKind.ELECTRICITY,
) -> list[dict[str, Any]]:
    """Return external energy (or water) statistics that are not used yet.

    A volume statistic may also measure gas; the user decides.
    """
    used = used_stats(prefs)
    return _sorted(
        [
            async_stat_info(hass, stat, external) | {"power": None, "external": True}
            for stat, meta in external.items()
            if stat not in used
            and meta.get("statistics_unit_of_measurement") in UNITS[kind]
        ]
    )


@callback
def async_integral_sources(hass: HomeAssistant) -> set[str]:
    """Return the sensors that already feed an integral helper."""
    return {
        str(entry.options.get("source"))
        for entry in hass.config_entries.async_entries(INTEGRATION_DOMAIN)
        if entry.options.get("source")
    }


def _has_meter(hass: HomeAssistant, device_id: str | None) -> bool:
    """Return True if a device already has an energy meter."""
    if device_id is None:
        return False
    for entry in er.async_entries_for_device(er.async_get(hass), device_id):
        state = hass.states.get(entry.entity_id)
        if (
            state is not None
            and state.attributes.get(ATTR_DEVICE_CLASS) == SensorDeviceClass.ENERGY
            and state.attributes.get(ATTR_STATE_CLASS) in METER_STATE_CLASSES
        ):
            return True
    return False


@callback
def async_power_candidates(hass: HomeAssistant, prefs: Prefs) -> list[dict[str, Any]]:
    """Return power sensors that have no energy meter yet.

    Left out: sensors used anywhere in the preferences, sensors of a device
    that has an energy meter, and sensors that already feed an integral helper.
    """
    used = used_stats(prefs) | async_integral_sources(hass)
    registry = er.async_get(hass)
    candidates = []
    for state in hass.states.async_all("sensor"):
        if (
            state.entity_id in used
            or state.attributes.get(ATTR_DEVICE_CLASS) != SensorDeviceClass.POWER
            or state.attributes.get(ATTR_UNIT_OF_MEASUREMENT) not in POWER_UNITS
        ):
            continue
        entry = registry.async_get(state.entity_id)
        if _has_meter(hass, entry.device_id if entry else None):
            continue
        candidates.append(async_stat_info(hass, state.entity_id))
    return _sorted(candidates)


@callback
def async_mark_created(
    hass: HomeAssistant,
    infos: Collection[dict[str, Any]],
    created_entries: Collection[str],
) -> None:
    """Flag statistics whose entity belongs to a helper created by the panel."""
    registry = er.async_get(hass)
    for info in infos:
        entry = registry.async_get(info["entity_id"]) if info["entity_id"] else None
        info["created_helper"] = (
            entry is not None and entry.config_entry_id in created_entries
        )
