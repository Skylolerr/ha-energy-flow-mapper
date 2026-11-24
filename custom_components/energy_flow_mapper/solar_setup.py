"""The guided setup "Solar feeds into this circuit".

A circuit meter with a solar plugged in behind it sees only what the circuit
draws from the house: the solar's own production is used up before it reaches
the meter. The gross meter adds it back. It is built by one of a few methods
(`device_rules.Method`), each correct only for a known kind of meter:

- **EM** (a meter with import and export apart, Shelly Pro EM):
  gross = drawn - returned + solar,
- **Plug** (a Shelly plug's "Energy", which counts both directions):
  gross = Energy - 2 x returned + solar,
- **Net** (a meter that goes down while the circuit feeds in):
  gross = meter + solar,
- **From power**: the integral of (circuit power + solar power), correct for
  every device whose circuit power has a sign.

A method matches the device (`classify_meter`) or the statistics (a power or
net meter that went below 0), else it is "not verified" and only built on the
user's conscious choice. A method whose inputs cannot work (a daily counter,
no returned sensor, no power sensor) is not offered at all.

**Solar term** (EM, Plug, Net): an integral of a small template of the solar's
power in W, where an offline inverter (not a number) is 0; so the term stays
available all night. One pair per solar power sensor, reused by every setup.
Without a power sensor the solar's counter is read as it is, but only when its
statistics show it certainly never resets; else the setup stops.

**Templates** convert every input to kWh or W at render time, with Home
Assistant's own factors, and are `none` (unknown) while a needed input has no
number or an unknown unit. The energy template is `total`: Home Assistant
books every change 1:1, so a lag dip cancels. A constant offset lifts it to
100 kWh or more at the start; the preview computes it from the values the
template will read (a new solar integral reads 0), and create checks that the
previewed offset is still enough.

Nothing the panel sends is trusted: create plans again and refuses a method,
sensor or power the preview would not offer, and an offset that is no longer
enough. The setup never writes the energy settings: it creates helpers and
returns them; the panel puts them into the draft.
"""

from __future__ import annotations

import asyncio
import logging
import math
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from itertools import pairwise
from typing import Any, Final, Literal

from homeassistant.components.sensor import (
    ATTR_STATE_CLASS,
    SensorDeviceClass,
    SensorStateClass,
)
from homeassistant.const import (
    ATTR_DEVICE_CLASS,
    ATTR_FRIENDLY_NAME,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.util.unit_conversion import (
    BaseUnitConverter,
    EnergyConverter,
    PowerConverter,
)

from .candidates import (
    ENERGY_UNITS,
    POWER_UNITS,
    RATE_UNITS,
    async_is_rate_sensor,
)
from .const import DOMAIN
from .created_helpers import CreatedHelpers
from .device_rules import (
    MeterClass,
    Method,
    classify_meter,
    default_inverted,
    drawn_candidates,
    paired_power,
    preselect_returned,
    returned_candidates,
)
from .hierarchy import (
    KEY_DEVICES,
    KEY_SOURCES,
    NAME,
    RATE,
    STAT,
    DeviceKind,
    Prefs,
    used_stats,
)
from .integral import INTEGRAL_OPTIONS, async_create_integral, entity_unit
from .meter_inputs import Cache, meter_inputs
from .stats_probe import StatsEvidence, async_probe
from .template_meter import SENSOR_OPTIONS, TemplateKind, async_create_template

_LOGGER = logging.getLogger(__name__)

ENERGY_DECIMALS: Final = 3
POWER_DECIMALS: Final = 1
SOLAR_STAT: Final = "stat_energy_from"
# The lowest starting value (kWh) of a gross meter; a lower one gets an offset.
# Home Assistant's energy settings warn about a meter below 0.
START_MIN: Final = 100.0
# The offset is a whole number of these (kWh), so a preview and the setup a
# moment later give the same one.
OFFSET_STEP: Final = 100
# The largest offset create accepts (kWh).
OFFSET_MAX: Final = 1_000_000_000
UNIT: Final = "unit_of_measurement"
ENERGY_METHODS: Final = (Method.EM, Method.PLUG, Method.NET)
# Local days with a rise a solar counter needs to be read as lifetime.
MIN_DAYS: Final = 2
# How long the solar term holds the solar's last power while it has none.
SOLAR_HOLD_SECONDS: Final = 600

# Kinds of the records of created helpers (`CreatedHelpers.async_add`).
KIND_SOLAR_POWER: Final = "solar_power"
KIND_SOLAR_ENERGY: Final = "solar_energy"
KIND_GROSS_POWER: Final = "gross_power"
KIND_GROSS_ENERGY: Final = "gross_energy"


def _factors(converter: type[BaseUnitConverter], target: str) -> dict[str, float]:
    """Return unit -> factor to `target`, for every unit Home Assistant knows."""
    return {
        str(unit): converter.converter_factory(unit, target)(1.0)
        for unit in sorted(converter.VALID_UNITS, key=str)
        if unit is not None
    }


# The factors the templates convert with, from Home Assistant's converters.
KWH: Final = _factors(EnergyConverter, UnitOfEnergy.KILO_WATT_HOUR)
WATTS: Final = _factors(PowerConverter, UnitOfPower.WATT)


class Blocked(StrEnum):
    """Why the setup cannot be done; each is also an exception key."""

    SOLAR_ALREADY_IN_METER = "solar_already_in_meter"
    DAILY_CHECK_FAILED = "daily_check_failed"
    UNSUPPORTED_INPUT = "unsupported_input"
    SOLAR_NEEDS_POWER = "solar_needs_power"
    SOLAR_NEEDS_DATA = "solar_needs_data"
    NO_SAFE_METHOD = "no_safe_method"
    DAILY_WITHOUT_POWER = "daily_without_power"
    NOT_OFFERED = "not_offered"
    CHOOSE_RETURNED = "choose_returned"
    RETURNED_DISABLED = "returned_disabled"
    INPUT_DISABLED = "input_disabled"
    INPUT_NOT_READY = "input_not_ready"
    VALUES_CHANGED = "values_changed"


class Reason(StrEnum):
    """Why a method is (not) offered or not verified; the panel words them.

    A verified energy method gives the device rule's key instead
    (`device_rules.RULE_*`).
    """

    POWER_SIGNED = "power_signed"
    AGAINST_RULE = "unverified_against_rule"
    MAY_RESET = "unverified_may_reset"
    UNVERIFIED_NET = "unverified_net"
    NO_DATA = "unverified_no_data"
    NET_NEEDS_SIGNED_METER = "net_needs_signed_meter"
    POWER_UNSIGNED = "unverified_power_unsigned"
    NO_RETURNED_SENSOR = "no_returned_sensor"
    DAILY_INPUT = "daily_input"
    UNSUPPORTED_INPUT = "unsupported_input"
    NO_POWER = "no_power"
    UNUSABLE_POWER = "unusable_power"
    # No live gross power for EM, Plug and Net: its sign is not checked.
    GROSS_POWER_NEEDS_SIGNED = "gross_power_needs_signed"


class Role(StrEnum):
    """The helpers the setup creates; names are given per role."""

    SOLAR_POWER = "solar_power"
    SOLAR_ENERGY = "solar_energy"
    POWER = "power"
    ENERGY = "energy"


def _error(key: str, **placeholders: str) -> ServiceValidationError:
    return ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key=key,
        translation_placeholders=placeholders,
    )


