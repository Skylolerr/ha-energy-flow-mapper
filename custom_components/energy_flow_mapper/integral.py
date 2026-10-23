"""Create integral helpers that turn a power sensor into an energy meter.

The helper is an ordinary Home Assistant helper of the `integration`
integration: it keeps working without Energy Flow Mapper.
"""

from __future__ import annotations

from homeassistant.config_entries import SOURCE_USER
from homeassistant.const import CONF_METHOD, CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er

from .candidates import INTEGRATION_DOMAIN
from .const import DOMAIN

# Left Riemann sum suits power that changes in steps (smart plugs); updating at
# least every 5 minutes keeps the meter moving while the power stays constant.
INTEGRAL_OPTIONS = {
    CONF_METHOD: "left",
    "round": 3,
    "unit_prefix": "k",
    "unit_time": "h",
    "max_sub_interval": {"hours": 0, "minutes": 5, "seconds": 0},
}


def _failed() -> HomeAssistantError:
    return HomeAssistantError(
        translation_domain=DOMAIN, translation_key="integral_failed"
    )


async def async_create_integral(
    hass: HomeAssistant, source: str, name: str
) -> tuple[str, str]:
    """Create an integral helper for `source`; return entry ID and entity ID."""
    result = await hass.config_entries.flow.async_init(
        INTEGRATION_DOMAIN, context={"source": SOURCE_USER}
    )
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {CONF_NAME: name, "source": source, **INTEGRAL_OPTIONS},
    )
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        raise _failed()
    entry_id = result["result"].entry_id
    entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
    if not entities:
        raise _failed()
    return entry_id, entities[0].entity_id
