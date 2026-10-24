"""Config flow and options for Energy Flow Mapper."""

from __future__ import annotations

from typing import Any

import probatio as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
    OptionsFlowWithReload,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
)

from .const import (
    CONF_MAX_BACKUPS,
    DEFAULT_MAX_BACKUPS,
    DOMAIN,
    MAX_BACKUPS,
    MIN_BACKUPS,
)

TITLE = "Energy Flow Mapper"

OPTIONS_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_MAX_BACKUPS): vol.All(
            NumberSelector(
                NumberSelectorConfig(
                    min=MIN_BACKUPS,
                    max=MAX_BACKUPS,
                    step=1,
                    mode=NumberSelectorMode.BOX,
                )
            ),
            vol.Coerce(int),
        ),
    }
)


class EnergyFlowMapperConfigFlow(ConfigFlow, domain=DOMAIN):
    """Set up the integration with a single confirmation step."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm the setup; a second entry is refused by Home Assistant."""
        if user_input is not None:
            return self.async_create_entry(title=TITLE, data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Return the options flow."""
        return EnergyFlowMapperOptionsFlow()


class EnergyFlowMapperOptionsFlow(OptionsFlowWithReload):
    """Set how many backups are kept; the entry reloads to apply it."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Show and store the options."""
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                OPTIONS_SCHEMA,
                {
                    CONF_MAX_BACKUPS: self.config_entry.options.get(
                        CONF_MAX_BACKUPS, DEFAULT_MAX_BACKUPS
                    )
                },
            ),
        )