def unit_factor(unit: str | None, kind: TemplateKind) -> float | None:
    """Return the factor from `unit` to kWh (energy) or W (power), or None."""
    factors = KWH if kind == "energy" else WATTS
    return factors.get(unit) if unit else None


# --- Templates -------------------------------------------------------------


@dataclass(frozen=True)
class _Term:
    """One input of a template: its variable, entity and sign.

    `coef` is the input's factor (1, -1 or -2). A `zero` input that is not a
    number counts as 0; any other makes the template `none`.
    """

    name: str
    entity: str
    coef: int = 1
    zero: bool = False


def _read(term: _Term, table: str) -> tuple[str, str, str]:
    """Return (sets, check, value) of an input, converted with `table`.

    The value is the state times the factor of its current unit; an unknown
    unit fails the check. The value names the input's variables, so
    `meter_inputs` sees which input a minus applies to.
    """
    var, unit = term.name, f"{term.name}_unit"
    sets = (
        f"{{% set {var} = states('{term.entity}') %}}"
        f"{{% set {unit} = state_attr('{term.entity}', '{UNIT}') %}}"
    )
    value = f"{var} | float * {table}[{unit}]"
    if term.zero:
        return (
            sets,
            f"({unit} in {table} or not {var} | is_number)",
            f"({value} if {var} | is_number else 0)",
        )
    return sets, f"{var} | is_number and {unit} in {table}", value


def _kwh(term: _Term) -> tuple[str, str, str]:
    """Read an input in kWh."""
    return _read(term, "kwh")


def _w(term: _Term) -> tuple[str, str, str]:
    """Read an input in W."""
    return _read(term, "w")


def _table(name: str, factors: Mapping[str, float]) -> str:
    items = ", ".join(f"'{unit}': {factor!r}" for unit, factor in factors.items())
    return f"{{% set {name} = {{{items}}} %}}"


def _template(
    terms: list[_Term], *, energy: bool, offset: int = 0, guard: str = ""
) -> str:
    """Return a template of the signed `terms` (+ offset), in kWh or W.

    `guard` is one more condition for a number (else `none`).
    """
    read, table, decimals = (
        (_kwh, _table("kwh", KWH), ENERGY_DECIMALS)
        if energy
        else (_w, _table("w", WATTS), POWER_DECIMALS)
    )
    parts = [read(term) for term in terms]
    expression = ""
    for term, (_, _, value) in zip(terms, parts, strict=True):
        size = abs(term.coef)
        scaled = value if size == 1 else f"{size} * {value}"
        if not expression:
            expression = scaled if term.coef > 0 else f"-1 * {scaled}"
        else:
            expression += f" {'+' if term.coef > 0 else '-'} {scaled}"
    if offset:
        expression += f" + {offset}"
    sets = table + "".join(part[0] for part in parts)
    check = " and ".join([part[1] for part in parts] + ([guard] if guard else []))
    return (
        f"{sets}{{% if {check} %}}{{{{ ({expression}) | round({decimals}) }}}}"
        "{% else %}{{ none }}{% endif %}"
    )


def gross_energy_template(
    method: Method,
    meter: str,
    solar: str,
    returned: str | None = None,
    *,
    offset: int = 0,
) -> str:
    """Return the gross energy template (kWh, 3 decimals).

    EM: meter - returned + solar. Plug: meter - 2 x returned + solar. Net:
    meter + solar. `solar` is the solar term (its integral or its lifetime
    counter); `offset` (kWh) lifts the starting value.
    """
    if method is Method.POWER:
        raise ValueError("From power has no energy template")
    terms = [_Term("meter", meter)]
    if method is not Method.NET:
        if returned is None:
            raise ValueError(f"{method} needs a returned sensor")
        terms.append(_Term("returned", returned, -2 if method is Method.PLUG else -1))
    terms.append(_Term("solar", solar))
    return _template(terms, energy=True, offset=offset)


def gross_power_template(circuit: str, solar: str, *, invert: bool = False) -> str:
    """Return the gross power template (W, 1 decimal): circuit + solar.

    The circuit's power is turned around with `invert` (positive on export);
    without a number it makes the template `none`. An offline solar is 0,
    except while the circuit feeds in: then the template is `none`, as its
    true value is unknown. Home Assistant's integral counts no energy for an
    unknown source and stays available, so the gross energy never falls
    for a dropout of the solar. There is no floor at 0: a wrong sign must
    stay visible.
    """
    circuit_term = _Term("circuit", circuit, -1 if invert else 1)
    circuit_w = _w(circuit_term)[2]
    if invert:
        circuit_w = f"-1 * {circuit_w}"
    return _template(
        [circuit_term, _Term("solar", solar, zero=True)],
        energy=False,
        guard=f"(solar | is_number or {circuit_w} >= 0)",
    )


