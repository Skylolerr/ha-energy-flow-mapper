"""Tests for serving the panel and registering it in the sidebar."""

from __future__ import annotations

import json
from http import HTTPStatus

from homeassistant.components.frontend import DATA_EXTRA_MODULE_URL, DATA_PANELS
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

from custom_components.energy_flow_mapper.frontend import (
    CARD_PATH,
    CARD_URL,
    CARD_VIEW_PATH,
    CARD_VIEW_URL,
    PANEL_PATH,
    PANEL_URL,
    PANEL_URL_PATH,
    card_hash,
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
    version = json.loads((PANEL_PATH.parent.parent / "manifest.json").read_text())[
        "version"
    ]
    assert custom["module_url"] == f"{PANEL_URL}?v={version}-{panel_hash()}"
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
    assert len(card_hash()) == 8
    assert card_hash() != panel_hash()


async def test_card_loader_on_every_page(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """The card loader is an extra module of the frontend while the entry runs."""
    version = json.loads((PANEL_PATH.parent.parent / "manifest.json").read_text())[
        "version"
    ]
    url = f"{CARD_URL}?v={version}-{card_hash()}"
    assert hass.data[DATA_EXTRA_MODULE_URL].urls == frozenset([url])
    assert await hass.config_entries.async_unload(loaded_entry.entry_id)
    assert hass.data[DATA_EXTRA_MODULE_URL].urls == frozenset()
    assert await hass.config_entries.async_setup(loaded_entry.entry_id)
    await hass.async_block_till_done()
    assert hass.data[DATA_EXTRA_MODULE_URL].urls == frozenset([url])


async def test_card_files_are_served(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    hass_client: ClientSessionGenerator,
) -> None:
    """Loader and card are served next to the panel, as JavaScript."""
    client = await hass_client()
    for url, path in ((CARD_URL, CARD_PATH), (CARD_VIEW_URL, CARD_VIEW_PATH)):
        response = await client.get(url)
        assert response.status == HTTPStatus.OK
        assert await response.read() == path.read_bytes()
        assert "javascript" in response.headers["Content-Type"]
