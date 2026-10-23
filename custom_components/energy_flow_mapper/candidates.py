"""Describe statistics and find energy sensors that are not used yet."""

from __future__ import annotations

from typing import Any

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
)
from homeassistant.core import HomeAssistant, callback, valid_entity_id
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import floor_registry as fr

from .hierarchy import KEY_DEVICES, STAT, Prefs, used_stats

ENERGY_UNITS = frozenset(unit.value for unit in UnitOfEnergy)
METER_STATE_CLASSES = (SensorStateClass.TOTAL, SensorStateClass.TOTAL_INCREASING)


def _device_class(hass: HomeAssistant, entity_id: str) -> str | None:
    state = hass.states.get(entity_id)
    if state is not None and ATTR_DEVICE_CLASS in state.attributes:
        return str(state.attributes[ATTR_DEVICE_CLASS])
    entry = er.async_get(hass).async_get(entity_id)
    if entry is None:
        return None
    return entry.device_class or entry.original_device_class


@callback
def async_stat_info(hass: HomeAssistant, stat: str) -> dict[str, Any]:
    """Return name, unit, device, area and floor of a statistic.

    Statistics that are not entities (external statistics) only get their ID.
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
        return info

    state = hass.states.get(stat)
    entry = er.async_get(hass).async_get(stat)
    info["entity_id"] = stat
    info["device_class"] = _device_class(hass, stat)
    if state is not None:
        info["name"] = state.attributes.get(ATTR_FRIENDLY_NAME)
        info["unit"] = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)
    if entry is not None:
        info["name"] = info["name"] or entry.name or entry.original_name
        info["unit"] = info["unit"] or entry.unit_of_measurement

    device = None
    if entry is not None and entry.device_id:
        device = dr.async_get(hass).async_get(entry.device_id)
    if device is not None:
        info["device_id"] = device.id
        info["device_name"] = device.name_by_user or device.name

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
def async_stats_info(hass: HomeAssistant, prefs: Prefs) -> dict[str, dict[str, Any]]:
    """Describe every statistic referenced in the preferences."""
    return {stat: async_stat_info(hass, stat) for stat in sorted(used_stats(prefs))}


@callback
def async_stat_units(hass: HomeAssistant, prefs: Prefs) -> dict[str, str | None]:
    """Return the unit of each device statistic that exists.

    Missing statistics are left out (they get a warning); external statistics
    map to None because their unit is not known here.
    """
    registry = er.async_get(hass)
    units: dict[str, str | None] = {}
    for device in prefs.get(KEY_DEVICES, []):
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


def _power_sensor(hass: HomeAssistant, device_id: str | None) -> str | None:
    """Return the first power sensor of a device, if any."""
    if device_id is None:
        return None
    entries = er.async_entries_for_device(er.async_get(hass), device_id)
    return next(
        (
            entry.entity_id
            for entry in sorted(entries, key=lambda e: e.entity_id)
            if entry.domain == "sensor"
            and _device_class(hass, entry.entity_id) == SensorDeviceClass.POWER
        ),
        None,
    )


@callback
def async_candidates(hass: HomeAssistant, prefs: Prefs) -> list[dict[str, Any]]:
    """Return energy meters that are not used in the energy dashboard yet.

    Each candidate suggests a power sensor of the same device as `stat_rate`.
    Disabled entities have no state and are therefore never listed.
    """
    used = used_stats(prefs)
    candidates = []
    for state in hass.states.async_all("sensor"):
        if (
            state.entity_id in used
            or state.attributes.get(ATTR_DEVICE_CLASS) != SensorDeviceClass.ENERGY
            or state.attributes.get(ATTR_STATE_CLASS) not in METER_STATE_CLASSES
        ):
            continue
        info = async_stat_info(hass, state.entity_id)
        info["power"] = _power_sensor(hass, info["device_id"])
        candidates.append(info)
    return sorted(
        candidates,
        key=lambda c: (
            (c["area_name"] or "").casefold(),
            (c["name"] or c["stat"]).casefold(),
        ),
    )
