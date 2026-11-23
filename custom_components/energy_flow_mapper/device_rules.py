"""Known-device rules for gross meters: methods, sensor families and pairs.

A circuit meter with solar behind it needs a gross meter. Which formula fits
depends on what the meter counts, which only the device tells:

- **Methods** (`classify_meter`): a known device rule, by the Shelly unique ID
  `{mac}-{component}[-{description}]` (checked in HA 2026.10 and 2026.11):
  - `em`/`em1`/`emdata`/`em1data` are EM meters (import and export apart; the
    totals are perpetual counters kept in flash);
  - a `switch` "Energy" counts both directions: Plug, and its "Energy
    consumed" is import only: EM. Both only with a returned sensor of the same
    switch, because that sensor exists from firmware 1.1.0, the release that
    keeps the counters through a power cut;
  - `pm1` (persistence unverified), Gen1 devices (they reset on a power cut)
    and everything else get no rule; "From power" is suggested instead.
  - Net only when the statistics went below 0; the state class alone says
    nothing.
- **Family** (`family`): the meter's device, its parent and its children, by
  `via_device_id` and `parent_device_id`, disabled entities included (they
  only exist in the entity registry).
- **Returned candidates** and **power pairing** use a channel key per known
  integration (Shelly component and phase, IoTaWatt input, OpenDTU/AhoyDTU
  channel, Emporia device, Zigbee2MQTT suffix, Envoy key family). Without a
  key only a single unused power sensor in the family is a pair.
- **Sign** (`default_inverted`): powers known to be positive on export.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Collection, Hashable
from dataclasses import dataclass
from enum import StrEnum
from typing import Final

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.const import ATTR_DEVICE_CLASS
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .stats_probe import StatsEvidence


class Method(StrEnum):
    """The ways to build a gross meter."""

    EM = "em"
    PLUG = "plug"
    NET = "net"
    POWER = "power"


# Translation keys of the rules (the panel names the matched device).
RULE_SHELLY_EM: Final = "rule_shelly_em"
RULE_SHELLY_PLUG: Final = "rule_shelly_plug"
RULE_SHELLY_CONSUMED: Final = "rule_shelly_consumed"
RULE_NET_NEGATIVE: Final = "rule_net_negative"


@dataclass
class MeterClass:
    """The method a meter's device suggests, and the rule that matched."""

    method: Method | None
    rule: str | None


SHELLY: Final = "shelly"
IOTAWATT: Final = "iotawatt"
MQTT: Final = "mqtt"
EMPORIA: Final = "emporia_vue"
ENVOY: Final = "enphase_envoy"
HUAWEI: Final = "huawei_solar"

# Shelly RPC components of energy meters (perpetual counters).
SHELLY_EM_COMPONENTS: Final = frozenset({"em", "em1", "emdata", "em1data"})
SHELLY_SWITCH: Final = "switch"
# Description of a switch's "Energy": `aenergy`, both directions.
SHELLY_PLUG_ENERGY: Final = "energy"
# Prefix of "Energy consumed" (`consumed_energy_switch`): aenergy - ret_aenergy.
SHELLY_CONSUMED_PREFIX: Final = "consumed_energy"
# A phase of a Pro 3EM (triphase): `a_total_act_energy`, `a_act_power` ...
SHELLY_PHASE: Final = re.compile(r"^([abc])_")

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

