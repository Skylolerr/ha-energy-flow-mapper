"""Create sum meters as Home Assistant sensor group helpers.

The helper is an ordinary helper of the `group` integration: it keeps working
without Energy Flow Mapper. The sensor group takes device class, state class and
unit from its members and converts members of one device class to one unit.
"""

from __future__ import annotations

from contextlib import suppress
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import ATTR_DEVICE_CLASS, CONF_ENTITIES, CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import (
    FlowManager,
    FlowResultType,
    InvalidData,
    UnknownFlow,
)
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


def _abort(manager: FlowManager[Any, Any, Any], flow_id: str) -> None:
    """Leave no flow behind."""
    with suppress(UnknownFlow):
        manager.async_abort(flow_id)


async def _configure(
    manager: FlowManager[Any, Any, Any], flow_id: str, user_input: dict[str, Any]
) -> Any:
    """Run one flow step; refused input and lost flows end in `sum_failed`."""
    try:
        return await manager.async_configure(flow_id, user_input)
    except (InvalidData, UnknownFlow) as err:
        _abort(manager, flow_id)
        raise _failed() from err


async def _set_options(
    hass: HomeAssistant, entry_id: str, entity_ids: list[str]
) -> str:
    """Set `ignore_non_numeric` false through the options flow; return the entity.

    The config flow's sensor step cannot set it and a missing value counts as
    true, so an unavailable member would give a smaller number, not an
    unavailable sum.
    """
    options = hass.config_entries.options
    result = await options.async_init(entry_id)
    result = await _configure(
        options,
        result["flow_id"],
        {
            CONF_ENTITIES: entity_ids,
            CONF_HIDE_MEMBERS: False,
            CONF_IGNORE_NON_NUMERIC: False,
            CONF_TYPE: "sum",
        },
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        _abort(options, result["flow_id"])
        raise _failed()
    entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
    if not entities:
        raise _failed()
    return entities[0].entity_id


async def async_create_sum(
    hass: HomeAssistant, name: str, entity_ids: list[str]
) -> tuple[str, str]:
    """Create a sum group helper of `entity_ids`; return entry ID and entity ID.

    If anything fails once the helper exists, it is removed again: it was made
    by this request, nobody uses it, and it would still ignore non-numeric
    members.
    """
    flow = hass.config_entries.flow
    result = await flow.async_init(GROUP_DOMAIN, context={"source": SOURCE_USER})
    result = await _configure(flow, result["flow_id"], {"next_step_id": "sensor"})
    result = await _configure(
        flow,
        result["flow_id"],
        {
            CONF_NAME: name,
            CONF_ENTITIES: entity_ids,
            CONF_HIDE_MEMBERS: False,
            CONF_TYPE: "sum",
        },
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        _abort(flow, result["flow_id"])
        raise _failed()
    entry_id = result["result"].entry_id
    try:
        return entry_id, await _set_options(hass, entry_id, entity_ids)
    except HomeAssistantError:
        await hass.config_entries.async_remove(entry_id)
        raise
