"""Create sum meters as Home Assistant sensor group helpers.

The helper is an ordinary helper of the `group` integration: it keeps working
without Energy Flow Mapper. The sensor group takes device class, state class and
unit from its members and converts members of one device class to one unit.
"""

from __future__ import annotations

import asyncio
from collections.abc import Collection

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.const import ATTR_DEVICE_CLASS, CONF_ENTITIES, CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er

from ._flow import async_run_helper_flow
from .const import DOMAIN
from .created_helpers import CreatedHelpers
from .hierarchy import DeviceKind
from .meter_inputs import Cache, counted_inputs
from .solar_setup import KIND_GROSS_ENERGY

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


@callback
def gross_meter_stats(hass: HomeAssistant, helpers: CreatedHelpers) -> set[str]:
    """Return the gross energy meters the solar setup made (from their records)."""
    registry = er.async_get(hass)
    return {
        entry.entity_id
        for entry_id, record in helpers.records().items()
        if record.get("kind") == KIND_GROSS_ENERGY
        for entry in er.async_entries_for_config_entry(registry, entry_id)
    }


def check_no_solar(
    hass: HomeAssistant,
    entity_ids: list[str],
    solar: Collection[str],
    gross: Collection[str] = (),
) -> None:
    """Raise if a member is a solar meter or holds one (`solar`: its stats and powers).

    A group sum adds its members without knowing how a circuit meter counts,
    so a gross meter of a circuit with a solar is left to the guided setup.
    `gross` are members known to be gross meters already (consumption with
    their own solar: ours, or marked so by the user); they may hold a solar.
    A solar's own stat or power never passes.
    """
    cache: Cache = {}
    for entity_id in entity_ids:
        if entity_id in solar or (
            entity_id not in gross
            and set(
                counted_inputs(hass, [entity_id], cache).get(entity_id, [])
            ).intersection(solar)
        ):
            raise ServiceValidationError(
                translation_domain=DOMAIN,
                translation_key="sum_with_solar",
                translation_placeholders={"entity": entity_id},
            )


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
    """Remove the sums of a failed request again and forget them."""
    for entry_id in entry_ids:
        await hass.config_entries.async_remove(entry_id)
        await helpers.async_discard(entry_id)


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
