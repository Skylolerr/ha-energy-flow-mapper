"""Tests for serving the panel and registering it in the sidebar."""

from __future__ import annotations

from http import HTTPStatus

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.energy_flow_mapper.frontend import (
    PANEL_PATH,
    PANEL_URL,
    PANEL_URL_PATH,
    panel_hash,
)


async def test_panel_registered_for_admins(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """The panel is in the sidebar, admin-only, with a versioned module URL."""
    panel = hass.data[DATA_PANELS][PANEL_URL_PATH]
    assert panel.component_name == "custom"
    assert panel.sidebar_title == "Energy Flow Mapper"
    assert panel.sidebar_icon == "mdi:transit-connection-variant"
    assert panel.require_admin
    custom = panel.config["_panel_custom"]
    assert custom["name"] == "energy-flow-mapper-panel"
    assert custom["module_url"] == f"{PANEL_URL}?v=0.1.0-{panel_hash()}"
    assert not custom["embed_iframe"]


async def test_panel_removed_on_unload_and_back_on_reload(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """Unloading removes the panel; setting up again adds it once."""
    assert await hass.config_entries.async_unload(loaded_entry.entry_id)
    assert PANEL_URL_PATH not in hass.data[DATA_PANELS]
    assert await hass.config_entries.async_setup(loaded_entry.entry_id)
    await hass.async_block_till_done()
    assert PANEL_URL_PATH in hass.data[DATA_PANELS]


async def test_bundle_is_served(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    hass_client: ClientSessionGenerator,
) -> None:
    """The committed bundle is served as JavaScript."""
    client = await hass_client()
    response = await client.get(PANEL_URL)
    assert response.status == HTTPStatus.OK
    assert await response.read() == PANEL_PATH.read_bytes()
    assert "javascript" in response.headers["Content-Type"]


def test_panel_hash_follows_content() -> None:
    """The hash is the start of the SHA-256 of the bundle."""
    assert len(panel_hash()) == 8