# IoTaWatt inputs: `{mac}-input-{channel}-Watts` / `-WattHours`.
IOTAWATT_INPUT: Final = re.compile(r"^(.+-input-[^-]+)-(?:Watts|WattHours)$")
# OpenDTU and AhoyDTU: `{serial}_ch{N}_{Field}` (ch0 is AC).
DTU_CHANNEL: Final = re.compile(r"^([0-9A-Fa-f]+_ch(\d+))_(.+)$")
DTU_AC: Final = "0"
# The ch0 fields that form the AC channel: its power (OpenDTU `Power`, AhoyDTU
# `P_AC`) and its yields. Any other ch0 field (`PowerDC`, `P_DC`, `MaxPower`
# ...) gets a key of its own, so it never pairs with the AC yield.
DTU_AC_FIELDS: Final = frozenset({"Power", "P_AC", "YieldTotal", "YieldDay"})
# Zigbee2MQTT: `{ieee}_{property}_zigbee2mqtt`; channels end in `_a`, `_l1` ...
Z2M_SUFFIX: Final = "_zigbee2mqtt"
Z2M_CHANNEL: Final = re.compile(r"_(a|b|c|l1|l2|l3)$")
# Envoy: `{serial}_{key}[_l{phase}]`, the inverter power is the bare serial.
ENVOY_PHASE: Final = re.compile(r"^(.+)_(l[123])$")
ENVOY_CT: Final = re.compile(r"^(.+)_ct_energy_(?:delivered|received)$")
ENVOY_INVERTER: Final = "inverter"
ENVOY_POWER_OF: Final = {
    "lifetime_production": "production",
    "daily_production": "production",
    "seven_days_production": "production",
    "lifetime_consumption": "consumption",
    "daily_consumption": "consumption",
    "seven_days_consumption": "consumption",
    "lifetime_balanced_net_consumption": "balanced_net_consumption",
    "lifetime_net_consumption": "net_consumption",
    "lifetime_net_production": "net_consumption",
    "lifetime_battery_discharged": "battery_discharge",
    "lifetime_battery_charged": "battery_discharge",
    "lifetime_energy": ENVOY_INVERTER,
    "energy_today": ENVOY_INVERTER,
    "energy_produced": ENVOY_INVERTER,
}
# Huawei Solar's power meter: positive on export.
HUAWEI_EXPORT_POSITIVE: Final = "_power_meter_active_power"


@dataclass(frozen=True)
class _ShellyId:
    """The parts of a Shelly unique ID."""

    prefix: str
    component: str
    description: str | None
    rpc: bool

    @property
    def kind(self) -> str:
        """Return the component type (`switch` of `switch:0`)."""
        return self.component.split(":", 1)[0]

    def channel(self) -> tuple[str, str, str | None]:
        """Return the channel: `em1data:N` is `em1:N`, `emdata:0` is `em:0`."""
        component = self.component.replace("em1data", "em1").replace("emdata", "em")
        phase = SHELLY_PHASE.match(self.description or "")
        return self.prefix, component, phase.group(1) if phase else None


def _shelly_id(unique_id: str) -> _ShellyId | None:
    """Parse `{mac}-{component}[-{description}]`; Gen1: `{mac}-{block}-{attr}`."""
    parts = unique_id.split("-")
    for index, part in enumerate(parts[1:], 1):
        if ":" in part:
            return _ShellyId(
                "-".join(parts[:index]),
                part,
                "-".join(parts[index + 1 :]) or None,
                rpc=True,
            )
    if len(parts) < 3:
        return None
    return _ShellyId("-".join(parts[:-2]), parts[-2], parts[-1], rpc=False)


def _envoy_channel(unique_id: str) -> tuple[str, str, str | None]:
    """Return (serial, power key, phase) of an Envoy sensor."""
    serial, _, key = unique_id.partition("_")
    if not key:
        return serial, ENVOY_INVERTER, None
    phase = None
    if match := ENVOY_PHASE.match(key):
        key, phase = match.group(1), match.group(2)
    if match := ENVOY_CT.match(key):
        key = f"{match.group(1)}_ct_power"
    return serial, ENVOY_POWER_OF.get(key, key), phase


def _shelly_channel(entry: er.RegistryEntry) -> Hashable | None:
    shelly = _shelly_id(entry.unique_id)
    return shelly.channel() if shelly is not None else None


def _iotawatt_channel(entry: er.RegistryEntry) -> Hashable | None:
    match = IOTAWATT_INPUT.match(entry.unique_id)
    return match.group(1) if match else None


def _emporia_channel(entry: er.RegistryEntry) -> Hashable | None:
    # One device per channel.
    return entry.device_id


def _envoy_entry_channel(entry: er.RegistryEntry) -> Hashable | None:
    return _envoy_channel(entry.unique_id)


def _mqtt_channel(entry: er.RegistryEntry) -> Hashable | None:
    unique_id = entry.unique_id
    if unique_id.endswith(Z2M_SUFFIX):
        ieee, _, prop = unique_id.removesuffix(Z2M_SUFFIX).partition("_")
        suffix = Z2M_CHANNEL.search(prop)
        return ieee, suffix.group(1) if suffix else None
    if (match := DTU_CHANNEL.match(unique_id)) is None:
        return None
    channel, number, field = match.groups()
    if number == DTU_AC and field not in DTU_AC_FIELDS:
        return channel, field
    return channel


