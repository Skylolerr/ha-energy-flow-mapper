"""Create sum meters as Home Assistant sensor group helpers.

The helper is an ordinary helper of the `group` integration: it keeps working
without Energy Flow Mapper. The sensor group takes device class, state class and
unit from its members and converts members of one device class to one unit.
"""

from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.const import ATTR_DEVICE_CLASS, CONF_ENTITIES, CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from ._flow import async_run_helper_flow
from .const import DOMAIN
from .hierarchy import DeviceKind

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
