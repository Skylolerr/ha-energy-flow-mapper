"""Tests for the store of the solar places."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.const import SOLAR_PLACES_STORAGE_KEY
from custom_components.energy_flow_mapper.solar_places import SolarPlaceStore


async def test_load_empty(hass: HomeAssistant) -> None:
    store = SolarPlaceStore(hass)
    await store.async_load()
    assert store.places() == {}


async def test_set_clear_and_load_again(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """A place is saved at once; None clears it; one place per solar."""
    store = SolarPlaceStore(hass)
    await store.async_load()
    assert await store.async_set("sensor.solar", "sensor.f11") == {
        "sensor.solar": "sensor.f11"
    }
    await store.async_set("sensor.solar", "sensor.f12")
    await store.async_set("sensor.other", "sensor.f13")
    assert hass_storage[SOLAR_PLACES_STORAGE_KEY]["data"] == {
        "places": {"sensor.solar": "sensor.f12", "sensor.other": "sensor.f13"}
    }

    again = SolarPlaceStore(hass)
    await again.async_load()
    assert again.places() == {
        "sensor.solar": "sensor.f12",
        "sensor.other": "sensor.f13",
    }

    assert await again.async_set("sensor.solar", None) == {"sensor.other": "sensor.f13"}
    # Clearing a solar without a place changes nothing.
    assert await again.async_set("sensor.none", None) == {"sensor.other": "sensor.f13"}
    assert hass_storage[SOLAR_PLACES_STORAGE_KEY]["data"] == {
        "places": {"sensor.other": "sensor.f13"}
    }


async def test_places_is_a_copy(hass: HomeAssistant) -> None:
    store = SolarPlaceStore(hass)
    await store.async_load()
    await store.async_set("sensor.solar", "sensor.f11")
    store.places()["sensor.solar"] = "sensor.x"
    assert store.places() == {"sensor.solar": "sensor.f11"}


async def test_load_damaged_file(
    hass: HomeAssistant, hass_storage: dict[str, Any]
) -> None:
    """Only string pairs are kept."""
    hass_storage[SOLAR_PLACES_STORAGE_KEY] = {
        "version": 1,
        "minor_version": 1,
        "key": SOLAR_PLACES_STORAGE_KEY,
        "data": {
            "places": {
                "sensor.solar": "sensor.f11",
                "sensor.bad": 3,
                "sensor.empty": "",
            }
        },
    }
    store = SolarPlaceStore(hass)
    await store.async_load()
    assert store.places() == {"sensor.solar": "sensor.f11"}

    hass_storage[SOLAR_PLACES_STORAGE_KEY]["data"] = {"places": ["sensor.solar"]}
    listed = SolarPlaceStore(hass)
    await listed.async_load()
    assert listed.places() == {}

    hass_storage[SOLAR_PLACES_STORAGE_KEY]["data"] = "nonsense"
    other = SolarPlaceStore(hass)
    await other.async_load()
    assert other.places() == {}


async def test_remove(hass: HomeAssistant, hass_storage: dict[str, Any]) -> None:
    store = SolarPlaceStore(hass)
    await store.async_load()
    await store.async_set("sensor.solar", "sensor.f11")
    await store.async_remove()
    assert store.places() == {}
    assert SOLAR_PLACES_STORAGE_KEY not in hass_storage
