"""Find the hints the panel shows at the blocks.

A hint only explains and offers a button; it never changes anything. Hints are
computed here because they need what the panel cannot see: Home Assistant's
entity registry (disabled returned-energy sensors), config entries (the
members of a sum helper) and the recorder (energy counted lately).

- `returned_energy`: an electricity device whose HA device also counts
  returned energy, while a solar source exists that no device meter holds
  (a gross meter, ours or the user's, counts it already). Shelly plugs and
  switches have an enabled returned sensor, every Shelly Pro EM channel a
  disabled one, so the hint needs more than the sensor: an enabled one must
  have counted energy in the last days; for a disabled one the device needs
  children and its circuit's own power must have gone below 0 (it fed in).
- `daily_in_sum`: a meter that is a sensor group sum (ours or the user's) whose
  members mix meters that reset every day with others.
- `power_available`: a device or source without a power (flow) sensor whose HA
  device has one; for electricity the power of the meter's own channel
  (`device_rules.paired_power`), never one used in the settings.

The safety net watches the gross meters the solar setup created (recorded as
`gross_energy` in the created helpers), only by reading their statistics:

- `gross_off`: in the last week, an hour whose change differs from the gross
  power's energy by more than max(0.5 kWh, 30 %), either way (`direction`
  fall or jump), or went below -0.5 kWh; without a gross power only such a
  fall. The gross power counts only while the device still uses it as its
  power sensor: set to none, the meter is watched for falls only. The
  two-hour windows around it must agree, so a meter that only counts late (a
  lag dip made up in the next hour) or catches up after a gap is no step.
  Hours around a downtime of Home Assistant are skipped: the recorder fills
  it with the last power and no energy. `input` names the input whose
  counter fell in that hour, if one did; `cause` the likely cause.
- `gross_unknown`: more than 1 h without a value in the last day's 5-minute
  statistics (From power: of the gross power), not counting Home
  Assistant's downtime. `input` names the input that had no value either,
  `method` the setup's method. A gross meter on the solar's own counter
  pauses at night (only the solar's counter had no value): no hint.
- `solar_term_short` / `solar_term_high`: the solar term (our integral of the
  solar's power) counted less or more than the solar's own energy statistic
  over the last full local day, by more than max(0.5 kWh, 15 %). `power`
  names the solar power the term integrates.

A check that fails, a missing recorder or a missing statistic only means no
hint: hints never break `get`.
"""

from __future__ import annotations

import logging
from bisect import bisect_left
from collections.abc import Callable, Collection, Iterator, Mapping, Sequence
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
from .device_rules import Method, is_returned, paired_power
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
from .stats_probe import (
    FALL_SHARE,
    HOURLY,
    SHORT_TERM,
    Downtime,
    Query,
    Reading,
    ReadingCache,
    StatType,
    async_read,
    sign_evidence,
)
from .sum_meter import SolarHolds

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


class Cause(StrEnum):
    """The likely cause of a gross_off step, for the panel's text."""

    # An input's counter fell: reset or replaced (`input` names it).
    INPUT = "input"
    # A jump without a fallen input, or a fall while the gross power was
    # below 0: a wrong sign (invert), or something feeding in.
    SIGN = "sign"
    # Less than the power, nothing fell: the solar term lost energy.
    SOLAR_TERM = "solar_term"


# Days in which a returned sensor must have counted energy, and how much (kWh;
# the recorder converts the statistics to kWh).
COUNTED_DAYS: Final = 3
COUNTED_KWH: Final = 0.01

# gross_off: hourly statistics of the last week (a reset's offset stays); a
# step is more than max(OFF_KWH, OFF_SHARE of the power's energy) away from it.
WATCH_DAYS: Final = 7
OFF_KWH: Final = 0.5
OFF_SHARE: Final = 0.3
HOURLY_TYPES: Final[frozenset[StatType]] = frozenset({"change", "mean", "state"})
# gross_unknown: 5-minute statistics of the last day; a gap is longer than this.
GAP_DAYS: Final = 1
GAP_SECONDS: Final = 3600.0
SHORT_TYPES: Final[frozenset[StatType]] = frozenset({"state", "mean"})
# The rows of the two queries in a reading.
HOURLY_ROWS: Final = 0
SHORT_ROWS: Final = 1
HOUR_SECONDS: Final = 3600.0
# A shorter downtime (a routine restart) masks no hour: what the recorder
# fills in stays below the threshold up to about 3 kW.
MIN_DOWNTIME: Final = 600.0
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


