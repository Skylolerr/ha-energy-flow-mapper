"""Tests for reading and writing the energy preferences."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.components.energy.data import async_get_manager
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from custom_components.energy_flow_mapper import energy_access

from .conftest import ENERGY_PREFS


async def test_get_prefs_is_a_deep_copy(hass: HomeAssistant) -> None:
    """Changing the returned prefs does not touch the manager's data."""
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs == ENERGY_PREFS
    prefs["device_consumption"][0]["name"] = "Changed"
    manager = await async_get_manager(hass)
    assert manager.data is not None
    assert manager.data["device_consumption"][0]["name"] == "Main"


@pytest.mark.parametrize("energy_prefs", [None])
async def test_get_prefs_never_set_up(hass: HomeAssistant) -> None:
    """An energy dashboard that was never set up is empty configuration."""
    assert await energy_access.async_get_prefs(hass) == {
        "energy_sources": [],
        "device_consumption": [],
        "device_consumption_water": [],
    }


@pytest.mark.parametrize(
    "energy_prefs", [{"energy_sources": [], "device_consumption": []}]
)
async def test_get_prefs_adds_missing_keys(hass: HomeAssistant) -> None:
    """Keys missing on disk are filled in."""
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs["device_consumption_water"] == []


async def test_write_replaces_only_given_keys(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Only the given key changes; sources with their prices stay as they are."""
    devices = [{"stat_consumption": "sensor.only"}]
    await energy_access.async_write(hass, {"device_consumption": devices})
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs["device_consumption"] == devices
    assert prefs["energy_sources"] == ENERGY_PREFS["energy_sources"]
    assert prefs["energy_sources"][0]["number_energy_price"] == 0.3


@pytest.mark.parametrize("energy_prefs", [None])
async def test_write_without_previous_prefs(hass: HomeAssistant) -> None:
    """Writing works when the energy dashboard was never set up."""
    await energy_access.async_write(
        hass, {"device_consumption": [{"stat_consumption": "sensor.a"}]}
    )
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs["device_consumption"] == [{"stat_consumption": "sensor.a"}]
    assert prefs["energy_sources"] == []


@pytest.mark.parametrize(
    "update",
    [
        {"device_consumption": [{"stat_consumption": "sensor.a", "bogus": 1}]},
        {"device_consumption": [{"name": "no statistic"}]},
        {"energy_sources": [{"type": "grid", "cost_adjustment_day": 0}]},
    ],
)
async def test_write_uses_home_assistant_schemas(
    hass: HomeAssistant, update: dict[str, Any]
) -> None:
    """Data the energy settings page would reject is not written."""
    with pytest.raises(HomeAssistantError) as err:
        await energy_access.async_write(hass, update)
    assert err.value.translation_key == "rejected_by_home_assistant"
    assert await energy_access.async_get_prefs(hass) == ENERGY_PREFS


async def test_write_notifies_listeners(hass: HomeAssistant) -> None:
    """Energy update listeners (e.g. cost sensors) are informed."""
    calls: list[bool] = []

    async def listener() -> None:
        calls.append(True)

    manager = await async_get_manager(hass)
    manager.async_listen_updates(listener)
    await energy_access.async_write(hass, {"device_consumption": []})
    assert calls == [True]


async def test_supported(hass: HomeAssistant) -> None:
    """The installed Home Assistant release has the expected API."""
    assert await energy_access.async_is_supported(hass)
    assert energy_access.unsupported_error().translation_key == (
        "unsupported_energy_api"
    )
