"""Tests for the solar places over the WebSocket API."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.const import DOMAIN

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import _meter
from .test_sum_meter import _template
from .test_websocket import send

SOLAR = "sensor.solar_energy"


@pytest.mark.usefixtures("loaded_entry")
async def test_place_solar_set_and_clear(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A place is written at once and comes back with `get`."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/place_solar",
        solar=SOLAR,
        stat="sensor.garage_energy",
    )
    assert response["result"] == {"places": {SOLAR: "sensor.garage_energy"}}
    got = (await send(hass_ws_client, hass, type=f"{DOMAIN}/get"))["result"]
    assert got["solar_places"] == {SOLAR: "sensor.garage_energy"}
    response = await send(
        hass_ws_client, hass, type=f"{DOMAIN}/place_solar", solar=SOLAR, stat=None
    )
    assert response["result"] == {"places": {}}


async def test_place_solar_needs_an_admin(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    loaded_entry: MockConfigEntry,
) -> None:
    msg: dict[str, Any] = {"type": f"{DOMAIN}/place_solar", "solar": SOLAR, "stat": "x"}
    response = await send(hass_ws_client, hass, hass_read_only_access_token, **msg)
    assert response["error"]["code"] == "unauthorized"
    assert loaded_entry.runtime_data.solar_places.places() == {}


@pytest.mark.usefixtures("loaded_entry")
async def test_get_names_the_solars_each_meter_counts(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """`solar_counted`: the meters that count a solar, by the hints' rule.

    A free gross meter counts it too (the draft may use it); the solar itself
    and meters without it are left out.
    """
    for meter in ("sensor.garage_energy", SOLAR):
        _meter(hass, meter)
    _template(
        hass,
        "sensor.garage_gross",
        "{{ states('sensor.garage_energy') | float"
        " + states('sensor.solar_energy') | float }}",
    )
    got = (await send(hass_ws_client, hass, type=f"{DOMAIN}/get"))["result"]
    assert got["solar_counted"] == {"sensor.garage_gross": [SOLAR]}
    assert got["solar_places"] == {}


async def test_card_shows_the_places_of_its_devices(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    loaded_entry: MockConfigEntry,
) -> None:
    """The card gets the places of solar sources at devices of its list only."""
    places = loaded_entry.runtime_data.solar_places
    await places.async_set(SOLAR, "sensor.garage_energy")
    await places.async_set("sensor.gone_solar", "sensor.garage_energy")
    await places.async_set("sensor.battery_out", "sensor.garage_energy")
    card = await send(
        hass_ws_client, hass, hass_read_only_access_token, type=f"{DOMAIN}/card"
    )
    assert card["result"]["solar_places"] == {SOLAR: "sensor.garage_energy"}
    await places.async_set(SOLAR, "sensor.not_a_device")
    card = await send(
        hass_ws_client, hass, hass_read_only_access_token, type=f"{DOMAIN}/card"
    )
    assert card["result"]["solar_places"] == {}
    water = await send(
        hass_ws_client,
        hass,
        hass_read_only_access_token,
        type=f"{DOMAIN}/card",
        kind="water",
    )
    assert water["result"]["solar_places"] == {}