def solar_power_template(solar_power: str) -> str:
    """Return the solar's power in W for the solar term's integral.

    While the solar is `unavailable` (a radio dropout, an inverter offline
    at night) the template holds its own last value for
    SOLAR_HOLD_SECONDS, then gives 0: an integral of an unavailable source
    turns unavailable itself, and of 0 a short dropout at noon would lose
    energy. `now()` renders it every minute, so the hold ends even if the
    solar stays offline. Any other state without a number (`unknown`) gives
    0 at once, so a solar that flaps between the two cannot extend the
    hold; so does a state restored after a restart (attribute `restored`),
    the solar's own value not being known yet. Without its own value (just
    started) or without the solar entity it is 0; a number in an unknown
    unit gives `none`. There is no bound on how long the template's own
    value is unchanged: an inverter capped at its limit is constant for
    hours.
    """
    sets, check, value = _w(_Term("solar", solar_power))
    entity = f"states.{solar_power}"
    return (
        f"{_table('w', WATTS)}{sets}"
        "{% if solar | is_number %}"
        f"{{% if {check} %}}{{{{ ({value}) | round({POWER_DECIMALS}) }}}}"
        "{% else %}{{ none }}{% endif %}"
        "{% elif solar == 'unavailable'"
        f" and state_attr('{solar_power}', 'restored') is not true"
        " and this is defined and this.state | is_number"
        f" and {entity} is not none"
        f" and (now() - {entity}.last_changed).total_seconds()"
        f" < {SOLAR_HOLD_SECONDS} %}}"
        "{{ this.state | float }}"
        "{% else %}{{ 0 }}{% endif %}"
    )


# --- Reading inputs ----------------------------------------------------------


