"""Runtime data of the config entry."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry

from .backups import BackupStore
from .created_helpers import CreatedHelpers
from .group_store import GroupStore
from .solar_places import SolarPlaceStore
from .stats_probe import ReadingCache
from .suggestions import SuggestionStore


@dataclass
class EnergyFlowMapperData:
    """Shared state of the integration.

    `lock` serializes writes so that two saves cannot interleave between
    the conflict check and the write. `card_url` is the loader URL added to
    the frontend, removed again on unload. `suggestions` holds the ignored
    suggestions, `groups` the device groups, `solar_places` where each
    solar feeds in.
    """

    backups: BackupStore
    helpers: CreatedHelpers
    suggestions: SuggestionStore
    groups: GroupStore
    solar_places: SolarPlaceStore
    supported: bool
    card_url: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # HA's energy validation for the cards: (monotonic time, hash of the
    # energy settings it belongs to, result).
    validation_cache: tuple[float, str, dict[str, Any] | None] | None = None
    # The validation that is running for the cards: (hash, task).
    validation_running: tuple[str, asyncio.Task[dict[str, Any] | None]] | None = None
    # The last statistics reading of the hints' safety net.
    watch_cache: ReadingCache = field(default_factory=ReadingCache)


type EnergyFlowMapperConfigEntry = ConfigEntry[EnergyFlowMapperData]
