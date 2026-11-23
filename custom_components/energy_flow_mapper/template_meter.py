"""Create gross meters as Home Assistant template sensor helpers.

The helper is an ordinary helper of the `template` integration: it keeps
working without Energy Flow Mapper. Its state is a Jinja template; unit,
device class and state class are set so the energy dashboard accepts it.
"""

from __future__ import annotations

from typing import Literal

from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.const import (
    CONF_DEVICE_CLASS,
    CONF_NAME,
    CONF_STATE,
    CONF_UNIT_OF_MEASUREMENT,
    UnitOfEnergy,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from ._flow import async_run_helper_flow
from .const import DOMAIN

TEMPLATE_DOMAIN = "template"
CONF_STATE_CLASS = "state_class"
TemplateKind = Literal["energy", "power"]
# Plain strings, as the helper UI sends them.
SENSOR_OPTIONS: dict[TemplateKind, dict[str, str]] = {
    "energy": {
        CONF_UNIT_OF_MEASUREMENT: UnitOfEnergy.KILO_WATT_HOUR.value,
        CONF_DEVICE_CLASS: SensorDeviceClass.ENERGY.value,
        # Every change is booked 1:1: a dip of an input that lags cancels
        # instead of counting as a meter reset.
        CONF_STATE_CLASS: SensorStateClass.TOTAL.value,
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


async def async_create_template(
    hass: HomeAssistant,
    name: str,
    state: str,
    kind: TemplateKind,
    *,
    state_class: SensorStateClass | str | None = None,
) -> tuple[str, str]:
    """Create a template sensor helper; return entry ID and entity ID.

    `kind` "energy" gives a kWh meter (`total`, or `state_class`), "power" a
    W sensor (`measurement`). If anything fails once the helper exists, it is
    removed again: it was made by this request and nobody uses it.
    """
    options = dict(SENSOR_OPTIONS[kind])
    if state_class is not None:
        options[CONF_STATE_CLASS] = str(state_class)
    return await async_run_helper_flow(
        hass,
        TEMPLATE_DOMAIN,
        [
            {"next_step_id": "sensor"},
            {CONF_NAME: name, CONF_STATE: state, **options},
        ],
        _failed,
    )
