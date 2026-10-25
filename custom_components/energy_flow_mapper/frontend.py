"""Serve the bundles, register the admin panel and load the dashboard card."""

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

# The card: a small loader on every page, and the card itself, which the
# loader imports only when a dashboard shows the card.
CARD_FILENAME = "energy-flow-mapper-card.js"
CARD_VIEW_FILENAME = "energy-flow-mapper-card-view.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"
CARD_VIEW_URL = f"/{DOMAIN}/{CARD_VIEW_FILENAME}"
CARD_PATH = PANEL_PATH.parent / CARD_FILENAME
CARD_VIEW_PATH = PANEL_PATH.parent / CARD_VIEW_FILENAME


def _hash(*paths: Path) -> str:
    """Return a short hash of the files (blocking: run in the executor)."""
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.read_bytes())
    return digest.hexdigest()[:8]


def panel_hash() -> str:
    """Return a short hash of the panel bundle (blocking)."""
    return _hash(PANEL_PATH)


def card_hash() -> str:
    """Return a short hash of the loader and the card (blocking).

    The loader imports the card with its own query, so one hash over both
    makes browsers load either file again when one changes.
    """
    return _hash(CARD_PATH, CARD_VIEW_PATH)


async def async_register_static_path(hass: HomeAssistant) -> None:
    """Serve the bundles; called once per Home Assistant start."""
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(url, str(path), cache_headers=True)
            for url, path in (
                (PANEL_URL, PANEL_PATH),
                (CARD_URL, CARD_PATH),
                (CARD_VIEW_URL, CARD_VIEW_PATH),
            )
        ]
    )


async def async_card_url(hass: HomeAssistant) -> str:
    """Return the loader URL with version and content hash."""
    integration = await async_get_integration(hass, DOMAIN)
    content = await hass.async_add_executor_job(card_hash)
    return f"{CARD_URL}?v={integration.version}-{content}"


async def async_register_card(hass: HomeAssistant) -> None:
    """Load the card loader on every frontend page."""
    frontend.add_extra_js_url(hass, await async_card_url(hass))


async def async_unregister_card(hass: HomeAssistant) -> None:
    """Stop loading the card loader."""
    frontend.remove_extra_js_url(hass, await async_card_url(hass))


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
