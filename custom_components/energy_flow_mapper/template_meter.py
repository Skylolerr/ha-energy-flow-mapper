"""Create gross meters as Home Assistant template sensor helpers.

The helper is an ordinary helper of the `template` integration: it keeps
working without Energy Flow Mapper. Its state is a Jinja template; unit,
device class and state class are set so the energy dashboard accepts it.
"""

from __future__ import annotations

from contextlib import suppress
from typing import Any, Literal

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import (
    CONF_DEVICE_CLASS,
    CONF_NAME,
    CONF_STATE,
    CONF_UNIT_OF_MEASUREMENT,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import (
    FlowManager,
    FlowResultType,
    InvalidData,
    UnknownFlow,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN

TEMPLATE_DOMAIN = "template"
CONF_STATE_CLASS = "state_class"
TemplateKind = Literal["energy", "power"]
# Plain strings, as the helper UI sends them.
SENSOR_OPTIONS: dict[TemplateKind, dict[str, str]] = {
    "energy": {
        CONF_UNIT_OF_MEASUREMENT: UnitOfEnergy.KILO_WATT_HOUR.value,
        CONF_DEVICE_CLASS: SensorDeviceClass.ENERGY.value,
        CONF_STATE_CLASS: SensorStateClass.TOTAL_INCREASING.value,
    },
    "power": {
        CONF_UNIT_OF_MEASUREMENT: UnitOfPower.WATT.value,
        CONF_DEVICE_CLASS: SensorDeviceClass.POWER.value,
        CONF_STATE_CLASS: SensorStateClass.MEASUREMENT.value,
    },
}


def _failed() -> HomeAssistantError:
    return HomeAssistantError(
        translation_domain=DOMAIN, translation_key="template_failed"
    )


def _abort(manager: FlowManager[Any, Any, Any], flow_id: str) -> None:
    """Leave no flow behind."""
    with suppress(UnknownFlow):
        manager.async_abort(flow_id)


async def _configure(
    manager: FlowManager[Any, Any, Any], flow_id: str, user_input: dict[str, Any]
) -> Any:
    """Run one flow step; refused input and lost flows end in `template_failed`."""
    try:
        return await manager.async_configure(flow_id, user_input)
    except (InvalidData, UnknownFlow) as err:
        _abort(manager, flow_id)
        raise _failed() from err


async def async_create_template(
    hass: HomeAssistant, name: str, state: str, kind: TemplateKind
) -> tuple[str, str]:
    """Create a template sensor helper; return entry ID and entity ID.

    `kind` "energy" gives a kWh meter (`total_increasing`), "power" a W
    sensor (`measurement`). If anything fails once the helper exists, it is
    removed again: it was made by this request and nobody uses it.
    """
    flow = hass.config_entries.flow
    result = await flow.async_init(TEMPLATE_DOMAIN, context={"source": SOURCE_USER})
    result = await _configure(flow, result["flow_id"], {"next_step_id": "sensor"})
    result = await _configure(
        flow,
        result["flow_id"],
        {CONF_NAME: name, CONF_STATE: state, **SENSOR_OPTIONS[kind]},
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        _abort(flow, result["flow_id"])
        raise _failed()
    entry_id = result["result"].entry_id
    entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
    if not entities:
        await hass.config_entries.async_remove(entry_id)
        raise _failed()
    return entry_id, entities[0].entity_id