def _returned_by_device(prefs: Prefs) -> Iterator[tuple[Mapping[str, Any], set[str]]]:
    """Yield (electricity device, used statistics) while solar exists."""
    sources = prefs.get(KEY_SOURCES, [])
    if not any(source.get("type") == "solar" for source in sources):
        return
    used = used_stats(prefs)
    for device in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], []):
        yield device, used


def _circuit_power(
    hass: HomeAssistant, device: Mapping[str, Any], used: Collection[str]
) -> str | None:
    """Return the circuit's own power sensor, or None.

    The device's `stat_rate`, or without one the power of the meter's own
    channel (`paired_power`). Only a sensor has statistics to read.
    """
    power = device.get(RATE) or paired_power(hass, device[STAT], used)
    return power if isinstance(power, str) and valid_entity_id(power) else None


def counted_solars(
    hass: HomeAssistant, prefs: Prefs, holds: SolarHolds, meter: str
) -> set[str]:
    """Return the solar sources (by statistic) the meter `meter` counts.

    A meter counts a solar when what it counts (`SolarHolds.counted`: a meter
    that holds the solar, or a gross meter of ours) reaches the solar's
    statistic, its power (without one, its paired power) or what they are
    made of. A meter that is the solar, or made only of it, counts none.
    """
    if holds.is_solar(meter):
        return set()
    counted = holds.counted(meter)
    used = used_stats(prefs)
    found: set[str] = set()
    for source in _solars(prefs):
        solar = set(holds.sources.get(source[FROM], ()))
        if not source.get(RATE) and (power := paired_power(hass, source[FROM], used)):
            solar.add(power)
        if counted & solar:
            found.add(source[FROM])
    return found


def every_solar_held(
    hass: HomeAssistant,
    prefs: Prefs,
    holds: SolarHolds,
    places: Mapping[str, str] | None = None,
) -> bool:
    """Return True if a device meter of the settings holds each solar source.

    A device's meter holds a solar it counts (`counted_solars`), or one the
    user placed at it (`places`: solar statistic -> meter).
    """
    devices = [d[STAT] for d in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], [])]
    held = {solar for solar, meter in (places or {}).items() if meter in devices}
    for device in devices:
        held |= counted_solars(hass, prefs, holds, device)
    return all(source[FROM] in held for source in _solars(prefs))


@dataclass
class Returned:
    """What the returned-energy hint read from the recorder."""

    # The enabled returned sensors that counted energy lately.
    counted: set[str] = field(default_factory=set)
    # The device meters whose circuit's power went below 0 lately: it fed in.
    fed_in: set[str] = field(default_factory=set)


