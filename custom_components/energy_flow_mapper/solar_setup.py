"""The guided setup "Solar feeds into this circuit".

A circuit meter with a solar plugged in behind it sees only what the circuit
draws from the house: the solar's own production is used up before it reaches
the meter. The gross meter adds it back, as a template helper:

- a meter that counts both ways (net, it goes down while the solar produces):
  gross = meter + solar,
- a meter that counts only what it draws, with a returned sensor on its
  device (Shelly Pro EM): gross = drawn - returned + solar,
- the gross power: circuit power + solar power. The circuit power is signed
  for both kinds (it goes below 0 while returning).

Each template is `none` while an input is not a number. Inputs in another
unit (the daily energy of a micro inverter is often in Wh, a power in kW) are
converted with a factor written into the template, read from the unit at
setup time; the helpers are fixed at kWh and W.

An input that falls back to 0 every day would make the gross meter jump down
once a day, so it is replaced by an integral helper of its own power, created
first. Without that power sensor the setup stops with a reason, and so it
does when the check for daily inputs could not run.

The gross meter is `total_increasing`, and Home Assistant skips the negative
states of such a meter. A circuit that returned more than it drew so far, or
a solar from a fresh integral, would start it below 0: the template then adds
a constant, read from the inputs at setup time, so it starts at 100 kWh or
more. A constant does not change what the meter counts.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Final

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.const import (
    ATTR_DEVICE_CLASS,
    ATTR_FRIENDLY_NAME,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.util.unit_conversion import EnergyConverter, PowerConverter

from .candidates import ENERGY_UNITS, POWER_UNITS
from .const import DOMAIN
from .created_helpers import CreatedHelpers
from .daily_reset import async_daily_check
from .hierarchy import KEY_DEVICES, KEY_SOURCES, NAME, RATE, STAT, Prefs, used_stats
from .hints import returned_sensor
from .integral import async_create_integral, energy_unit, entity_unit
from .meter_inputs import Cache, meter_inputs
from .template_meter import TemplateKind, async_create_template

_LOGGER = logging.getLogger(__name__)

ENERGY_DECIMALS: Final = 3
POWER_DECIMALS: Final = 1
SOLAR_STAT: Final = "stat_energy_from"
# The lowest starting value (kWh) of a gross meter; a lower one gets an offset.
# Far from 0: Home Assistant reads a dip of more than 10 % as a meter reset,
# and an input that lags (an integral samples the power) can dip it a bit.
START_MIN: Final = 100.0
# The offset is a whole number of these (kWh), so a preview and the setup a
# moment later give the same one.
OFFSET_STEP: Final = 100


class MeterKind(StrEnum):
    """How the circuit meter counts."""

    NET = "net"
    DRAWS = "draws"


class Blocked(StrEnum):
    """Why the setup cannot be done; each is also an exception key."""

    NO_RETURNED_SENSOR = "no_returned_sensor"
    RETURNED_DISABLED = "returned_disabled"
    DAILY_WITHOUT_POWER = "daily_without_power"
    UNSUPPORTED_INPUT = "unsupported_input"
    SOLAR_ALREADY_IN_METER = "solar_already_in_meter"
    DAILY_CHECK_FAILED = "daily_check_failed"
    INPUT_NOT_READY = "input_not_ready"


def _error(key: str, **placeholders: str) -> ServiceValidationError:
    return ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key=key,
        translation_placeholders=placeholders,
    )


def unit_factor(unit: str | None, kind: TemplateKind) -> float | None:
    """Return the factor from `unit` to kWh (energy) or W (power), or None."""
    converter, target = (
        (EnergyConverter, UnitOfEnergy.KILO_WATT_HOUR)
        if kind == "energy"
        else (PowerConverter, UnitOfPower.WATT)
    )
    if unit not in converter.VALID_UNITS:
        return None
    return converter.converter_factory(unit, target)(1.0)


def _template(
    terms: list[tuple[str, str, str]],
    decimals: int,
    factors: Mapping[str, float],
    offset: int = 0,
) -> str:
    """Return a template of signed terms (sign, variable, entity ID) + offset."""
    sets = "".join(
        f"{{% set {var} = states('{entity}') %}}" for _, var, entity in terms
    )
    check = " and ".join(f"{var} | is_number" for _, var, _ in terms)
    parts: list[str] = []
    for sign, var, entity in terms:
        factor = factors.get(entity, 1.0)
        term = f"{var} | float" + ("" if factor == 1 else f" * {factor!r}")
        parts.append(term if not parts else f"{sign} {term}")
    if offset:
        parts.append(f"+ {offset}")
    return (
        f"{sets}{{% if {check} %}}{{{{ ({' '.join(parts)}) | round({decimals}) }}}}"
        "{% else %}{{ none }}{% endif %}"
    )


def gross_energy_template(  # noqa: PLR0913 - the inputs, then keywords
    kind: MeterKind,
    meter: str,
    solar: str,
    returned: str | None,
    *,
    factors: Mapping[str, float] | None = None,
    offset: int = 0,
) -> str:
    """Return the gross energy template (kWh, 3 decimals).

    Net: meter + solar. Draws: meter - returned + solar. `factors` maps an
    entity ID to the factor that turns its value into kWh (1 is left out);
    `offset` (kWh) is added to lift the starting value.
    """
    terms = [("+", "meter", meter)]
    if kind is MeterKind.DRAWS:
        if returned is None:
            raise ValueError("A meter that only draws needs a returned sensor")
        terms.append(("-", "returned", returned))
    terms.append(("+", "solar", solar))
    return _template(terms, ENERGY_DECIMALS, factors or {}, offset)


def gross_power_template(
    circuit_power: str,
    solar_power: str,
    *,
    factors: Mapping[str, float] | None = None,
) -> str:
    """Return the gross power template (W, 1 decimal): circuit + solar."""
    terms = [("+", "circuit", circuit_power), ("+", "solar", solar_power)]
    return _template(terms, POWER_DECIMALS, factors or {})


def _factor(hass: HomeAssistant, entity_id: str, kind: TemplateKind) -> float | None:
    """Return the factor of an input a template can read, or None."""
    if not valid_entity_id(entity_id):
        return None
    return unit_factor(entity_unit(hass, entity_id), kind)


def _integral_factor(hass: HomeAssistant, power: str) -> float | None:
    """Return the factor to kWh of the integral of `power`, or None.

    The integral counts in `integral.energy_unit` of the power's unit: kWh
    for W and kW, MWh for MW. A power without an energy unit (BTU/h) or
    without a unit at all cannot be integrated into kWh.
    """
    if not valid_entity_id(power) or (unit := entity_unit(hass, power)) is None:
        return None
    return unit_factor(energy_unit(unit), "energy")


def _name(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the friendly name, else the registry's name, else None."""
    state = hass.states.get(entity_id)
    name = state.attributes.get(ATTR_FRIENDLY_NAME) if state is not None else None
    if name:
        return str(name)
    entry = er.async_get(hass).async_get(entity_id)
    return (entry.name or entry.original_name) if entry is not None else None


