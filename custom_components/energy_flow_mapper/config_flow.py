"""Config flow for Energy Flow Mapper."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN

TITLE = "Energy Flow Mapper"


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