CHANNEL_RULES: Final[dict[str, Callable[[er.RegistryEntry], Hashable | None]]] = {
    SHELLY: _shelly_channel,
    IOTAWATT: _iotawatt_channel,
    EMPORIA: _emporia_channel,
    ENVOY: _envoy_entry_channel,
    MQTT: _mqtt_channel,
}


def _channel(entry: er.RegistryEntry) -> Hashable | None:
    """Return the channel key of a known integration, or None.

    Two sensors with the same key measure the same channel: their energy and
    power pair, and a returned sensor of that channel ranks first.
    """
    rule = CHANNEL_RULES.get(entry.platform)
    return rule(entry) if rule is not None else None


def _device_class(hass: HomeAssistant, entry: er.RegistryEntry) -> str | None:
    """Return the device class (state first; a disabled entity has none)."""
    state = hass.states.get(entry.entity_id)
    if state is not None and ATTR_DEVICE_CLASS in state.attributes:
        return str(state.attributes[ATTR_DEVICE_CLASS])
    return entry.device_class or entry.original_device_class


def is_returned(entry: er.RegistryEntry) -> bool:
    """Return True for a registry entry of a returned energy sensor."""
    if entry.translation_key in RETURNED_TRANSLATION_KEYS:
        return True
    if entry.platform == SHELLY:
        # The channel name is in every sensor's name ("PV export energy").
        return entry.unique_id.rsplit("-", 1)[-1] in SHELLY_RETURNED_KEYS
    name = (entry.name or entry.original_name or "").casefold()
    return any(word in name for word in RETURNED_NAME_WORDS)


def _related_devices(hass: HomeAssistant, device_id: str) -> set[str]:
    """Return the device, its parent and its children."""
    devices = dr.async_get(hass)
    found = {device_id}
    device = devices.async_get(device_id)
    if isinstance(device, dr.DeviceEntry) and device.via_device_id:
        found.add(device.via_device_id)
    if isinstance(device, dr.ChildDeviceEntry):
        found.add(device.parent_device_id)
    found.update(
        other.id for other in devices.devices if other.via_device_id == device_id
    )
    found.update(
        child.id for child in dr.async_entries_for_parent_device(devices, device_id)
    )
    return found


def family(hass: HomeAssistant, entity_id: str) -> list[er.RegistryEntry]:
    """Return the registry entries of an entity's device, parent and children.

    Disabled entities are included. An entity without device is alone; an
    entity that is not in the registry has no family. Sorted by entity ID.
    """
    registry = er.async_get(hass)
    entry = registry.async_get(entity_id)
    if entry is None:
        return []
    if entry.device_id is None:
        return [entry]
    found = [
        other
        for device_id in _related_devices(hass, entry.device_id)
        for other in er.async_entries_for_device(
            registry, device_id, include_disabled_entities=True
        )
    ]
    return sorted(found, key=lambda other: other.entity_id)


def _energy_sensors(
    hass: HomeAssistant, entries: Collection[er.RegistryEntry]
) -> list[er.RegistryEntry]:
    return [
        entry
        for entry in entries
        if entry.domain == "sensor"
        and _device_class(hass, entry) == SensorDeviceClass.ENERGY
    ]


def _returned(
    hass: HomeAssistant, meter: str, exclude: Collection[str]
) -> tuple[Hashable | None, list[er.RegistryEntry]]:
    """Return the meter's channel key and its ranked returned sensors."""
    members = family(hass, meter)
    own = next((entry for entry in members if entry.entity_id == meter), None)
    channel = _channel(own) if own is not None else None
    found = [
        entry
        for entry in _energy_sensors(hass, members)
        if entry.entity_id != meter
        and entry.entity_id not in exclude
        and is_returned(entry)
    ]

    def rank(entry: er.RegistryEntry) -> tuple[bool, bool, str]:
        other = channel is None or _channel(entry) != channel
        return other, entry.disabled, entry.entity_id

    return channel, sorted(found, key=rank)


def returned_candidates(
    hass: HomeAssistant, meter: str, exclude: Collection[str]
) -> list[tuple[str, bool]]:
    """Return (entity ID, disabled) of the returned sensors in a meter's family.

    Ranked: the meter's own channel (Shelly component index and phase) first,
    then enabled before disabled, then by entity ID. Sensors in `exclude`
    (used in the settings or the draft) are left out.
    """
    _, found = _returned(hass, meter, exclude)
    return [(entry.entity_id, entry.disabled) for entry in found]


