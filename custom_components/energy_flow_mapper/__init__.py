"""The Energy Flow Mapper integration."""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.typing import ConfigType

from . import energy_access
from .backups import BackupStore
from .const import (
    CONF_MAX_BACKUPS,
    DEFAULT_MAX_BACKUPS,
    DOMAIN,
    ISSUE_UNSUPPORTED_ENERGY_API,
    LOGGER,
)
from .created_helpers import CreatedHelpers
from .frontend import (
    async_register_card,
    async_register_panel,
    async_register_static_path,
    async_unregister_card,
    async_unregister_panel,
)
from .models import EnergyFlowMapperConfigEntry, EnergyFlowMapperData
from .websocket import async_setup_websocket

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the WebSocket commands and serve the bundles (once per start)."""
    async_setup_websocket(hass)
    await async_register_static_path(hass)
    return True


async def async_setup_entry(
    hass: HomeAssistant, entry: EnergyFlowMapperConfigEntry
) -> bool:
    """Set up the integration.

    If the energy API of this Home Assistant release does not fit, the entry
    still loads and shows a repair issue; all commands then refuse to work.
    """
    supported = await energy_access.async_is_supported(hass)
    if supported:
        ir.async_delete_issue(hass, DOMAIN, ISSUE_UNSUPPORTED_ENERGY_API)
    else:
        LOGGER.error("The energy API of this Home Assistant release is not supported")
        ir.async_create_issue(
            hass,
            DOMAIN,
            ISSUE_UNSUPPORTED_ENERGY_API,
            is_fixable=False,
            severity=ir.IssueSeverity.ERROR,
            translation_key=ISSUE_UNSUPPORTED_ENERGY_API,
        )
    backups = BackupStore(
        hass, entry.options.get(CONF_MAX_BACKUPS, DEFAULT_MAX_BACKUPS)
    )
    await backups.async_load()
    helpers = CreatedHelpers(hass)
    await helpers.async_load()
    card_url = await async_register_card(hass)
    entry.runtime_data = EnergyFlowMapperData(
        backups=backups, helpers=helpers, supported=supported, card_url=card_url
    )
    await async_register_panel(hass)
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: EnergyFlowMapperConfigEntry
) -> bool:
    """Remove the panel and the card; backups are always saved immediately."""
    async_unregister_panel(hass)
    async_unregister_card(hass, entry.runtime_data.card_url)
    return True


async def async_remove_entry(
    hass: HomeAssistant, entry: EnergyFlowMapperConfigEntry
) -> None:
    """Delete the stores; energy preferences and created helpers stay."""
    await BackupStore(hass).async_remove()
    await CreatedHelpers(hass).async_remove()
    ir.async_delete_issue(hass, DOMAIN, ISSUE_UNSUPPORTED_ENERGY_API)
