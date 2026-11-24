"""Create sum meters as Home Assistant sensor group helpers.

The helper is an ordinary helper of the `group` integration: it keeps working
without Energy Flow Mapper. The sensor group takes device class, state class and
unit from its members and converts members of one device class to one unit.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Collection, Mapping
from typing import Any, Final, Literal

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.const import ATTR_DEVICE_CLASS, CONF_ENTITIES, CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er

from ._flow import async_run_helper_flow
from .const import DOMAIN
from .created_helpers import CreatedHelpers
from .hierarchy import DEVICE_KEYS, KEY_SOURCES, RATE, STAT, DeviceKind
from .meter_inputs import (
    MAX_DEPTH,
    Cache,
    MeterInputs,
    direct_inputs,
    meter_inputs,
    turned_inputs,
)
from .solar_setup import (
    KIND_GROSS_ENERGY,
    KIND_SOLAR_ENERGY,
    KIND_SOLAR_POWER,
    energy_or_power,
)

_LOGGER = logging.getLogger(__name__)

GROUP_DOMAIN = "group"
CONF_HIDE_MEMBERS = "hide_members"
CONF_IGNORE_NON_NUMERIC = "ignore_non_numeric"
METER_STATE_CLASSES = {SensorStateClass.TOTAL, SensorStateClass.TOTAL_INCREASING}
DEVICE_CLASSES = {
    DeviceKind.ELECTRICITY: SensorDeviceClass.ENERGY,
    DeviceKind.WATER: SensorDeviceClass.WATER,
}


def _failed() -> HomeAssistantError:
    return HomeAssistantError(translation_domain=DOMAIN, translation_key="sum_failed")


def _not_possible(entity: str) -> ServiceValidationError:
    return ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key="sum_not_possible",
        translation_placeholders={"entity": entity},
    )


def check_rate_members(hass: HomeAssistant, entity_ids: list[str]) -> None:
    """Raise unless every rate member is an existing sensor with a state."""
    for entity_id in entity_ids:
        if not entity_id.startswith("sensor.") or hass.states.get(entity_id) is None:
            raise _not_possible(entity_id)


def check_sum_members(
    hass: HomeAssistant, entity_ids: list[str], kind: DeviceKind
) -> None:
    """Raise unless the sensors can be summed into a meter of `kind`.

    Every member must be a sensor entity with the kind's device class and a
    meter state class, and all members must share that state class: the sensor
    group would otherwise have none and the energy dashboard would reject it.
    """
    device_class = DEVICE_CLASSES[kind]
    state_classes: set[str] = set()
    for entity_id in entity_ids:
        state = hass.states.get(entity_id)
        if (
            not entity_id.startswith("sensor.")
            or state is None
            or state.attributes.get(ATTR_DEVICE_CLASS) != device_class
            or state.attributes.get("state_class") not in METER_STATE_CLASSES
        ):
            raise _not_possible(entity_id)
        state_classes.add(state.attributes["state_class"])
    if len(state_classes) > 1:
        raise ServiceValidationError(
            translation_domain=DOMAIN, translation_key="sum_state_classes_differ"
        )


SOLAR: Final = "solar"
HOLDER: Final = "holder"
type SolarHold = Literal["solar", "holder"]


def _recorded(
    hass: HomeAssistant, helpers: CreatedHelpers, kinds: Collection[str]
) -> set[str]:
    """Return the entities of our helpers whose record kind is in `kinds`."""
    registry = er.async_get(hass)
    return {
        entry.entity_id
        for entry_id, record in helpers.records().items()
        if record.get("kind") in kinds
        for entry in er.async_entries_for_config_entry(registry, entry_id)
    }


def _counted(inputs: MeterInputs) -> set[str]:
    """Return what a meter counts: with known signs, without what it subtracts."""
    if inputs["signed_known"]:
        return inputs["entities"] - inputs["subtracted"]
    return set(inputs["entities"])


def _settings_stats(prefs: Mapping[str, Any]) -> set[str]:
    """Return the statistics and sensors of the sources and devices."""
    found: set[str] = set()
    for source in prefs.get(KEY_SOURCES, []):
        found |= {
            value
            for key in ("stat_energy_from", "stat_energy_to", "stat_rate")
            if isinstance(value := source.get(key), str)
        }
        config = source.get("power_config")
        if isinstance(config, Mapping):
            found |= {value for value in config.values() if isinstance(value, str)}
    for key in DEVICE_KEYS.values():
        for device in prefs.get(key, []):
            found |= {
                value
                for field in (STAT, RATE)
                if isinstance(value := device.get(field), str)
            }
    return found


class SolarHolds:
    """Which meters are a solar, or hold one, for a sum (saved settings).

    The solar is every saved solar source's statistic and power sensor, what
    they are made of (energy and power sensors only, e.g. the inverters of a
    solar that is a sum), and the solar terms of the setup. A meter is the
    solar (`SOLAR`) when it is one of those or made only of them, at any
    level: no mark lets it into a sum. It holds the solar (`HOLDER`) when one
    of its inputs, at any depth, is the solar, without the subtracted ones
    where the signs are known; with unknown signs (`expand(`, a max group)
    every input counts. A gross meter of the setup that still reads
    something besides the solar is neither, and a path to the solar through
    one does not count (another path still does).
    """

    def __init__(
        self,
        hass: HomeAssistant,
        prefs: Mapping[str, Any],
        helpers: CreatedHelpers,
        cache: Cache | None = None,
    ) -> None:
        """Read the solar of the saved settings and of our recorded helpers."""
        self._hass = hass
        self._cache: Cache = {} if cache is None else cache
        own = {
            stat
            for source in prefs.get(KEY_SOURCES, [])
            if source.get("type") == "solar"
            for stat in (source.get("stat_energy_from"), source.get("stat_rate"))
            if isinstance(stat, str) and stat
        }
        # What the solar counts (not what it subtracts). A solar computed by
        # subtracting (house - grid import + grid export) does not make the
        # meters of the settings solar; a copy or a sum of meters does.
        others = _settings_stats(prefs) - own
        made_of: set[str] = set()
        for stat in own:
            inputs = meter_inputs(hass, stat, self._cache)
            # Computed by subtracting; a minus in a bracket makes the signs
            # unknown, but it subtracts all the same.
            computed = (inputs["signed_known"] and bool(inputs["subtracted"])) or bool(
                turned_inputs(hass, stat, self._cache)
            )
            made_of |= {
                entity
                for entity in _counted(inputs)
                if energy_or_power(hass, entity) and not (computed and entity in others)
            }
        terms = _recorded(hass, helpers, (KIND_SOLAR_ENERGY, KIND_SOLAR_POWER))
        self.solar = own | made_of | terms
        self._gross = {
            entity
            for entity in _recorded(hass, helpers, (KIND_GROSS_ENERGY,))
            if not self.is_solar(entity)
        }

    def is_solar(self, entity: str, depth: int = 0) -> bool:
        """Return True if `entity` is the solar or made only of it."""
        if entity in self.solar:
            return True
        if depth >= MAX_DEPTH:
            return False
        inputs = direct_inputs(self._hass, entity, self._cache)
        return bool(inputs) and all(self.is_solar(x, depth + 1) for x in inputs)

    def hold(self, entity: str) -> SolarHold | None:
        """Return how the meter `entity` relates to the solar; None: not at all."""
        if not self.solar:
            return None
        if self.is_solar(entity):
            return SOLAR
        if entity in self._gross:
            return None
        # Every path to the solar but those through our gross meters, which
        # count their own solar; with known signs, not the subtracted ones.
        inputs = meter_inputs(self._hass, entity, self._cache)
        reach = self._walk(entity)
        if inputs["signed_known"]:
            reach &= _counted(inputs)
        return HOLDER if reach & self.solar else None

    def _walk(self, entity: str) -> set[str]:
        """Return the inputs of `entity` at any depth, not into our gross meters.

        Every level, also deeper than `meter_inputs` reads, with a guard
        against cycles; a gross meter itself is in the result.
        """
        seen: set[str] = set()
        todo = [entity]
        while todo:
            for found in direct_inputs(self._hass, todo.pop(), self._cache):
                if found not in seen and found != entity:
                    seen.add(found)
                    if found not in self._gross:
                        todo.append(found)
        return seen

    def holds(self, entities: Collection[str]) -> dict[str, SolarHold]:
        """Return the meters of `entities` that are the solar or hold it."""
        return {
            entity: hold
            for entity in entities
            if (hold := self.hold(entity)) is not None
        }


def _with_solar(entity: str) -> ServiceValidationError:
    return ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key="sum_with_solar",
        translation_placeholders={"entity": entity},
    )


def check_no_solar(
    holds: SolarHolds,
    entity_ids: list[str],
    rate_entity_ids: list[str],
    gross_ok: Collection[str] = (),
) -> None:
    """Raise if a member is the solar, or holds it and is not in `gross_ok`.

    A group sum adds its members without knowing how a circuit meter counts,
    so a gross meter of a circuit with a solar is left to the guided setup.
    `gross_ok` are members the user says are gross meters already
    (consumption with their own solar). The solar itself never passes, and
    neither does its power as a rate member.
    """
    for entity_id in entity_ids:
        hold = holds.hold(entity_id)
        if hold == SOLAR or (hold == HOLDER and entity_id not in gross_ok):
            raise _with_solar(entity_id)
    for entity_id in rate_entity_ids:
        if holds.solar and holds.is_solar(entity_id):
            raise _with_solar(entity_id)


async def async_create_sum(
    hass: HomeAssistant, name: str, entity_ids: list[str]
) -> tuple[str, str]:
    """Create a sum group helper of `entity_ids`; return entry ID and entity ID.

    If anything fails once the helper exists, it is removed again: it was made
    by this request, nobody uses it, and it would still ignore non-numeric
    members.

    The config flow's sensor step cannot set `ignore_non_numeric` and a missing
    value counts as true, so an unavailable member would give a smaller number,
    not an unavailable sum. The options flow sets it false.
    """
    return await async_run_helper_flow(
        hass,
        GROUP_DOMAIN,
        [
            {"next_step_id": "sensor"},
            {
                CONF_NAME: name,
                CONF_ENTITIES: entity_ids,
                CONF_HIDE_MEMBERS: False,
                CONF_TYPE: "sum",
            },
        ],
        _failed,
        options_steps=[
            {
                CONF_ENTITIES: entity_ids,
                CONF_HIDE_MEMBERS: False,
                CONF_IGNORE_NON_NUMERIC: False,
                CONF_TYPE: "sum",
            }
        ],
    )


async def _async_undo(
    hass: HomeAssistant, helpers: CreatedHelpers, entry_ids: list[str]
) -> None:
    """Remove the sums of a failed request again and forget them.

    Each one on its own: one that cannot be removed is logged and kept (with
    its record), the others are still removed.
    """
    for entry_id in entry_ids:
        try:
            await hass.config_entries.async_remove(entry_id)
            await helpers.async_discard(entry_id)
        except Exception:
            _LOGGER.exception("Sum helper %s could not be removed", entry_id)


async def async_create_sums(  # noqa: PLR0913
    hass: HomeAssistant,
    helpers: CreatedHelpers,
    name: str,
    entity_ids: list[str],
    *,
    rate_entity_ids: list[str],
    rate_name: str,
) -> tuple[str, str | None]:
    """Create the sum of `entity_ids`, and one of `rate_entity_ids` if any.

    Return the meter's entity ID and the rate sum's (None without one). Both
    are remembered as created helpers. If anything fails, a cancelled request
    too, every sum made so far is removed again (shielded from a further
    cancel) and the error is raised: a retry would create a second one.
    """
    made: list[str] = []
    try:
        entry_id, entity_id = await async_create_sum(hass, name, entity_ids)
        made.append(entry_id)
        await helpers.async_add(entry_id)
        stat_rate = None
        if rate_entity_ids:
            rate_entry_id, stat_rate = await async_create_sum(
                hass, rate_name, rate_entity_ids
            )
            made.append(rate_entry_id)
            await helpers.async_add(rate_entry_id)
    except Exception, asyncio.CancelledError:
        await asyncio.shield(_async_undo(hass, helpers, made))
        raise
    return entity_id, stat_rate
