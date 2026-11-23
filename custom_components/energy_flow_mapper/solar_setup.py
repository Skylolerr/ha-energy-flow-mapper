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
first. Without that power sensor the setup stops with a reason.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Final

from homeassistant.const import (
    ATTR_FRIENDLY_NAME,
    ATTR_UNIT_OF_MEASUREMENT,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant, valid_entity_id
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.util.unit_conversion import EnergyConverter, PowerConverter

from .const import DOMAIN
from .created_helpers import CreatedHelpers
from .daily_reset import async_daily_resetting
from .hierarchy import KEY_DEVICES, KEY_SOURCES, NAME, RATE, STAT, Prefs, used_stats
from .hints import returned_sensor
from .integral import async_create_integral
from .template_meter import TemplateKind, async_create_template

ENERGY_DECIMALS: Final = 3
POWER_DECIMALS: Final = 1
SOLAR_STAT: Final = "stat_energy_from"


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
) -> str:
    """Return a template of signed terms (sign, variable, entity ID)."""
    sets = "".join(
        f"{{% set {var} = states('{entity}') %}}" for _, var, entity in terms
    )
    check = " and ".join(f"{var} | is_number" for _, var, _ in terms)
    parts: list[str] = []
    for sign, var, entity in terms:
        factor = factors.get(entity, 1.0)
        term = f"{var} | float" + ("" if factor == 1 else f" * {factor!r}")
        parts.append(term if not parts else f"{sign} {term}")
    return (
        f"{sets}{{% if {check} %}}{{{{ ({' '.join(parts)}) | round({decimals}) }}}}"
        "{% else %}{{ none }}{% endif %}"
    )


def gross_energy_template(
    kind: MeterKind,
    meter: str,
    solar: str,
    returned: str | None,
    *,
    factors: Mapping[str, float] | None = None,
) -> str:
    """Return the gross energy template (kWh, 3 decimals).

    Net: meter + solar. Draws: meter - returned + solar. `factors` maps an
    entity ID to the factor that turns its value into kWh (1 is left out).
    """
    terms = [("+", "meter", meter)]
    if kind is MeterKind.DRAWS:
        if returned is None:
            raise ValueError("A meter that only draws needs a returned sensor")
        terms.append(("-", "returned", returned))
    terms.append(("+", "solar", solar))
    return _template(terms, ENERGY_DECIMALS, factors or {})


def gross_power_template(
    circuit_power: str,
    solar_power: str,
    *,
    factors: Mapping[str, float] | None = None,
) -> str:
    """Return the gross power template (W, 1 decimal): circuit + solar."""
    terms = [("+", "circuit", circuit_power), ("+", "solar", solar_power)]
    return _template(terms, POWER_DECIMALS, factors or {})


def _unit(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the unit of the state, or of the registry entry without one."""
    state = hass.states.get(entity_id)
    if state is not None and (unit := state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)):
        return str(unit)
    entry = er.async_get(hass).async_get(entity_id)
    return entry.unit_of_measurement if entry is not None else None


def _factor(hass: HomeAssistant, entity_id: str, kind: TemplateKind) -> float | None:
    """Return the factor of an input a template can read, or None."""
    if not valid_entity_id(entity_id):
        return None
    return unit_factor(_unit(hass, entity_id), kind)


def _friendly_name(hass: HomeAssistant, entity_id: str) -> str | None:
    state = hass.states.get(entity_id)
    name = state.attributes.get(ATTR_FRIENDLY_NAME) if state is not None else None
    return str(name) if name else None


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
        }


def _check_power(hass: HomeAssistant, plan: Plan, power: str) -> None:
    if (factor := _factor(hass, power, "power")) is None:
        plan.block(Blocked.UNSUPPORTED_INPUT, power)
    else:
        plan.factors[power] = factor


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
    no power of its own and blocks the setup.
    """
    device, source = _find(prefs, stat, solar)
    found = returned_sensor(hass, stat, exclude=used_stats(prefs))
    suggested = MeterKind.DRAWS if found else MeterKind.NET
    plan = Plan(
        kind=kind or suggested,
        suggested_kind=suggested,
        meter=stat,
        solar=solar,
        meter_name=device.get(NAME) or _friendly_name(hass, stat) or stat,
        returned=found[0] if found else None,
        returned_disabled=found[1] if found else False,
        circuit_power=device.get(RATE),
        solar_power=source.get(RATE),
    )
    inputs = _inputs(plan)
    daily = await async_daily_resetting(hass, [entity for entity, _ in inputs])
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
        else:
            plan.integrals[entity] = power
            _check_power(hass, plan, power)
    if plan.circuit_power is not None and plan.solar_power is not None:
        for power in (plan.circuit_power, plan.solar_power):
            if power not in plan.factors:
                _check_power(hass, plan, power)
    return plan


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
    power template when both power sensors exist. Every helper is recorded
    as created by Energy Flow Mapper. When one fails, every helper of this
    request is removed and forgotten again, and the error is raised.
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
                or f"{_friendly_name(hass, power) or power} energy",
            )
            await record(entry_id)
            inputs[stat] = entity_id
            # The integral counts in k<power unit>h: kWh for W, MWh for kW.
            factors[entity_id] = plan.factors[power]
        entry_id, gross = await async_create_template(
            hass,
            name,
            gross_energy_template(
                plan.kind,
                inputs.get(plan.meter, plan.meter),
                inputs.get(plan.solar, plan.solar),
                plan.returned,
                factors=factors,
            ),
            "energy",
        )
        await record(entry_id)
        stat_rate = None
        if plan.circuit_power is not None and plan.solar_power is not None:
            entry_id, stat_rate = await async_create_template(
                hass,
                power_name,
                gross_power_template(
                    plan.circuit_power, plan.solar_power, factors=factors
                ),
                "power",
            )
            await record(entry_id)
    except Exception:
        # Nobody uses them yet; a retry would meet them.
        for entry_id in reversed(created):
            await hass.config_entries.async_remove(entry_id)
            await helpers.async_discard(entry_id)
        raise
    return gross, stat_rate