@dataclass
class Plan:
    """What the setup creates for one circuit meter and solar source."""

    kind: MeterKind
    suggested_kind: MeterKind
    meter: str
    solar: str
    # The device's name in the settings, else the meter's; for default names.
    meter_name: str
    returned: str | None
    returned_disabled: bool
    circuit_power: str | None
    solar_power: str | None
    # Inputs of the gross energy that reset every day, in template order.
    daily: list[str] = field(default_factory=list)
    # Daily input -> the power sensor whose integral replaces it.
    integrals: dict[str, str] = field(default_factory=dict)
    # Entity ID -> factor to kWh (energy inputs) or W (power sensors).
    factors: dict[str, float] = field(default_factory=dict)
    # Power sensor -> factor to kWh of its integral.
    integral_factors: dict[str, float] = field(default_factory=dict)
    # A power sensor without a usable unit: then there is no gross power.
    unusable_power: str | None = None
    # Added to the gross energy (kWh) so it starts at START_MIN or more.
    offset: int = 0
    blocked: Blocked | None = None
    blocked_entity: str | None = None

    def block(self, reason: Blocked, entity_id: str) -> None:
        """Keep the first reason found."""
        if self.blocked is None:
            self.blocked, self.blocked_entity = reason, entity_id

    def as_dict(self) -> dict[str, Any]:
        """Return the preview of the panel."""
        return {
            "suggested_kind": self.suggested_kind,
            "kind": self.kind,
            "returned": self.returned,
            "returned_disabled": self.returned_disabled,
            "circuit_power": self.circuit_power,
            "solar_power": self.solar_power,
            "daily": self.daily,
            "integrals": [
                {"stat": stat, "power": power} for stat, power in self.integrals.items()
            ],
            "blocked": self.blocked,
            "blocked_entity": self.blocked_entity,
            "unusable_power": self.unusable_power,
            "offset": self.offset,
        }


