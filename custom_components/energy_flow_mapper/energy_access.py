"""Read and write Home Assistant's energy preferences.

This is the only module that uses internals of the `energy` integration. Every
write goes through the same schemas the energy settings page uses, and always
contains complete lists, because the energy manager replaces each key it gets.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from copy import deepcopy
from typing import Any

import probatio as vol
from homeassistant.components.energy import data as energy_data
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from .const import DOMAIN
from .hierarchy import KEY_DEVICES, KEY_DEVICES_WATER, KEY_SOURCES

REQUIRED_NAMES = (
    "async_get_manager",
    "DEVICE_CONSUMPTION_SCHEMA",
    "ENERGY_SOURCE_SCHEMA",
)


def _empty_prefs() -> dict[str, Any]:
    return {KEY_SOURCES: [], KEY_DEVICES: [], KEY_DEVICES_WATER: []}


def unsupported_error() -> HomeAssistantError:
    """Return the error raised when the energy API does not fit."""
    return HomeAssistantError(
        translation_domain=DOMAIN, translation_key="unsupported_energy_api"
    )


async def async_is_supported(hass: HomeAssistant) -> bool:
    """Return True if this Home Assistant release has the expected energy API."""
    if any(not hasattr(energy_data, name) for name in REQUIRED_NAMES):
        return False
    manager = await energy_data.async_get_manager(hass)
    return hasattr(manager, "data") and callable(getattr(manager, "async_update", None))


async def async_get_prefs(hass: HomeAssistant) -> dict[str, Any]:
    """Return a fresh deep copy of the energy preferences.

    An energy dashboard that was never set up counts as empty configuration.
    """
    manager = await energy_data.async_get_manager(hass)
    if manager.data is None:
        return _empty_prefs()
    return _empty_prefs() | deepcopy(dict(manager.data))


async def async_write(hass: HomeAssistant, update: Mapping[str, list[Any]]) -> None:
    """Validate complete lists with Home Assistant's own schemas and store them."""
    device_list = vol.Schema([energy_data.DEVICE_CONSUMPTION_SCHEMA])
    schemas: dict[str, Callable[[Any], Any]] = {
        KEY_SOURCES: energy_data.ENERGY_SOURCE_SCHEMA,
        KEY_DEVICES: device_list,
        KEY_DEVICES_WATER: device_list,
    }
    validated: dict[str, Any] = {}
    for key, value in update.items():
        try:
            validated[key] = schemas[key](deepcopy(value))
        except vol.Invalid as err:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="rejected_by_home_assistant",
                translation_placeholders={"error": str(err)},
            ) from err
    manager = await energy_data.async_get_manager(hass)
    await manager.async_update(validated)  # type: ignore[arg-type]