def preselect_returned(
    hass: HomeAssistant, energy_entity_id: str, used: Collection[str]
) -> str | None:
    """Return the returned sensor to preselect for a meter, or None.

    The first of `returned_candidates`, only when it is trusted: a meter with
    a channel key needs a candidate of its own channel (a Pro 3EM phase never
    gets the total's returned sensor); a meter without one needs a sole
    candidate. Once the meter's own device has a returned sensor (used or
    not), only the own device counts: a used own sensor never hands over to a
    parent's (a hub's or the grid export).
    """
    channel, found = _returned(hass, energy_entity_id, ())
    if channel is None:
        meter = er.async_get(hass).async_get(energy_entity_id)
        device_id = meter.device_id if meter is not None else None
        found = [e for e in found if e.device_id == device_id] or found
    found = [entry for entry in found if entry.entity_id not in used]
    if channel is not None:
        if found and _channel(found[0]) == channel:
            return found[0].entity_id
        return None
    return found[0].entity_id if len(found) == 1 else None


def _has_returned(hass: HomeAssistant, meter: er.RegistryEntry) -> bool:
    """Return True if the meter's own channel has a returned sensor."""
    channel = _channel(meter)
    return any(
        entry.platform == SHELLY and is_returned(entry) and _channel(entry) == channel
        for entry in family(hass, meter.entity_id)
        if entry.entity_id != meter.entity_id
    )


def _shelly_rule(hass: HomeAssistant, entry: er.RegistryEntry) -> MeterClass | None:
    """Return the rule of a Shelly meter whose counters persist, or None."""
    shelly = _shelly_id(entry.unique_id)
    if shelly is None or not shelly.rpc or is_returned(entry):
        return None
    if shelly.kind in SHELLY_EM_COMPONENTS:
        return MeterClass(Method.EM, RULE_SHELLY_EM)
    if shelly.kind != SHELLY_SWITCH or not _has_returned(hass, entry):
        return None
    if shelly.description == SHELLY_PLUG_ENERGY:
        return MeterClass(Method.PLUG, RULE_SHELLY_PLUG)
    if (shelly.description or "").startswith(SHELLY_CONSUMED_PREFIX):
        return MeterClass(Method.EM, RULE_SHELLY_CONSUMED)
    return None


def classify_meter(
    hass: HomeAssistant, meter: str, stats: StatsEvidence | None
) -> MeterClass:
    """Return the method a meter's device suggests (None: no known rule)."""
    entry = er.async_get(hass).async_get(meter)
    if (
        entry is not None
        and entry.platform == SHELLY
        and (rule := _shelly_rule(hass, entry)) is not None
    ):
        return rule
    if stats is not None and stats.went_negative:
        return MeterClass(Method.NET, RULE_NET_NEGATIVE)
    return MeterClass(None, None)


def paired_power(hass: HomeAssistant, energy: str, used: Collection[str]) -> str | None:
    """Return the power sensor of an energy sensor's channel, or None.

    A known integration pairs by its channel key. Otherwise, once the meter's
    own device has a power sensor (used or disabled too), only the own device
    counts; the family only when it has none. Exactly one unused, enabled
    sensor must remain: used and disabled sensors (a disabled one has no
    state) are never suggested.
    """
    members = family(hass, energy)
    own = next((entry for entry in members if entry.entity_id == energy), None)
    if own is None:
        return None
    powers = [
        entry
        for entry in members
        if entry.entity_id != energy
        and entry.domain == "sensor"
        and _device_class(hass, entry) == SensorDeviceClass.POWER
    ]
    if (channel := _channel(own)) is not None:
        powers = [entry for entry in powers if _channel(entry) == channel]
    else:
        powers = [e for e in powers if e.device_id == own.device_id] or powers
    free = [
        entry for entry in powers if entry.entity_id not in used and not entry.disabled
    ]
    return free[0].entity_id if len(free) == 1 else None


def default_inverted(hass: HomeAssistant, power: str) -> bool:
    """Return True for a power known to be positive on export (Huawei meter)."""
    entry = er.async_get(hass).async_get(power)
    return (
        entry is not None
        and entry.platform == HUAWEI
        and entry.unique_id.endswith(HUAWEI_EXPORT_POSITIVE)
    )
