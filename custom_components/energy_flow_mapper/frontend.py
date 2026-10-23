"""Serve the panel bundle and register the admin panel in the sidebar."""

from __future__ import annotations

import hashlib
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http.server import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.loader import async_get_integration

from .const import DOMAIN

PANEL_FILENAME = "energy-flow-mapper-panel.js"
PANEL_URL = f"/{DOMAIN}/{PANEL_FILENAME}"
PANEL_PATH = Path(__file__).parent / "frontend" / PANEL_FILENAME
PANEL_URL_PATH = "energy-flow-mapper"
PANEL_ELEMENT = "energy-flow-mapper-panel"
PANEL_TITLE = "Energy Flow Mapper"
PANEL_ICON = "mdi:transit-connection-variant"


def panel_hash() -> str:
    """Return a short hash of the bundle (blocking: run in the executor)."""
    return hashlib.sha256(PANEL_PATH.read_bytes()).hexdigest()[:8]


async def async_register_static_path(hass: HomeAssistant) -> None:
    """Serve the panel bundle; called once per Home Assistant start."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(PANEL_URL, str(PANEL_PATH), cache_headers=True)]
    )


async def async_register_panel(hass: HomeAssistant) -> None:
    """Add the admin-only panel to the sidebar.

    The module URL carries version and content hash, so browsers load a
    changed bundle at once instead of using their cached copy.
    """
    integration = await async_get_integration(hass, DOMAIN)
    content = await hass.async_add_executor_job(panel_hash)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_ELEMENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=f"{PANEL_URL}?v={integration.version}-{content}",
        require_admin=True,
    )


def async_unregister_panel(hass: HomeAssistant) -> None:
    """Remove the panel from the sidebar."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
