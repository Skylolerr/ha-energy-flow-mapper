"""Create sum meters as Home Assistant sensor group helpers.

The helper is an ordinary helper of the `group` integration: it keeps working
without Energy Flow Mapper. The sensor group takes device class, state class and
unit from its members and converts members of one device class to one unit.
"""

from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import ATTR_DEVICE_CLASS, CONF_ENTITIES, CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er

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

    The config flow's sensor step cannot set `ignore_non_numeric` and a missing
    value counts as true, so the options flow sets it to false afterwards: an
    unavailable member must make the sum unavailable, not a smaller number.
    """
    flow = hass.config_entries.flow
    result = await flow.async_init(GROUP_DOMAIN, context={"source": SOURCE_USER})
    result = await flow.async_configure(result["flow_id"], {"next_step_id": "sensor"})
    result = await flow.async_configure(
        result["flow_id"],
        {
            CONF_NAME: name,
            CONF_ENTITIES: entity_ids,
            CONF_HIDE_MEMBERS: False,
            CONF_TYPE: "sum",
        },
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        raise _failed()
    entry_id = result["result"].entry_id

    options = hass.config_entries.options
    result = await options.async_init(entry_id)
    result = await options.async_configure(
        result["flow_id"],
        {
            CONF_ENTITIES: entity_ids,
            CONF_HIDE_MEMBERS: False,
            CONF_IGNORE_NON_NUMERIC: False,
            CONF_TYPE: "sum",
        },
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        raise _failed()
    entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
    if not entities:
        raise _failed()
    return entry_id, entities[0].entity_id
