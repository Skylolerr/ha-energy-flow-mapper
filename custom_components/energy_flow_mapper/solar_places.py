"""Keep where each solar source feeds in (the panel's solar block).

A place names the device meter a solar feeds into: the gross meter the
setup made for it, or a meter that already counts the solar. It is our own
annotation; Home Assistant's energy settings do not change by it.
"""

from __future__ import annotations

from typing import Any, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import SOLAR_PLACES_STORAGE_KEY, SOLAR_PLACES_STORAGE_VERSION


class SolarPlacesData(TypedDict):
    """Content of the store file."""

    places: dict[str, str]


def _clean(data: Any) -> dict[str, str]:
    """Return the well-formed places of a loaded file."""
    raw = data.get("places") if isinstance(data, dict) else None
    if not isinstance(raw, dict):
        return {}
    return {
        solar: stat
        for solar, stat in raw.items()
        if isinstance(solar, str) and solar and isinstance(stat, str) and stat
    }


class SolarPlaceStore:
    """The place of each solar, by its statistic, saved at once."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: Store[SolarPlacesData] = Store(
            hass,
            SOLAR_PLACES_STORAGE_VERSION,
            SOLAR_PLACES_STORAGE_KEY,
            atomic_writes=True,
        )
        self._places: dict[str, str] = {}

    async def async_load(self) -> None:
        """Load the places; damaged entries are left out."""
        self._places = _clean(await self._store.async_load())

    def places(self) -> dict[str, str]:
        """Return a copy of the places."""
        return dict(self._places)

    async def async_set(self, solar: str, stat: str | None) -> dict[str, str]:
        """Place `solar` at the meter `stat` (None: nowhere); return the places."""
        if stat is None:
            if solar not in self._places:
                return self.places()
            self._places.pop(solar)
        else:
            self._places[solar] = stat
        await self._store.async_save({"places": dict(self._places)})
        return self.places()

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._places = {}
        await self._store.async_remove()
