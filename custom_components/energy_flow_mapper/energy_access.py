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
from .hierarchy import KEY_DEVICES, KEY_DEVICES_WATER, KEY_SOURCES, prefs_hash

REQUIRED_NAMES = (
    "async_get_manager",
    "DEVICE_CONSUMPTION_SCHEMA",
    "ENERGY_SOURCE_SCHEMA",
)


class PrefsChangedError(Exception):
    """The preferences changed since they were read; nothing was written."""


def _empty_prefs() -> dict[str, Any]:
    return {KEY_SOURCES: [], KEY_DEVICES: [], KEY_DEVICES_WATER: []}


def _prefs(manager: Any) -> dict[str, Any]:
    if manager.data is None:
        return _empty_prefs()
    return _empty_prefs() | deepcopy(dict(manager.data))


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
    return _prefs(await energy_data.async_get_manager(hass))


def validate(update: Mapping[str, list[Any]]) -> dict[str, Any]:
    """Check complete lists with Home Assistant's own schemas.

    Returns the validated lists, or raises when Home Assistant rejects them.
    """
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
    return validated


def schema_error(update: Mapping[str, list[Any]]) -> str | None:
    """Return Home Assistant's (English) message if it rejects the lists."""
    try:
        validate(update)
    except HomeAssistantError as err:
        return (err.translation_placeholders or {}).get("error", str(err))
    return None


async def async_write(
    hass: HomeAssistant,
    update: Mapping[str, list[Any]],
    expected_hash: str | None = None,
) -> None:
    """Validate complete lists with Home Assistant's own schemas and store them.

    With `expected_hash`, raise PrefsChangedError instead of writing when the
    current preferences no longer have that hash. Nothing awaits between that
    check and the start of the update.
    """
    validated = validate(update)
    manager = await energy_data.async_get_manager(hass)
    if expected_hash is not None and prefs_hash(_prefs(manager)) != expected_hash:
        raise PrefsChangedError
    await manager.async_update(validated)  # type: ignore[arg-type]