async def async_returned(
    hass: HomeAssistant,
    prefs: Prefs,
    holds: SolarHolds | None = None,
    places: Mapping[str, str] | None = None,
) -> Returned:
    """Return what the circuits that can get the returned-energy hint did lately.

    Read only while a solar source exists that no device meter holds
    (`every_solar_held`; `holds` judges the meters, None: from the settings
    alone, without our helpers; `places` are the user's solar places), all
    in one query of the hourly statistics of the last COUNTED_DAYS: the
    `change` of the enabled returned sensors of electricity devices that are
    not used in the settings, and the `min`
    of the own power (`_circuit_power`) of each device with children and a
    disabled returned sensor. A failing recorder gives nothing.
    """
    parents = {
        device.get(PARENT)
        for device in prefs.get(DEVICE_KEYS[DeviceKind.ELECTRICITY], [])
    }
    enabled: set[str] = set()
    powers: dict[str, str] = {}
    for device, used in _returned_by_device(prefs):
        stat = device[STAT]
        found = returned_sensors(hass, stat, exclude=used)
        enabled |= {entity_id for entity_id, disabled in found if not disabled}
        if (
            stat in parents
            and any(disabled for _, disabled in found)
            and (power := _circuit_power(hass, device, used)) is not None
        ):
            powers[stat] = power
    if not enabled and not powers:
        return Returned()
    if every_solar_held(
        hass, prefs, SolarHolds(hass, prefs) if holds is None else holds, places
    ):
        return Returned()
    types = ({"change"} if enabled else set()) | ({"min"} if powers else set())
    rows = (
        await async_hourly_statistics(
            hass, enabled | set(powers.values()), COUNTED_DAYS, types
        )
        or {}
    )
    return Returned(
        {
            entity_id
            for entity_id in enabled
            if sum(row.get("change") or 0 for row in rows.get(entity_id, []))
            >= COUNTED_KWH
        },
        {
            stat
            for stat, power in powers.items()
            if sign_evidence(
                (dt_util.utc_from_timestamp(row["start"]), low)
                for row in rows.get(power, [])
                if (low := row.get("min")) is not None
            )
        },
    )