def _check_power(hass: HomeAssistant, plan: Plan, power: str) -> None:
    """Keep the factor of a power sensor; without one, no gross power."""
    if (factor := _factor(hass, power, "power")) is None:
        if plan.unusable_power is None:
            plan.unusable_power = power
    else:
        plan.factors[power] = factor


def _value(hass: HomeAssistant, entity_id: str) -> float | None:
    """Return the current value of an input, or None if it has no number."""
    state = hass.states.get(entity_id)
    try:
        value = float(state.state) if state is not None else math.nan
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def _set_offset(
    hass: HomeAssistant, plan: Plan, inputs: list[tuple[str, str | None]]
) -> None:
    """Set the offset that starts the gross energy at START_MIN or more.

    Reads the inputs as the template will. An input replaced by a new
    integral starts at 0. Only the terms that can pull the gross below 0
    need a value: a net meter, and the returned energy that is subtracted.
    Without one the start is unknown, and the setup waits. An added term
    that counts only up (the solar, a drawn meter) counts as 0 without a
    value, which only makes the offset larger: a solar counter may be
    offline at night.
    """
    gross = 0.0
    for entity, _ in inputs:
        if entity in plan.integrals:
            continue
        subtracted = entity == plan.returned
        can_go_negative = subtracted or (
            entity == plan.meter and plan.kind is MeterKind.NET
        )
        if (value := _value(hass, entity)) is None:
            if can_go_negative:
                plan.block(Blocked.INPUT_NOT_READY, entity)
                return
            value = 0.0
        gross += (-1 if subtracted else 1) * value * plan.factors[entity]
    if gross < START_MIN:
        plan.offset = math.ceil((START_MIN - gross) / OFFSET_STEP) * OFFSET_STEP


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
    return any(_energy_or_power(hass, entity) for entity in held & made_of)


def _energy_or_power(hass: HomeAssistant, entity_id: str) -> bool:
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


def _inputs(plan: Plan) -> list[tuple[str, str | None]]:
    """Return (input, its own power sensor) in template order."""
    inputs: list[tuple[str, str | None]] = [
        (plan.meter, plan.circuit_power if plan.kind is MeterKind.NET else None)
    ]
    if plan.kind is MeterKind.DRAWS:
        if plan.returned is None:
            plan.block(Blocked.NO_RETURNED_SENSOR, plan.meter)
        else:
            if plan.returned_disabled:
                plan.block(Blocked.RETURNED_DISABLED, plan.returned)
            inputs.append((plan.returned, None))
    inputs.append((plan.solar, plan.solar_power))
    return inputs


