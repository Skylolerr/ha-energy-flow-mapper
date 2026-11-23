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
  device has one; for electricity the power of the meter's own channel
  (`device_rules.paired_power`), never one used in the settings.

The safety net watches the gross meters the solar setup created (recorded as
`gross_energy` in the created helpers), only by reading their statistics:

- `gross_off`: an hour whose change differs from the gross power's energy by
  more than max(0.5 kWh, 30 %), either way (`direction` fall or jump); without
  a gross power only a fall below -0.5 kWh. The two-hour windows around it
  must agree, so a meter that only counts late (a lag dip made up in the next
  hour) or catches up after a gap is no step. `input` names the input whose
  counter fell in that hour, if one did.
- `gross_unknown`: more than 1 h without a value in the last day's 5-minute
  statistics, while other watched statistics had values (else Home Assistant
  itself was off). `input` names the input that had no value either.
- `solar_term_short` / `solar_term_high`: the solar term (our integral of the
  solar's power) counted less or more than the solar's own energy statistic
  over the last full local day, by more than max(0.5 kWh, 15 %): dropouts
  longer than its hold, or Home Assistant downtime.

A check that fails, a missing recorder or a missing statistic only means no
hint: hints never break `get`.
"""

from __future__ import annotations

import asyncio
import logging
from bisect import bisect_left
from collections.abc import Callable, Collection, Iterator, Mapping
from dataclasses import dataclass, field
from datetime import timedelta
from enum import StrEnum
from functools import partial
from itertools import pairwise
from typing import Any, Final

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .candidates import METER_CLASSES, rate_sensor
from .daily_reset import async_hourly_statistics
from .device_rules import is_returned, paired_power
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
from .meter_inputs import Cache, direct_inputs
from .solar_setup import KIND_GROSS_ENERGY, KIND_SOLAR_ENERGY
from .stats_probe import HOURLY, SHORT_TERM, async_statistics

_LOGGER = logging.getLogger(__name__)


class HintCode(StrEnum):
    """The hints of the panel."""

    RETURNED_ENERGY = "returned_energy"
    DAILY_IN_SUM = "daily_in_sum"
    POWER_AVAILABLE = "power_available"
    GROSS_OFF = "gross_off"
    GROSS_UNKNOWN = "gross_unknown"
    SOLAR_TERM_SHORT = "solar_term_short"
    SOLAR_TERM_HIGH = "solar_term_high"


class Direction(StrEnum):
    """Which way a gross meter left its power."""

    FALL = "fall"
    JUMP = "jump"


# Days in which a returned sensor must have counted energy, and how much (kWh;
# the recorder converts the statistics to kWh).
COUNTED_DAYS: Final = 3
COUNTED_KWH: Final = 0.01

# gross_off: hourly statistics of the last days; a step is more than
# max(OFF_KWH, OFF_SHARE of the power's energy) away from it.
WATCH_DAYS: Final = 3
OFF_KWH: Final = 0.5
OFF_SHARE: Final = 0.3
HOURLY_TYPES: Final = {"change", "mean", "state"}
# gross_unknown: 5-minute statistics of the last day; a gap is longer than this.
GAP_DAYS: Final = 1
GAP_SECONDS: Final = 3600.0
SHORT_TYPES: Final = {"state", "mean"}
HOUR_SECONDS: Final = 3600.0
SHORT_SECONDS: Final = 300.0
# The solar term's day differs from its source by more than max(TERM_KWH,
# TERM_SHARE of the source).
TERM_KWH: Final = 0.5
TERM_SHARE: Final = 0.15
SOLAR_ROLE: Final = SOURCE_ROLES["solar"][FROM]

GROUP_DOMAIN: Final = "group"


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
        and is_returned(entry)
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
    used: Collection[str],
) -> str | None:
    """Return the power (flow) sensor to suggest for a meter, if any.

    Electricity: the power of the meter's own channel (`paired_power`), never
    one in `used`; call it only for a meter without a power, it reads the
    registry. Water and gas: the first flow sensor of the meter's HA device.
    """
    if kind is DeviceKind.ELECTRICITY:
        return paired_power(hass, stat, used)
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
        if sum(row.get("change") or 0 for row in (rows or {}).get(entity_id, []))
        >= COUNTED_KWH
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
    used: Collection[str],
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
                if (power := _power(hass, stats, stat, kind, used))
            ][:1]
        )
    return hints


async def async_hints(
    hass: HomeAssistant,
    prefs: Prefs,
    stats: Mapping[str, dict[str, Any]],
    daily: set[str],
    readings: Readings | None = None,
) -> list[dict[str, Any]]:
    """Return the hints of the devices, then the sources, in settings order.

    `stats` is the statistics info of `get` (for the HA device of a meter),
    `daily` the statistics that reset every day, `readings` what `get` read
    from the recorder for the hints, together with `daily`. Without it the
    returned sensors that counted lately are read here, and there are no
    safety-net hints. Hint dicts are `{code, stat, kind, data}`; dismissals
    are left to the panel.
    """
    if readings is None:
        readings = Readings(await async_counted_returned(hass, prefs))
    watched = readings.watched
    returned = _returned_hints(hass, prefs, readings.counted)
    used = used_stats(prefs)
    hints: list[dict[str, Any]] = []
    for kind, key in DEVICE_KEYS.items():
        for device in prefs.get(key, []):
            stat = device[STAT]
            if kind is DeviceKind.ELECTRICITY and stat in returned:
                hints.append(returned[stat])
            if (hint := _daily_hint(hass, stat, kind, daily)) is not None:
                hints.append(hint)
            if not device.get(RATE) and (
                power := _power(hass, stats, stat, kind, used)
            ):
                hints.append(
                    _hint(HintCode.POWER_AVAILABLE, stat, kind, {"entity_id": power})
                )
            hints.extend(watched.devices.get(stat, []))
    for source in prefs.get(KEY_SOURCES, []):
        if source.get("type") in EDITABLE_SOURCE_TYPES:
            hints.extend(_source_hints(hass, source, stats, daily, used))
            hints.extend(watched.sources.get(source.get(FROM), []))
    return hints


# --- Safety net: the gross meters of the solar setup -------------------------

type Rows = Mapping[str, list[Any]]


@dataclass
class Watched:
    """The safety-net hints, by device meter and by solar source meter."""

    devices: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    sources: dict[str, list[dict[str, Any]]] = field(default_factory=dict)


@dataclass
class Readings:
    """What the hints need from the recorder, read by `get` all at once."""

    # The result of `async_counted_returned`.
    counted: set[str]
    # The result of `async_watch`.
    watched: Watched = field(default_factory=Watched)


@dataclass
class _Gross:
    """A gross meter of the solar setup that is a device in the settings."""

    stat: str
    # Our gross power, if the gross meter has one.
    power: str | None
    # The user's sensors it reads (From power: through the gross power).
    inputs: list[str]
    # Our solar terms it reads -> the solar power each one integrates.
    terms: dict[str, str]


def _gross_meters(
    hass: HomeAssistant, prefs: Prefs, records: Mapping[str, Mapping[str, Any]]
) -> list[_Gross]:
    """Return the electricity devices whose meter is a gross meter of ours."""
    registry = er.async_get(hass)
    cache: Cache = {}

    def record(entity_id: str) -> Mapping[str, Any]:
        entry = registry.async_get(entity_id)
        found = (
            records.get(entry.config_entry_id)
            if entry is not None and entry.config_entry_id
            else None
        )
        return found or {}

    grosses: list[_Gross] = []
    for device in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], []):
        stat = device[STAT]
        if (gross := record(stat)).get("kind") != KIND_GROSS_ENERGY:
            continue
        power = next(
            (
                entry.entity_id
                for entry in er.async_entries_for_config_entry(
                    registry, str(gross.get("power"))
                )
            ),
            None,
        )
        reads = direct_inputs(hass, stat, cache)
        if power is not None and power in reads:
            # From power: our integral of the gross power, which reads the
            # circuit's and the solar's powers.
            reads = (reads - {power}) | direct_inputs(hass, power, cache)
        ours = {entity: record(entity) for entity in sorted(reads)}
        grosses.append(
            _Gross(
                stat,
                power,
                [entity for entity, found in ours.items() if not found],
                {
                    entity: found["power"]
                    for entity, found in ours.items()
                    if found.get("kind") == KIND_SOLAR_ENERGY
                    and isinstance(found.get("power"), str)
                },
            )
        )
    return grosses


def _term_sources(
    hass: HomeAssistant, prefs: Prefs, grosses: list[_Gross]
) -> dict[str, str]:
    """Return solar source meter -> the solar term (of a gross meter) for it.

    A term belongs to the solar source whose power it integrates: the
    source's `stat_rate`, or for a source without one its paired power. A
    term that fits no source or several is not checked; of several terms for
    one source, the first by entity ID is.
    """
    solars = [
        source
        for source in prefs.get(KEY_SOURCES, [])
        if source.get("type") == "solar" and isinstance(source.get(FROM), str)
    ]
    used = used_stats(prefs)
    terms = {term: power for gross in grosses for term, power in gross.terms.items()}
    found: dict[str, str] = {}
    for term, power in sorted(terms.items()):
        sources = [s[FROM] for s in solars if s.get(RATE) == power] or [
            s[FROM]
            for s in solars
            if not s.get(RATE) and paired_power(hass, s[FROM], used - {power}) == power
        ]
        if len(sources) == 1:
            found.setdefault(sources[0], term)
    return found


def _local_iso(timestamp: float) -> str:
    return dt_util.as_local(dt_util.utc_from_timestamp(timestamp)).isoformat()


def _values(rows: Rows, entity_id: str, key: str) -> dict[float, float]:
    """Return start -> `key` of the rows that have it."""
    return {
        row["start"]: value
        for row in rows.get(entity_id, [])
        if (value := row.get(key)) is not None
    }


def _fallen(inputs: list[str], rows: Rows, start: float) -> str | None:
    """Return the input whose counter fell most (at least OFF_KWH) in the hour."""
    falls = [
        (before - after, entity)
        for entity in inputs
        if (
            before := (states := _values(rows, entity, "state")).get(
                start - HOUR_SECONDS
            )
        )
        is not None
        and (after := states.get(start)) is not None
        and before - after >= OFF_KWH
    ]
    return max(falls)[1] if falls else None


def _gross_off(gross: _Gross, rows: Rows) -> dict[str, Any] | None:
    """Return the gross_off hint of the latest hour off its power, or None.

    An hour is off when it and both two-hour windows around it are off the
    same way, so the hours before and after it need statistics too.
    """
    changes = _values(rows, gross.stat, "change")
    # A mean of W over an hour is that many Wh.
    energy = {
        start: mean / 1000
        for start, mean in _values(rows, gross.power or "", "mean").items()
    }

    def off(starts: tuple[float, ...]) -> Direction | None:
        change = sum(changes[start] for start in starts)
        known = [energy[start] for start in starts if start in energy]
        if len(known) < len(starts):
            return Direction.FALL if change < -OFF_KWH else None
        expected = sum(known)
        if abs(change - expected) <= max(OFF_KWH, OFF_SHARE * abs(expected)):
            return None
        return Direction.JUMP if change > expected else Direction.FALL

    found: tuple[float, Direction] | None = None
    for start in sorted(changes):
        before, after = start - HOUR_SECONDS, start + HOUR_SECONDS
        if before not in changes or after not in changes:
            continue
        direction = off((start,))
        if direction is not None and (
            off((before, start)) is direction is off((start, after))
        ):
            found = start, direction
    if found is None:
        return None
    start, direction = found
    data: dict[str, Any] = {
        "direction": direction,
        "hour": _local_iso(start),
        "change_kwh": round(changes[start], 3),
    }
    if start in energy:
        data["power_kwh"] = round(energy[start], 3)
    if (fallen := _fallen(gross.inputs, rows, start)) is not None:
        data["input"] = fallen
    return _hint(HintCode.GROSS_OFF, gross.stat, DeviceKind.ELECTRICITY, data)


def _starts(rows: Rows, entity_id: str) -> list[float]:
    """Return the sorted starts of the rows with a value (state or mean)."""
    return sorted(
        row["start"]
        for row in rows.get(entity_id, [])
        if row.get("state") is not None or row.get("mean") is not None
    )


def _any_in(starts: list[float], begin: float, end: float) -> bool:
    """Return True if one of the sorted `starts` lies in [begin, end)."""
    index = bisect_left(starts, begin)
    return index < len(starts) and starts[index] < end


def _gross_unknown(
    gross: _Gross, rows: Rows, now: float, recorded: list[float]
) -> dict[str, Any] | None:
    """Return the gross_unknown hint of the latest gap, or None.

    A gap is the time without 5-minute rows between two rows, or since the
    last row, longer than GAP_SECONDS; the time before the first row does not
    count (the meter may be new). Home Assistant must have recorded something
    else then (`recorded`: the sorted starts of all rows read), else it was
    off itself.
    """
    if not (starts := _starts(rows, gross.stat)):
        return None
    spans = [(before + SHORT_SECONDS, after) for before, after in pairwise(starts)]
    spans.append((starts[-1] + SHORT_SECONDS, now))
    gaps = [
        (begin, end)
        for begin, end in spans
        if end - begin > GAP_SECONDS and _any_in(recorded, begin, end)
    ]
    if not gaps:
        return None
    begin, end = gaps[-1]
    data: dict[str, Any] = {
        "hour": _local_iso(begin),
        "minutes": int((end - begin) // 60),
    }
    if missing := [
        entity
        for entity in gross.inputs
        if (own := _starts(rows, entity)) and not _any_in(own, begin, end)
    ]:
        data["input"] = missing[0]
    return _hint(HintCode.GROSS_UNKNOWN, gross.stat, DeviceKind.ELECTRICITY, data)


def _last_day() -> tuple[float, float, str]:
    """Return start, end (UTC timestamps) and date of the last full local day."""
    today = dt_util.start_of_local_day()
    day = dt_util.start_of_local_day(today.date() - timedelta(days=1))
    return day.timestamp(), today.timestamp(), day.date().isoformat()


def _term_off(
    term: str, source: str, rows: Rows, day: tuple[float, float, str]
) -> dict[str, Any] | None:
    """Return the hint of a solar term that left its source's day, or None.

    A day is the sum of the hourly `change` (which handles resets). No hint
    when a side has no statistics that day, or the term began during it.
    """
    start, end, date = day

    def changes(entity_id: str) -> dict[float, float]:
        return {
            when: change
            for when, change in _values(rows, entity_id, "change").items()
            if start <= when < end
        }

    own, theirs = changes(term), changes(source)
    if not own or not theirs or min(own) > start:
        return None
    term_kwh, source_kwh = sum(own.values()), sum(theirs.values())
    if abs(term_kwh - source_kwh) <= max(TERM_KWH, TERM_SHARE * abs(source_kwh)):
        return None
    return _hint(
        HintCode.SOLAR_TERM_SHORT
        if term_kwh < source_kwh
        else HintCode.SOLAR_TERM_HIGH,
        source,
        DeviceKind.ELECTRICITY,
        {
            "role": SOLAR_ROLE,
            "entity_id": term,
            "day": date,
            "term_kwh": round(term_kwh, 3),
            "source_kwh": round(source_kwh, 3),
        },
    )


def _add(
    found: dict[str, list[dict[str, Any]]],
    stat: str,
    check: Callable[[], dict[str, Any] | None],
) -> None:
    """Add the hint of one check; a failing check only loses its hint."""
    try:
        hint = check()
    except Exception:
        _LOGGER.debug("A safety-net check of %s failed", stat, exc_info=True)
        return
    if hint is not None:
        found.setdefault(stat, []).append(hint)


async def async_watch(
    hass: HomeAssistant, prefs: Prefs, records: Mapping[str, Mapping[str, Any]]
) -> Watched:
    """Return the safety-net hints of the gross meters of the solar setup.

    `records` are the created helpers' records (entry ID -> record). Two
    queries at once, in the recorder's executor: hourly statistics of the
    last days (gross meters, their powers and inputs, the solar terms and
    their sources) and 5-minute statistics of the last day (gross meters,
    inputs, terms). Nothing is read without a gross meter in the settings;
    nothing here ever raises.
    """
    watched = Watched()
    try:
        grosses = _gross_meters(hass, prefs, records)
        sources = _term_sources(hass, prefs, grosses)
    except Exception:
        _LOGGER.debug("Finding the gross meters failed", exc_info=True)
        return watched
    if not grosses:
        return watched
    stats = {gross.stat for gross in grosses}
    inputs = {entity for gross in grosses for entity in gross.inputs}
    powers = {gross.power for gross in grosses if gross.power is not None}
    terms = {term for gross in grosses for term in gross.terms}
    hourly, short = await asyncio.gather(
        async_statistics(
            hass,
            stats | powers | inputs | set(sources) | set(sources.values()),
            WATCH_DAYS,
            HOURLY,
            HOURLY_TYPES,
        ),
        async_statistics(
            hass, stats | inputs | terms, GAP_DAYS, SHORT_TERM, SHORT_TYPES
        ),
    )
    if hourly is not None:
        for gross in grosses:
            _add(watched.devices, gross.stat, partial(_gross_off, gross, hourly))
        day = _last_day()
        for source, term in sources.items():
            _add(watched.sources, source, partial(_term_off, term, source, hourly, day))
    if short is not None:
        now = dt_util.utcnow().timestamp()
        recorded = sorted(start for entity in short for start in _starts(short, entity))
        for gross in grosses:
            _add(
                watched.devices,
                gross.stat,
                partial(_gross_unknown, gross, short, now, recorded),
            )
    return watched