def _returned_hints(
    hass: HomeAssistant, prefs: Prefs, returned: Returned
) -> dict[str, dict[str, Any]]:
    """Return the returned-energy hint of each electricity device, by stat.

    A device gets it when any of its returned sensors qualifies: enabled and
    in `returned.counted`, or disabled and the device in `returned.fed_in`
    (it has children and its power went below 0). `data` names the first one
    that does.
    """
    hints: dict[str, dict[str, Any]] = {}
    for device, used in _returned_by_device(prefs):
        stat = device[STAT]
        for entity_id, disabled in returned_sensors(hass, stat, exclude=used):
            if (
                (stat in returned.fed_in)
                if disabled
                else (entity_id in returned.counted)
            ):
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
    from the recorder for the hints, together with `daily`. Without it what
    the returned-energy hint needs is read here (`async_returned`, without
    our helpers), and there are no safety-net hints. Hint dicts are
    `{code, stat, kind, data}`; dismissals are left to the panel.
    """
    if readings is None:
        readings = Readings(await async_returned(hass, prefs))
    watched = readings.watched
    returned = _returned_hints(hass, prefs, readings.returned)
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

    # The result of `async_returned`.
    returned: Returned
    # The result of `async_watch`.
    watched: Watched = field(default_factory=Watched)


@dataclass
class _Gross:
    """A gross meter of the solar setup that is a device in the settings."""

    stat: str
    # The setup's method (`em`, `plug`, `net`, `power`), as recorded.
    method: str | None
    # Our gross power, if the gross meter has one.
    power: str | None
    # The user's sensors it reads (From power: through the gross power).
    inputs: list[str]
    # Our solar terms it reads -> the solar power each one integrates.
    terms: dict[str, str]
    # The gross power its energy is compared with: ours, while the device
    # still uses it as its power sensor; None compares like a meter
    # without a power (falls only).
    compare: str | None = None

    @property
    def gaps_of(self) -> str:
        """Return the statistic whose 5-minute rows show the meter unknown.

        From power: the gross power. Its integral keeps writing rows while
        the power is unknown; it only stops counting.
        """
        if self.method == Method.POWER and self.power is not None:
            return self.power
        return self.stat


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
                gross.get("method"),
                power,
                [entity for entity, found in ours.items() if not found],
                {
                    entity: found["power"]
                    for entity, found in ours.items()
                    if found.get("kind") == KIND_SOLAR_ENERGY
                    and isinstance(found.get("power"), str)
                },
                power if device.get(RATE) == power else None,
            )
        )
    return grosses


def _solars(prefs: Prefs) -> list[Mapping[str, Any]]:
    return [
        source
        for source in prefs.get(KEY_SOURCES, [])
        if source.get("type") == "solar" and isinstance(source.get(FROM), str)
    ]


def _solar_sensors(hass: HomeAssistant, prefs: Prefs) -> tuple[set[str], set[str]]:
    """Return the solar sources' energy meters, and those with their powers.

    A solar without a power in the settings counts its paired power.
    """
    used = used_stats(prefs)
    solars = _solars(prefs)
    meters = {source[FROM] for source in solars}
    powers = {
        source.get(RATE) or paired_power(hass, source[FROM], used) for source in solars
    }
    return meters, meters | {power for power in powers if isinstance(power, str)}


def _term_sources(
    hass: HomeAssistant, prefs: Prefs, grosses: list[_Gross]
) -> dict[str, str]:
    """Return solar source meter -> the solar term (of a gross meter) for it.

    A term belongs to the solar source whose power it integrates: the
    source's `stat_rate`, or for a source without one its paired power. A
    term that fits no source or several is not checked; of several terms for
    one source, the first by entity ID is.
    """
    solars = _solars(prefs)
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


def _overlap(downtimes: Sequence[Downtime], begin: float, end: float) -> float:
    """Return the seconds of [begin, end) Home Assistant was off."""
    return sum(
        max(0.0, min(end, stop) - max(begin, start)) for start, stop in downtimes
    )


def _fallen(inputs: list[str], rows: Rows, start: float) -> str | None:
    """Return the input whose counter was reset in the hour, the largest fall.

    Reset-shaped only: it fell by at least OFF_KWH and landed less than
    FALL_SHARE as far from 0 as before (the rule of `stats_probe`). A signed
    Net meter that falls through export (97 -> 94) is no reset.
    """
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
        and abs(after) < FALL_SHARE * abs(before)
    ]
    return max(falls)[1] if falls else None


def _term_short(
    gross: _Gross, rows: Rows, start: float, term_sources: Mapping[str, str]
) -> bool:
    """Return True if a solar term counted clearly less than its solar that hour."""
    return any(
        (theirs := _values(rows, source, "change").get(start)) is not None
        and (own := _values(rows, term, "change").get(start)) is not None
        and theirs - own > max(OFF_KWH, OFF_SHARE * abs(theirs))
        for term in gross.terms
        if (source := term_sources.get(term)) is not None
    )


def _cause(gross: _Gross, data: Mapping[str, Any], *, term_short: bool) -> Cause | None:
    """Return the likely cause of a gross_off step, if one can be told.

    A fallen input first, then a solar term that counted less than its
    solar in that hour. Otherwise a jump, a gross power below 0, or (EM,
    Plug, Net) a meter that did not go below 0 is a wrong sign. A solar term
    that counted less only explains a fall, and From power's integral that
    counted more than its power is no wrong sign.
    """
    fall = data["direction"] is Direction.FALL
    if "input" in data:
        return Cause.INPUT
    if term_short and fall:
        return Cause.SOLAR_TERM
    if (
        (not fall and gross.method != Method.POWER)
        or data.get("power_kwh", 0.0) < 0
        or (gross.method != Method.POWER and data["change_kwh"] >= 0)
    ):
        return Cause.SIGN
    return None


def _gross_off(
    gross: _Gross, reading: Reading, term_sources: Mapping[str, str]
) -> dict[str, Any] | None:
    """Return the gross_off hint of the latest step, or None.

    An hour is a step when both two-hour windows around it are off the same
    way, judged by the hour's own threshold, and the hour itself is off that
    way too or (a fall) went below 0. So its neighbours need statistics, and
    none of the three hours may overlap a downtime: the recorder fills a
    downtime with the last power and no energy, and EM catches up after it.
    A window that fell below -OFF_KWH is a fall in every method, also when
    the gross power agrees: a gross consumption meter never falls (a wrong
    invert, a battery feeding in). Without the gross power only a fall
    counts, one the next hour does not make up (the hour before gives the
    usual consumption). Next to a downtime of MIN_DOWNTIME or longer only
    an input whose counter fell counts, with the hour below -OFF_KWH: the
    recorder's fill is flat and never makes a counter fall (a plug that
    starts again at 0 after the power cut that took HA down too).
    `term_sources` maps solar terms to their solar's meter, for the cause.
    """
    rows = reading.rows[HOURLY_ROWS]
    masks = [
        (begin, end)
        for begin, end in reading.downtimes or ()
        if end - begin >= MIN_DOWNTIME
    ]
    changes = _values(rows, gross.stat, "change")
    # A mean of W over an hour is that many Wh.
    energy = {
        start: mean / 1000
        for start, mean in _values(rows, gross.compare or "", "mean").items()
    }

    def window(starts: tuple[float, ...], limit: float) -> Direction | None:
        change = sum(changes[start] for start in starts)
        if change < -OFF_KWH:
            return Direction.FALL
        expected = sum(energy[start] for start in starts)
        if abs(change - expected) <= limit:
            return None
        return Direction.JUMP if change > expected else Direction.FALL

    def step(start: float) -> Direction | None:
        before, after = start - HOUR_SECONDS, start + HOUR_SECONDS
        hours = (before, start, after)
        if _overlap(masks, before, after + HOUR_SECONDS):
            fell = (
                changes[start] < -OFF_KWH
                and _fallen(gross.inputs, rows, start) is not None
            )
            return Direction.FALL if fell else None
        if any(hour not in changes for hour in hours):
            return None
        if any(hour not in energy for hour in hours):
            usual = max(changes[before], 0.0)
            fell = (
                changes[start] < -OFF_KWH
                and changes[start] + changes[after] < 2 * usual - OFF_KWH
            )
            return Direction.FALL if fell else None
        limit = max(OFF_KWH, OFF_SHARE * abs(energy[start]))
        first = window((before, start), limit)
        if first is None or window((start, after), limit) is not first:
            return None
        own = window((start,), limit)
        went_below = first is Direction.FALL and changes[start] < 0
        return first if own is first or went_below else None

    found: tuple[float, Direction] | None = None
    for start in sorted(changes):
        if (direction := step(start)) is not None:
            found = start, direction
    if found is None:
        return None
    start, direction = found
    data: dict[str, Any] = {
        "direction": direction,
        "hour": _local_iso(start),
        "method": gross.method,
        "change_kwh": round(changes[start], 3),
    }
    if start in energy:
        data["power_kwh"] = round(energy[start], 3)
    if (fallen := _fallen(gross.inputs, rows, start)) is not None:
        data["input"] = fallen
    if (
        cause := _cause(
            gross, data, term_short=_term_short(gross, rows, start, term_sources)
        )
    ) is not None:
        data["cause"] = cause
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
    gross: _Gross, reading: Reading, solar: tuple[set[str], set[str]]
) -> dict[str, Any] | None:
    """Return the gross_unknown hint of the latest gap, or None.

    A gap is the time without 5-minute rows of `gross.gaps_of` between two
    rows, or since the last row, without Home Assistant's downtime (also the
    minutes after a start before the missing statistics are compiled),
    longer than GAP_SECONDS. The time before the first row does not count
    (the meter may be new). A gap where only the solar's own energy counters
    had no value is the documented night pause of a gross meter on the
    solar's counter. `solar` are the solar meters and those with their
    powers: a missing input that is none of them is named first.
    """
    rows = reading.rows[SHORT_ROWS]
    meters, sensors = solar
    if not (starts := _starts(rows, gross.gaps_of)):
        return None
    spans = [(before + SHORT_SECONDS, after) for before, after in pairwise(starts)]
    spans.append((starts[-1] + SHORT_SECONDS, reading.read_at))
    found: tuple[float, float, list[str]] | None = None
    for begin, end in spans:
        unknown = end - begin - _overlap(reading.downtimes or (), begin, end)
        if unknown <= GAP_SECONDS:
            continue
        missing = sorted(
            (
                entity
                for entity in gross.inputs
                if (own := _starts(rows, entity)) and not _any_in(own, begin, end)
            ),
            key=lambda entity: (entity in sensors, entity),
        )
        if missing and all(entity in meters for entity in missing):
            continue
        found = begin, unknown, missing
    if found is None:
        return None
    begin, unknown, missing = found
    data: dict[str, Any] = {
        "hour": _local_iso(begin),
        "minutes": int(unknown // 60),
        "method": gross.method,
    }
    if missing:
        data["input"] = missing[0]
    return _hint(HintCode.GROSS_UNKNOWN, gross.stat, DeviceKind.ELECTRICITY, data)


def _last_day() -> tuple[float, float, str]:
    """Return start, end (UTC timestamps) and date of the last full local day."""
    today = dt_util.start_of_local_day()
    day = dt_util.start_of_local_day(today.date() - timedelta(days=1))
    return day.timestamp(), today.timestamp(), day.date().isoformat()


def _term_off(
    term: str, source: str, power: str | None, reading: Reading
) -> dict[str, Any] | None:
    """Return the hint of a solar term that left its source's day, or None.

    `power` is the solar power the term integrates; the hint names it.

    A day is the sum of the hourly `change` (which handles resets) of the
    rows that start in it. No hint when a side has no statistics that day, or
    the term has no row in its first hour: it began during the day. (In a
    time zone with a half-hour offset the first row starts at :30.)
    """
    rows = reading.rows[HOURLY_ROWS]
    start, end, date = _last_day()

    def changes(entity_id: str) -> dict[float, float]:
        return {
            when: change
            for when, change in _values(rows, entity_id, "change").items()
            if start <= when < end
        }

    own, theirs = changes(term), changes(source)
    if not own or not theirs or min(own) >= start + HOUR_SECONDS:
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
            "power": power,
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
    hass: HomeAssistant,
    prefs: Prefs,
    records: Mapping[str, Mapping[str, Any]],
    cache: ReadingCache | None = None,
) -> Watched:
    """Return the safety-net hints of the gross meters of the solar setup.

    `records` are the created helpers' records (entry ID -> record). One
    executor job reads the hourly statistics of the last WATCH_DAYS (gross
    meters, their powers and inputs, the solar terms and their sources), the
    5-minute statistics of the last day (gross meters, the gross powers of
    From power, inputs, terms) and Home Assistant's downtimes; a reading of
    the same statistics younger than 5 minutes comes from `cache`. Nothing
    is read without a gross meter in the settings; nothing here raises.
    """
    watched = Watched()
    try:
        grosses = _gross_meters(hass, prefs, records)
        sources = _term_sources(hass, prefs, grosses)
        solar = _solar_sensors(hass, prefs)
    except Exception:
        _LOGGER.debug("Finding the gross meters failed", exc_info=True)
        return watched
    if not grosses:
        return watched
    stats = {gross.stat for gross in grosses}
    inputs = {entity for gross in grosses for entity in gross.inputs}
    powers = {gross.compare for gross in grosses if gross.compare is not None}
    gaps = {gross.gaps_of for gross in grosses}
    terms = {term for gross in grosses for term in gross.terms}
    queries = (
        Query(
            frozenset(stats | powers | inputs | terms | set(sources)),
            WATCH_DAYS,
            HOURLY,
            HOURLY_TYPES,
        ),
        Query(
            frozenset(stats | gaps | inputs | terms),
            GAP_DAYS,
            SHORT_TERM,
            SHORT_TYPES,
        ),
    )
    if (reading := await async_read(hass, queries, cache)) is None:
        return watched
    if reading.downtimes is not None:
        # Unknown downtimes: their flat fills would look like falls and gaps.
        term_sources = {term: source for source, term in sources.items()}
        for gross in grosses:
            _add(
                watched.devices,
                gross.stat,
                partial(_gross_off, gross, reading, term_sources),
            )
            _add(
                watched.devices,
                gross.stat,
                partial(_gross_unknown, gross, reading, solar),
            )
    term_powers = {
        term: power for gross in grosses for term, power in gross.terms.items()
    }
    for source, term in sources.items():
        _add(
            watched.sources,
            source,
            partial(_term_off, term, source, term_powers.get(term), reading),
        )
    return watched