def _name(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the friendly name, else the registry's name, else None."""
    state = hass.states.get(entity_id)
    name = state.attributes.get(ATTR_FRIENDLY_NAME) if state is not None else None
    if name:
        return str(name)
    entry = er.async_get(hass).async_get(entity_id)
    return (entry.name or entry.original_name) if entry is not None else None


def _usable(hass: HomeAssistant, entity_id: str, kind: TemplateKind) -> bool:
    """Return True for an entity a template can read in kWh or W."""
    return (
        valid_entity_id(entity_id)
        and unit_factor(entity_unit(hass, entity_id), kind) is not None
    )


def _disabled(hass: HomeAssistant, entity_id: str) -> bool:
    """Return True for an entity disabled in the registry (it has no state)."""
    entry = er.async_get(hass).async_get(entity_id)
    return entry is not None and entry.disabled


def _is_number(text: str) -> bool:
    """Return True for a finite number, like Jinja's `is_number`."""
    try:
        return math.isfinite(float(text))
    except ValueError:
        return False


def _value(hass: HomeAssistant, entity_id: str, kind: TemplateKind) -> float | None:
    """Return the current value in kWh or W, as a template reads it, or None."""
    state = hass.states.get(entity_id)
    if state is None or not _is_number(state.state):
        return None
    factor = unit_factor(state.attributes.get(UNIT), kind)
    return float(state.state) * factor if factor is not None else None


def _holds_solar(
    hass: HomeAssistant, stat: str, solar: str, solar_power: str | None
) -> bool:
    """Return True if the meter `stat` already counts the solar.

    It does when one of the meter's inputs, from any level (`meter_inputs`),
    is the solar's energy statistic or power sensor, or what one of them is
    made of: a sum with the solar, a template that reads it in any form, an
    integral of the solar's power, the inverter's counter behind a daily
    utility meter used as the solar. Subtracted or not, it is in the meter
    already. The solar's statistic and power always count; what they are
    made of only if it is an energy or power sensor, so a factor or a date
    both read is no solar.
    """
    cache: Cache = {}
    held = meter_inputs(hass, stat, cache)["entities"]
    own = {solar} if solar_power is None else {solar, solar_power}
    if not held.isdisjoint(own):
        return True
    made_of: set[str] = set()
    for entity in own:
        made_of |= meter_inputs(hass, entity, cache)["entities"]
    return any(energy_or_power(hass, entity) for entity in held & made_of)


def energy_or_power(hass: HomeAssistant, entity_id: str) -> bool:
    """Return True for a sensor in an energy or power unit or of that class."""
    if not entity_id.startswith("sensor."):
        return False
    if entity_unit(hass, entity_id) in ENERGY_UNITS | POWER_UNITS:
        return True
    state = hass.states.get(entity_id)
    entry = er.async_get(hass).async_get(entity_id)
    device_class = (
        state.attributes.get(ATTR_DEVICE_CLASS) if state is not None else None
    ) or (entry.device_class or entry.original_device_class if entry else None)
    return device_class in (SensorDeviceClass.ENERGY, SensorDeviceClass.POWER)


def _find(
    prefs: Prefs, stat: str, solar: str
) -> tuple[Mapping[str, Any], Mapping[str, Any]]:
    """Return the electricity device and the solar source, or raise."""
    device = next((d for d in prefs.get(KEY_DEVICES, []) if d[STAT] == stat), None)
    if device is None:
        raise _error("unknown_device", stat=stat)
    source = next(
        (
            s
            for s in prefs.get(KEY_SOURCES, [])
            if s.get("type") == "solar" and s.get(SOLAR_STAT) == solar
        ),
        None,
    )
    if source is None:
        raise _error("unknown_source", stat=solar)
    return device, source


def _not_offered(entity_id: str, **why: str) -> ServiceValidationError:
    """Refuse an input; a draft power also names its `power` and `why`."""
    return _error(Blocked.NOT_OFFERED, entity_id=entity_id, **why)


# Why a draft power is refused: used by something else (or the meter or
# solar itself), not a power sensor, or one of the setup's gross helpers.
WHY_USED: Final = "used"
WHY_NOT_POWER: Final = "not_power"
WHY_OURS: Final = "ours"


def _state_class(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the state class (state first, else the registry's)."""
    state = hass.states.get(entity_id)
    if state is not None and ATTR_STATE_CLASS in state.attributes:
        return str(state.attributes[ATTR_STATE_CLASS])
    entry = er.async_get(hass).async_get(entity_id)
    found = (entry.capabilities or {}).get(ATTR_STATE_CLASS) if entry else None
    return str(found) if found is not None else None


def _rate_sensor(hass: HomeAssistant, power: str) -> bool:
    """Return True for a power sensor a draft may set.

    Only a sensor. Its state decides (`async_is_rate_sensor`). A state
    without device class and unit (an inverter offline at night) leaves it
    to the registry: device class power and a unit of the electricity rate
    units.
    """
    state = hass.states.get(power)
    if not power.startswith("sensor."):
        return False
    if state is not None and (
        ATTR_DEVICE_CLASS in state.attributes or UNIT in state.attributes
    ):
        return async_is_rate_sensor(hass, power, DeviceKind.ELECTRICITY)
    entry = er.async_get(hass).async_get(power)
    return (
        entry is not None
        and (entry.device_class or entry.original_device_class)
        == SensorDeviceClass.POWER
        and entry.unit_of_measurement in RATE_UNITS[DeviceKind.ELECTRICITY]
    )


def _ours(hass: HomeAssistant, helpers: CreatedHelpers, entity_id: str) -> bool:
    """Return True for a gross energy or gross power helper of the setup."""
    entry = er.async_get(hass).async_get(entity_id)
    record = (
        helpers.record(entry.config_entry_id)
        if entry is not None and entry.config_entry_id
        else None
    )
    return record is not None and record.get("kind") in (
        KIND_GROSS_ENERGY,
        KIND_GROSS_POWER,
    )


def _used_by_others(
    prefs: Prefs, device: Mapping[str, Any], source: Mapping[str, Any]
) -> set[str]:
    """Return the statistics of the settings but this device and solar's power."""
    others = dict(prefs)
    others[KEY_DEVICES] = [d for d in prefs.get(KEY_DEVICES, []) if d is not device]
    others[KEY_SOURCES] = [
        {key: value for key, value in s.items() if key != RATE} if s is source else s
        for s in prefs.get(KEY_SOURCES, [])
    ]
    return used_stats(others)


# --- Plan --------------------------------------------------------------------


@dataclass(frozen=True)
class Choices:
    """What the panel asks for; everything is checked against the offer.

    `stat` is the device, `solar` the solar source's energy statistic, both
    from the settings the plan is given (the draft's when there is one).
    `periodic` is the user's daily switch per input; a certain signal
    ignores it.
    """

    stat: str
    solar: str
    method: Method | None = None
    drawn: str | None = None
    returned: str | None = None
    invert: bool | None = None
    periodic: Mapping[str, bool] = field(default_factory=dict)


@dataclass(frozen=True)
class MethodStatus:
    """Whether a method is offered and verified, and why (a reason key)."""

    method: Method
    offered: bool
    verified: bool
    reason: str | None
    # The input that keeps the method from being offered.
    entity: str | None = None

    def as_dict(self) -> dict[str, Any]:
        """Return the WebSocket form."""
        return {
            "method": self.method,
            "offered": self.offered,
            "verified": self.verified,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class SolarTerm:
    """Where the solar energy of EM, Plug and Net comes from.

    `kind` "integral": the integral of the 0-mapped template of the power
    sensor `source`, `reuse` when one of ours exists already. "counter": the
    solar's own lifetime counter `source`. None: it cannot be built, for the
    reason `missing`.
    """

    kind: Literal["integral", "counter"] | None
    source: str
    reuse: str | None = None
    missing: Blocked | None = None

    def reads(self) -> str | None:
        """Return the entity the gross template reads now (None: a new one)."""
        return self.source if self.kind == "counter" else self.reuse


@dataclass
class Plan:
    """What the setup creates for one circuit meter and solar source."""

    stat: str
    # The device's name in the settings, else the meter's; for default names.
    meter_name: str
    method: Method | None
    suggested: Method | None
    rule: MeterClass
    statuses: list[MethodStatus]
    drawn: str
    returned: str | None
    invert: bool
    drawn_candidates: list[tuple[str, bool]]
    returned_candidates: list[tuple[str, bool]]
    # (entity, where it is from: draft, saved or paired) of both powers.
    circuit: tuple[str | None, str | None]
    solar: tuple[str | None, str | None]
    signed: bool
    evidence: dict[str, StatsEvidence]
    solar_term: SolarTerm
    # (circuit, solar) power when both are readable: a gross power exists.
    gross_power: tuple[str, str] | None
    live: dict[str, float | None]
    offset: int = 0
    blocked: Blocked | None = None
    blocked_entity: str | None = None
    # Why EM, Plug or Net build no gross power although both powers exist.
    power_reason: Reason | None = None

    def block(self, reason: Blocked, entity_id: str) -> None:
        """Keep the first reason found."""
        if self.blocked is None:
            self.blocked, self.blocked_entity = reason, entity_id

    def status(self, method: Method) -> MethodStatus:
        """Return the status of one method."""
        return next(status for status in self.statuses if status.method is method)

    def roles(self) -> list[Role]:
        """Return the helpers create makes, in order."""
        if self.method is None:
            return []
        if self.method is Method.POWER:
            return [Role.POWER, Role.ENERGY]
        roles = []
        if self.solar_term.kind == "integral" and self.solar_term.reuse is None:
            roles += [Role.SOLAR_POWER, Role.SOLAR_ENERGY]
        if self.gross_power is not None:
            roles.append(Role.POWER)
        return [*roles, Role.ENERGY]

    def default_name(self, hass: HomeAssistant, role: Role) -> str:
        """Return the name a helper gets when the panel gives none."""
        if role is Role.ENERGY:
            return f"{self.meter_name} gross"
        if role is Role.POWER:
            return f"{self.meter_name} gross power"
        power = self.solar_term.source
        power_name = _name(hass, power) or power
        if role is Role.SOLAR_POWER:
            return f"{power_name} (0 when offline)"
        return f"{power_name} energy"

    def as_dict(self, hass: HomeAssistant) -> dict[str, Any]:
        """Return the preview of the panel."""
        return {
            "method": self.method,
            "suggested": self.suggested,
            "rule": self.rule.rule,
            "methods": [status.as_dict() for status in self.statuses],
            "drawn": self.drawn,
            "returned": self.returned,
            "invert": self.invert,
            "drawn_candidates": [
                {"entity": entity, "disabled": disabled}
                for entity, disabled in self.drawn_candidates
            ],
            "returned_candidates": [
                {"entity": entity, "disabled": disabled}
                for entity, disabled in self.returned_candidates
            ],
            "power": {
                "circuit": self.circuit[0],
                "solar": self.solar[0],
                "signed": self.signed,
                "circuit_from": self.circuit[1],
                "solar_from": self.solar[1],
            },
            "live": self.live,
            "evidence": {
                stat: found.as_dict() for stat, found in self.evidence.items()
            },
            "solar_term": {
                "kind": self.solar_term.kind,
                "reuse": self.solar_term.reuse,
            },
            "helpers": [
                {"role": role, "name_default": self.default_name(hass, role)}
                for role in self.roles()
            ],
            "offset": self.offset,
            "power_reason": self.power_reason,
            "blocked": self.blocked,
            "blocked_entity": self.blocked_entity,
        }


@dataclass(frozen=True)
class _Powers:
    """Reads the device's and the solar's power from the settings (or draft).

    A power that differs from the saved settings comes from the draft and
    must be a power sensor not used by anything else, and none of the
    setup's own gross helpers. A power the draft removed means no power;
    only a device or solar that never had one gets its own device's single
    power sensor (`paired_power`).
    """

    hass: HomeAssistant
    helpers: CreatedHelpers
    used: set[str]
    refused: set[str]

    def read(
        self, role: str, entry: Mapping[str, Any], saved: Mapping[str, Any] | None
    ) -> tuple[str | None, str | None]:
        """Return (power, where it is from) of the `role` "circuit" or "solar".

        A refused draft power names the role and why, so the panel can say so.
        """
        power = entry.get(RATE)
        saved_power = saved.get(RATE) if saved is not None else None
        if power is None:
            # Removed in the draft: no power, and no other one paired.
            return None, "removed" if saved_power is not None else None
        if power == saved_power:
            return power, "saved"
        why: str | None = None
        if power in self.refused or power in self.used:
            why = WHY_USED
        elif not _rate_sensor(self.hass, power):
            why = WHY_NOT_POWER
        elif _ours(self.hass, self.helpers, power):
            why = WHY_OURS
        if why is not None:
            raise _not_offered(power, power=role, why=why)
        return power, "draft"

    def pair(
        self, found: tuple[str | None, str | None], energy: str, skip: set[str]
    ) -> tuple[str | None, str | None]:
        """Return `found`, or the energy's paired power when it never had one."""
        if found[0] is not None or found[1] == "removed":
            return found[0], None if found[1] == "removed" else found[1]
        paired = paired_power(self.hass, energy, self.used | skip)
        return (paired, "paired") if paired is not None else (None, None)


def _find_saved(
    saved: Prefs, stat: str, solar: str
) -> tuple[Mapping[str, Any] | None, Mapping[str, Any] | None]:
    """Return the device and solar source of the saved settings, if there."""
    device = next((d for d in saved.get(KEY_DEVICES, []) if d[STAT] == stat), None)
    source = next(
        (
            s
            for s in saved.get(KEY_SOURCES, [])
            if s.get("type") == "solar" and s.get(SOLAR_STAT) == solar
        ),
        None,
    )
    return device, source


def _reusable_solar_term(
    hass: HomeAssistant, helpers: CreatedHelpers, solar_power: str
) -> str | None:
    """Return our integral of `solar_power`'s 0-mapped template, or None.

    Only a pair exactly as the setup builds it now: our template of the
    solar power with our options, and our left integral of it with our
    options, both enabled. A helper the user changed is never reused.
    """
    registry = er.async_get(hass)
    entries = hass.config_entries

    def entity_of(entry_id: Any, domain: str) -> tuple[str, Mapping[str, Any]] | None:
        """Return the enabled entity and the options of our helper, or None."""
        entry = entries.async_get_entry(str(entry_id))
        if entry is None or entry.domain != domain:
            return None
        found = er.async_entries_for_config_entry(registry, entry.entry_id)
        if not found or found[0].disabled:
            return None
        return found[0].entity_id, entry.options

    template_options = {"state": solar_power_template(solar_power)} | SENSOR_OPTIONS[
        "power"
    ]
    for entry_id, record in reversed(helpers.records().items()):
        if (
            record.get("kind") != KIND_SOLAR_ENERGY
            or record.get("power") != solar_power
        ):
            continue
        template = entity_of(record.get("template"), "template")
        integral = entity_of(entry_id, "integration")
        if (
            template is not None
            and integral is not None
            and all(template[1].get(k) == v for k, v in template_options.items())
            and integral[1].get("source") == template[0]
            and all(integral[1].get(k) == v for k, v in INTEGRAL_OPTIONS.items())
        ):
            return integral[0]
    return None


@dataclass
class _Inputs:
    """The circuit's energy inputs, and what is known about them."""

    hass: HomeAssistant
    drawn: str
    returned: str | None
    # The returned sensor the device's rule trusts (`preselect_returned`).
    trusted_returned: str | None
    has_returned: bool
    evidence: dict[str, StatsEvidence]
    periodic: Mapping[str, bool]

    def is_periodic(self, entity: str) -> bool:
        """Return True for a counter that resets: certain, the user's, or guessed."""
        found = self.evidence.get(entity)
        if found is not None and found.certain:
            return True
        if entity in self.periodic:
            return self.periodic[entity]
        return bool(found is not None and found.periodic)

    def unknown(self, entity: str) -> bool:
        """Return True for a counter without statistics the user did not judge."""
        found = self.evidence.get(entity)
        return (found is None or found.periodic is None) and entity not in self.periodic

    def counter(self, entity: str) -> Blocked | None:
        """Return why a counter cannot be read as lifetime, or None if it can.

        Lifetime needs statistics that rise on two local days or more, no
        reset signal and no drop at all; the user can only mark it daily.
        """
        found = self.evidence.get(entity)
        if self.periodic.get(entity, False) or (
            found is not None and (found.periodic or found.certain or found.drops)
        ):
            return Blocked.SOLAR_NEEDS_POWER
        rising_days = {
            when.date()
            for (_, before), (when, after) in pairwise(
                found.series if found is not None else []
            )
            if after > before
        }
        if found is None or found.periodic is None or len(rising_days) < MIN_DAYS:
            return Blocked.SOLAR_NEEDS_DATA
        return None


def _energy_problem(inputs: _Inputs, method: Method) -> tuple[Reason, str] | None:
    """Return why EM, Plug or Net cannot work, with the input, or None."""
    entities = [inputs.drawn]
    if method is not Method.NET:
        if not inputs.has_returned:
            return Reason.NO_RETURNED_SENSOR, inputs.drawn
        if inputs.returned is not None:
            entities.append(inputs.returned)
    for entity in entities:
        if not _usable(inputs.hass, entity, "energy"):
            return Reason.UNSUPPORTED_INPUT, entity
        if inputs.is_periodic(entity):
            return Reason.DAILY_INPUT, entity
    if (
        method is Method.NET
        and _state_class(inputs.hass, inputs.drawn) == SensorStateClass.TOTAL_INCREASING
    ):
        # Home Assistant reads every fall of such a meter as a reset: each
        # exported kWh would count as consumption.
        return Reason.NET_NEEDS_SIGNED_METER, inputs.drawn
    return None


def _energy_status(inputs: _Inputs, method: Method, rule: MeterClass) -> MethodStatus:
    """Return the status of EM, Plug or Net.

    Verified when the device's rule (`classify_meter`) gives this method, with
    the returned sensor the rule trusts, and the inputs have statistics.
    Otherwise it is offered unverified, with the reason why.
    """
    if (problem := _energy_problem(inputs, method)) is not None:
        reason, entity = problem
        return MethodStatus(
            method, offered=False, verified=False, reason=reason, entity=entity
        )
    inputs_used = [inputs.drawn]
    if method is not Method.NET and inputs.returned is not None:
        inputs_used.append(inputs.returned)
    unverified: Reason
    if any(inputs.unknown(entity) for entity in inputs_used):
        unverified = Reason.NO_DATA
    elif rule.method is method and (
        method is Method.NET or inputs.returned == inputs.trusted_returned
    ):
        return MethodStatus(method, offered=True, verified=True, reason=rule.rule)
    elif method is Method.NET:
        unverified = Reason.UNVERIFIED_NET
    elif rule.method in (Method.EM, Method.PLUG):
        unverified = Reason.AGAINST_RULE
    else:
        unverified = Reason.MAY_RESET
    return MethodStatus(method, offered=True, verified=False, reason=unverified)


def _power_status(
    hass: HomeAssistant, circuit: str | None, solar_power: str | None, *, signed: bool
) -> MethodStatus:
    """Return the status of "From power": verified once the circuit fed in."""
    reason: Reason | None = None
    if circuit is None or solar_power is None:
        reason = Reason.NO_POWER
    elif not _usable(hass, circuit, "power") or _disabled(hass, circuit):
        reason = Reason.UNUSABLE_POWER
    if reason is not None:
        return MethodStatus(
            Method.POWER, offered=False, verified=False, reason=reason, entity=circuit
        )
    return MethodStatus(
        Method.POWER,
        offered=True,
        verified=signed,
        reason=Reason.POWER_SIGNED if signed else Reason.POWER_UNSIGNED,
    )


def _set_offset(hass: HomeAssistant, plan: Plan) -> None:
    """Set the offset that starts the gross energy at START_MIN or more.

    Reads the inputs as the template will: a new solar integral reads 0, a
    reused one its value. Only the terms that can pull the gross below 0 need
    a value: the meter of Net, and the returned energy that is subtracted.
    Without one the start is unknown, and the setup waits. An added term that
    counts only up (the solar, a drawn meter) counts as 0 without a value,
    which only makes the offset larger: a solar counter may be offline at
    night.
    """
    method = plan.method
    terms: list[tuple[str | None, int, bool]] = [(plan.drawn, 1, method is Method.NET)]
    if method is not Method.NET:
        terms.append((plan.returned, -2 if method is Method.PLUG else -1, True))
    terms.append((plan.solar_term.reads(), 1, False))
    gross = 0.0
    for entity, coef, needed in terms:
        value = _value(hass, entity, "energy") if entity is not None else None
        if value is None:
            if needed:
                plan.block(Blocked.INPUT_NOT_READY, entity or plan.stat)
                return
            value = 0.0
        gross += coef * value
    if gross < START_MIN:
        plan.offset = math.ceil((START_MIN - gross) / OFFSET_STEP) * OFFSET_STEP


def _live(
    hass: HomeAssistant,
    circuit: str | None,
    solar_power: str | None,
    *,
    invert: bool,
) -> dict[str, float | None]:
    """Return the circuit, solar and gross power now, as the template reads them."""
    circuit_w = _value(hass, circuit, "power") if circuit is not None else None
    if circuit_w is not None and invert:
        circuit_w = -circuit_w
    solar_w: float | None = None
    offline = False
    if solar_power is not None:
        # Offline (not a number) is 0, like in the template.
        state = hass.states.get(solar_power)
        offline = state is None or not _is_number(state.state)
        solar_w = 0.0 if offline else _value(hass, solar_power, "power")
    gross_w = (
        round(circuit_w + solar_w, POWER_DECIMALS)
        if circuit_w is not None
        and solar_w is not None
        and not (offline and circuit_w < 0)
        else None
    )
    return {"circuit_w": circuit_w, "solar_w": solar_w, "gross_w": gross_w}


def _solar_term(
    hass: HomeAssistant,
    helpers: CreatedHelpers,
    inputs: _Inputs,
    solar: str,
    solar_power: str | None,
) -> SolarTerm:
    """Return where the solar energy comes from (R1: power first)."""
    if solar_power is not None:
        return SolarTerm(
            "integral", solar_power, _reusable_solar_term(hass, helpers, solar_power)
        )
    if not _usable(hass, solar, "energy"):
        return SolarTerm(None, solar, missing=Blocked.UNSUPPORTED_INPUT)
    if (missing := inputs.counter(solar)) is not None:
        return SolarTerm(None, solar, missing=missing)
    return SolarTerm("counter", solar)


def _block_inputs(hass: HomeAssistant, plan: Plan, solar: str) -> None:
    """Block for the solar already in the circuit, or a solar term not buildable."""
    circuit, solar_power = plan.circuit[0], plan.solar[0]
    # A meter or power that already holds the solar would count it twice.
    for entity in dict.fromkeys(
        entity
        for entity in (plan.stat, plan.drawn, plan.returned, circuit)
        if entity is not None
    ):
        if _holds_solar(hass, entity, solar, solar_power):
            plan.block(Blocked.SOLAR_ALREADY_IN_METER, entity)
    if solar_power is not None and not _usable(hass, solar_power, "power"):
        plan.block(Blocked.UNSUPPORTED_INPUT, solar_power)
    elif solar_power is not None and _disabled(hass, solar_power):
        # Its template would read 0 for good: the solar would go missing.
        plan.block(Blocked.INPUT_DISABLED, solar_power)
    elif plan.solar_term.missing is not None:
        plan.block(plan.solar_term.missing, solar)


def _block_method(plan: Plan) -> None:
    """Block for the chosen method: not offered, or an input it cannot use."""
    offered = {status.method for status in plan.statuses if status.offered}
    if not offered:
        status = plan.status(Method.NET)
        reason = {
            Reason.UNSUPPORTED_INPUT: Blocked.UNSUPPORTED_INPUT,
            Reason.DAILY_INPUT: Blocked.DAILY_WITHOUT_POWER,
        }.get(Reason(str(status.reason)), Blocked.NO_SAFE_METHOD)
        plan.block(reason, status.entity or plan.stat)
    method = plan.method
    if method is None:
        return
    if method not in offered:
        plan.block(Blocked.NOT_OFFERED, plan.status(method).entity or plan.stat)
    if method in (Method.EM, Method.PLUG):
        if plan.returned is None:
            plan.block(Blocked.CHOOSE_RETURNED, plan.stat)
        elif dict(plan.returned_candidates).get(plan.returned):
            plan.block(Blocked.RETURNED_DISABLED, plan.returned)
    if method is not Method.POWER and dict(plan.drawn_candidates).get(plan.drawn):
        plan.block(Blocked.INPUT_DISABLED, plan.drawn)


async def async_plan(
    hass: HomeAssistant,
    prefs: Prefs,
    helpers: CreatedHelpers,
    choices: Choices,
    saved: Prefs | None = None,
) -> Plan:
    """Return what the setup would create for a device and a solar source.

    `prefs` are the settings to plan on: the saved ones, or a draft with the
    `saved` ones beside it. `choices.stat` must be an electricity device and
    `choices.solar` the energy statistic of a solar source there. A drawn or
    returned sensor, or a power from the draft, that the setup would not
    offer raises `not_offered`. The method defaults to the suggested one:
    the device's rule, else "From power", else none. `blocked` is the first
    reason the chosen method cannot be built, with the entity it is about.
    """
    stat, solar = choices.stat, choices.solar
    device, source = _find(prefs, stat, solar)
    saved_device, saved_source = _find_saved(
        prefs if saved is None else saved, stat, solar
    )
    used = _used_by_others(prefs, device, source)
    powers = _Powers(hass, helpers, used, {stat, solar})
    circuit = powers.read("circuit", device, saved_device)
    solar_power = powers.read("solar", source, saved_source)
    if circuit[0] is not None and circuit[0] == solar_power[0]:
        raise _not_offered(circuit[0], power="circuit", why=WHY_USED)
    circuit = powers.pair(circuit, stat, {solar_power[0] or ""})
    solar_power = powers.pair(solar_power, solar, {circuit[0] or ""})
    if (
        circuit[1] == "paired"
        and circuit[0] is not None
        and _holds_solar(hass, circuit[0], solar, solar_power[0])
    ):
        # It would only feed the gross power; better none than counted twice.
        circuit = None, None
    drawn_list = drawn_candidates(hass, stat, used)
    returned_list = returned_candidates(hass, stat, used)
    drawn = choices.drawn or stat
    if drawn not in dict(drawn_list):
        raise _not_offered(drawn)
    if choices.returned is not None and choices.returned not in dict(returned_list):
        raise _not_offered(choices.returned)
    trusted = preselect_returned(hass, stat, used)
    returned = choices.returned or trusted

    found = await async_probe(
        hass,
        {stat, drawn, solar}
        | {e for e in (returned, circuit[0], solar_power[0]) if e is not None},
        power_of={
            energy: power
            for energy, power in (
                (drawn, circuit[0]),
                (stat, circuit[0]),
                (solar, solar_power[0]),
            )
            if power is not None
        },
    )
    inputs = _Inputs(
        hass,
        drawn,
        returned,
        trusted,
        bool(returned_list),
        found or {},
        choices.periodic,
    )
    rule = classify_meter(hass, drawn, inputs.evidence.get(drawn))
    circuit_evidence = inputs.evidence.get(circuit[0] or "")
    signed = circuit_evidence is not None and circuit_evidence.went_negative
    statuses = [_energy_status(inputs, method, rule) for method in ENERGY_METHODS]
    statuses.append(_power_status(hass, circuit[0], solar_power[0], signed=signed))
    offered = {status.method for status in statuses if status.offered}
    suggested = rule.method if rule.method in offered else None
    if suggested is None and Method.POWER in offered:
        suggested = Method.POWER
    invert = choices.invert
    if invert is None:
        invert = circuit[0] is not None and default_inverted(hass, circuit[0])
    plan = Plan(
        stat=stat,
        meter_name=device.get(NAME) or _name(hass, stat) or stat,
        method=choices.method or suggested,
        suggested=suggested,
        rule=rule,
        statuses=statuses,
        drawn=drawn,
        returned=returned,
        invert=invert,
        drawn_candidates=drawn_list,
        returned_candidates=returned_list,
        circuit=circuit,
        solar=solar_power,
        signed=signed,
        evidence=inputs.evidence,
        solar_term=_solar_term(hass, helpers, inputs, solar, solar_power[0]),
        gross_power=(circuit[0], solar_power[0])
        if circuit[0] is not None
        and solar_power[0] is not None
        and _usable(hass, circuit[0], "power")
        and not _disabled(hass, circuit[0])
        and _usable(hass, solar_power[0], "power")
        else None,
        live=_live(hass, circuit[0], solar_power[0], invert=invert),
    )
    if plan.method in ENERGY_METHODS and plan.gross_power is not None and not signed:
        # The live gross power of EM, Plug and Net has the circuit power's
        # sign, which nobody checked: better none than a wrong one.
        plan.gross_power = None
        plan.power_reason = Reason.GROSS_POWER_NEEDS_SIGNED
    if found is None:
        # Before anything the statistics decide: a retry may help.
        plan.block(Blocked.DAILY_CHECK_FAILED, stat)
    _block_inputs(hass, plan, solar)
    _block_method(plan)
    if plan.blocked is None and plan.method in ENERGY_METHODS:
        _set_offset(hass, plan)
    return plan


# --- Create ------------------------------------------------------------------


async def _async_undo(
    hass: HomeAssistant, helpers: CreatedHelpers, entry_ids: list[str]
) -> None:
    """Remove and forget the helpers, newest first; log what fails.

    Every helper is tried, so one failure leaves no others behind. A helper
    that cannot be removed stays recorded: it still exists and was made here.
    """
    for entry_id in reversed(entry_ids):
        try:
            await hass.config_entries.async_remove(entry_id)
        except Exception:
            _LOGGER.exception("Removing the helper %s again failed", entry_id)
            continue
        try:
            await helpers.async_discard(entry_id)
        except Exception:
            _LOGGER.exception("Forgetting the helper %s failed", entry_id)


def _check_offset(plan: Plan, offset: float) -> int:
    """Return the previewed offset if it is still enough, else refuse.

    It must be a whole number of OFFSET_STEP and at least what the values
    need now. From power has no offset (its integral starts at 0) and
    ignores it.
    """
    if plan.method is Method.POWER:
        return 0
    if (
        not math.isfinite(offset)
        or offset < plan.offset
        or offset > OFFSET_MAX
        or offset % OFFSET_STEP
    ):
        raise _error(Blocked.VALUES_CHANGED, entity_id=plan.stat)
    return int(offset)


type _Record = Callable[..., Awaitable[None]]


async def async_create(
    hass: HomeAssistant,
    helpers: CreatedHelpers,
    plan: Plan,
    names: Mapping[str, str],
    offset: float,
) -> tuple[str, str | None]:
    """Create the helpers of `plan`; return the gross meter and gross power.

    `plan` must come from `async_plan` with the panel's choices; `offset` is
    the one the preview showed. Refused when the plan is blocked, the method
    is not offered, or the offset is no longer enough (`values_changed`).
    Every helper is recorded as created by Energy Flow Mapper, with what it
    is for. When one fails, or the request is cancelled, every helper of this
    request (not a reused solar term) is removed and forgotten again, shielded
    from a further cancel, and the error is raised.
    """
    if plan.blocked is not None:
        raise _error(plan.blocked, entity_id=plan.blocked_entity or plan.stat)
    method = plan.method
    if (
        method is None
        or not plan.status(method).offered
        or (method is Method.POWER and plan.gross_power is None)
    ):
        raise _not_offered(plan.stat)
    start = _check_offset(plan, offset)

    def name(role: Role) -> str:
        return (names.get(role) or "").strip() or plan.default_name(hass, role)

    created: list[str] = []

    async def record(entry_id: str, **what: Any) -> None:
        created.append(entry_id)
        await helpers.async_add(entry_id, what)

    try:
        power_entry: str | None = None
        stat_rate: str | None = None
        if plan.gross_power is not None:
            power_entry, stat_rate = await async_create_template(
                hass,
                name(Role.POWER),
                gross_power_template(*plan.gross_power, invert=plan.invert),
                "power",
            )
            await record(
                power_entry,
                kind=KIND_GROSS_POWER,
                stat=plan.stat,
                method=method.value,
            )
        if method is Method.POWER and stat_rate is not None:
            entry_id, gross = await async_create_integral(
                hass, stat_rate, name(Role.ENERGY)
            )
        else:
            solar = await _async_solar_energy(hass, plan.solar_term, name, record)
            entry_id, gross = await async_create_template(
                hass,
                name(Role.ENERGY),
                gross_energy_template(
                    method, plan.drawn, solar, plan.returned, offset=start
                ),
                "energy",
            )
        await record(
            entry_id,
            kind=KIND_GROSS_ENERGY,
            stat=plan.stat,
            method=method.value,
            power=power_entry,
        )
    except Exception, asyncio.CancelledError:
        # Nobody uses them yet; a retry would meet them.
        await asyncio.shield(_async_undo(hass, helpers, created))
        raise
    return gross, stat_rate


async def _async_solar_energy(
    hass: HomeAssistant,
    term: SolarTerm,
    name: Callable[[Role], str],
    record: _Record,
) -> str:
    """Return the solar term's entity: the counter, reused, or a new integral.

    A new one is the 0-mapped template of the solar's power and its integral
    (kWh), recorded so the next setup with this solar reuses them.
    """
    if (reads := term.reads()) is not None:
        return reads
    template_entry, template = await async_create_template(
        hass, name(Role.SOLAR_POWER), solar_power_template(term.source), "power"
    )
    await record(template_entry, kind=KIND_SOLAR_POWER, power=term.source)
    entry_id, integral = await async_create_integral(
        hass, template, name(Role.SOLAR_ENERGY)
    )
    await record(
        entry_id, kind=KIND_SOLAR_ENERGY, power=term.source, template=template_entry
    )
    return integral