async def async_plan(
    hass: HomeAssistant,
    prefs: Prefs,
    stat: str,
    solar: str,
    kind: MeterKind | None = None,
) -> Plan:
    """Return what the setup would create; `kind` defaults to the suggested one.

    `stat` must be an electricity device of the settings and `solar` the
    energy statistic of a solar source. The meter's own power sensor is the
    device's `stat_rate`: for a net meter it is the power of that meter. For a
    meter that only draws it is signed too, so it is the power of drawn minus
    returned, not of either alone: a daily drawn or returned meter then has
    no power of its own and blocks the setup. A sum or template helper that
    already holds the solar (or its power, or an integral of its power)
    blocks it too, and so does a check for daily inputs that could not run
    (the recorder is busy) or an input without a value (see `_set_offset`).
    A power sensor without a usable unit only leaves out the gross power.
    """
    device, source = _find(prefs, stat, solar)
    found = returned_sensor(hass, stat, exclude=used_stats(prefs))
    suggested = MeterKind.DRAWS if found else MeterKind.NET
    plan = Plan(
        kind=kind or suggested,
        suggested_kind=suggested,
        meter=stat,
        solar=solar,
        meter_name=device.get(NAME) or _name(hass, stat) or stat,
        returned=found[0] if found else None,
        returned_disabled=found[1] if found else False,
        circuit_power=device.get(RATE),
        solar_power=source.get(RATE),
    )
    # A sum or gross template that already holds the solar would count it twice.
    if _holds_solar(hass, stat, solar, plan.solar_power):
        plan.block(Blocked.SOLAR_ALREADY_IN_METER, stat)
    inputs = _inputs(plan)
    daily = await async_daily_check(hass, [entity for entity, _ in inputs])
    if daily is None:
        plan.block(Blocked.DAILY_CHECK_FAILED, stat)
        daily = set()
    for entity, power in inputs:
        if entity not in daily:
            if (factor := _factor(hass, entity, "energy")) is None:
                plan.block(Blocked.UNSUPPORTED_INPUT, entity)
            else:
                plan.factors[entity] = factor
            continue
        plan.daily.append(entity)
        if power is None:
            plan.block(Blocked.DAILY_WITHOUT_POWER, entity)
        elif (factor := _integral_factor(hass, power)) is None:
            plan.block(Blocked.UNSUPPORTED_INPUT, power)
        else:
            plan.integrals[entity] = power
            plan.integral_factors[power] = factor
    if plan.circuit_power is not None and plan.solar_power is not None:
        for power in (plan.circuit_power, plan.solar_power):
            _check_power(hass, plan, power)
    if plan.blocked is None:
        _set_offset(hass, plan, inputs)
    return plan


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


@dataclass(frozen=True)
class Names:
    """Names of the helpers; empty ones get defaults from the meter."""

    energy: str = ""
    power: str | None = None
    # Power sensor -> name of its integral (default: its name plus " energy").
    integrals: Mapping[str, str] = field(default_factory=dict)


async def async_create(
    hass: HomeAssistant, helpers: CreatedHelpers, plan: Plan, names: Names
) -> tuple[str, str | None]:
    """Create the helpers of `plan`; return the gross meter and gross power.

    First the integrals of daily inputs, then the energy template, then the
    power template when both power sensors exist and are usable. Every
    helper is recorded as created by Energy Flow Mapper. When one fails,
    every helper of this request is removed and forgotten again, and the
    error is raised.
    """
    if plan.blocked is not None:
        raise _error(plan.blocked, entity_id=plan.blocked_entity or plan.meter)
    name = names.energy.strip() or f"{plan.meter_name} gross"
    power_name = (names.power or "").strip() or f"{name} power"
    created: list[str] = []

    async def record(entry_id: str) -> None:
        created.append(entry_id)
        await helpers.async_add(entry_id)

    try:
        inputs: dict[str, str] = {}
        factors = dict(plan.factors)
        for stat, power in plan.integrals.items():
            entry_id, entity_id = await async_create_integral(
                hass,
                power,
                (names.integrals.get(power) or "").strip()
                or f"{_name(hass, power) or power} energy",
            )
            await record(entry_id)
            inputs[stat] = entity_id
            factors[entity_id] = plan.integral_factors[power]
        entry_id, gross = await async_create_template(
            hass,
            name,
            gross_energy_template(
                plan.kind,
                inputs.get(plan.meter, plan.meter),
                inputs.get(plan.solar, plan.solar),
                plan.returned,
                factors=factors,
                offset=plan.offset,
            ),
            "energy",
        )
        await record(entry_id)
        stat_rate = None
        if (
            (circuit_power := plan.circuit_power) is not None
            and (solar_power := plan.solar_power) is not None
            and plan.unusable_power is None
        ):
            entry_id, stat_rate = await async_create_template(
                hass,
                power_name,
                gross_power_template(circuit_power, solar_power, factors=factors),
                "power",
            )
            await record(entry_id)
    except Exception:
        # Nobody uses them yet; a retry would meet them.
        await _async_undo(hass, helpers, created)
        raise
    return gross, stat_rate
