"""Create integral helpers that turn a power or flow sensor into a meter.

The helper is an ordinary Home Assistant helper of the `integration`
integration: it keeps working without Energy Flow Mapper.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass
from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import (
    ATTR_UNIT_OF_MEASUREMENT,
    CONF_METHOD,
    CONF_NAME,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er

from .candidates import FLOW_TIME_UNITS, INTEGRATION_DOMAIN
from .const import DOMAIN
from .hierarchy import DeviceKind

# Left Riemann sum suits power that changes in steps (smart plugs); updating at
# least every 5 minutes keeps the meter moving while the power stays constant.
INTEGRAL_OPTIONS = {
    CONF_METHOD: "left",
    "round": 3,
    "unit_prefix": "k",
    "unit_time": "h",
    "max_sub_interval": {"hours": 0, "minutes": 5, "seconds": 0},
}


def entity_unit(hass: HomeAssistant, entity_id: str) -> str | None:
    """Return the unit of the state, or of the registry entry without one."""
    state = hass.states.get(entity_id)
    if state is not None and (unit := state.attributes.get(ATTR_UNIT_OF_MEASUREMENT)):
        return str(unit)
    entry = er.async_get(hass).async_get(entity_id)
    return entry.unit_of_measurement if entry is not None else None


def energy_unit(power_unit: str | None) -> str:
    """Return the unit the integral of a power sensor counts in.

    W gets the prefix k (kWh); a unit that has a prefix already counts in its
    own (kW gives kWh, not "kkWh" in steps of 1 kWh). Without a unit, W.
    """
    if power_unit in (None, UnitOfPower.WATT):
        return UnitOfEnergy.KILO_WATT_HOUR
    return f"{power_unit}h"


def _options(hass: HomeAssistant, source: str, kind: DeviceKind) -> dict[str, Any]:
    """Return the helper options: kWh for power, the flow's volume for water.

    A power in W gets the prefix k; any other power unit has its own prefix
    and gets none. A flow is integrated over the time unit of its own unit
    and without a prefix, so L/min becomes L and m³/h becomes m³.
    """
    without_prefix = {
        key: value for key, value in INTEGRAL_OPTIONS.items() if key != "unit_prefix"
    }
    if kind is DeviceKind.ELECTRICITY:
        unit = entity_unit(hass, source)
        return INTEGRAL_OPTIONS if unit in (None, UnitOfPower.WATT) else without_prefix
    state = hass.states.get(source)
    unit = state.attributes.get(ATTR_UNIT_OF_MEASUREMENT) if state else None
    if unit not in FLOW_TIME_UNITS:
        raise _failed()
    return without_prefix | {"unit_time": FLOW_TIME_UNITS[unit]}


def _failed() -> HomeAssistantError:
    return HomeAssistantError(
        translation_domain=DOMAIN, translation_key="integral_failed"
    )


async def async_create_integral(
    hass: HomeAssistant,
    source: str,
    name: str,
    kind: DeviceKind = DeviceKind.ELECTRICITY,
) -> tuple[str, str]:
    """Create an integral helper for `source`; return entry ID and entity ID.

    The integral of a flow gets no device class from the helper, so it is
    shown as water through the entity registry, like "Show as" in the UI;
    the energy dashboard only accepts water meters with that class.
    """
    options = _options(hass, source, kind)
    result = await hass.config_entries.flow.async_init(
        INTEGRATION_DOMAIN, context={"source": SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_NAME: name, "source": source, **options},
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        raise _failed()
    entry_id = result["result"].entry_id
    entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
    if not entities:
        # Do not leave the entry behind; a retry would meet it.
        await hass.config_entries.async_remove(entry_id)
        raise _failed()
    entity_id = entities[0].entity_id
    if kind is DeviceKind.WATER:
        er.async_get(hass).async_update_entity(
            entity_id, device_class=SensorDeviceClass.WATER
        )
    return entry_id, entity_id
