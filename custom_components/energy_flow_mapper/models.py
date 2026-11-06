"""Runtime data of the config entry."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry

from .backups import BackupStore
from .created_helpers import CreatedHelpers
from .suggestions import SuggestionStore


@dataclass
class EnergyFlowMapperData:
    """Shared state of the integration.

    `lock` serializes writes so that two saves cannot interleave between
    the conflict check and the write. `card_url` is the loader URL added to
    the frontend, removed again on unload. `suggestions` holds the ignored
    suggestions.
    """

    backups: BackupStore
    helpers: CreatedHelpers
    suggestions: SuggestionStore
    supported: bool
    card_url: str
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # HA's energy validation for the cards: (monotonic time, hash of the
    # energy settings it belongs to, result).
    validation_cache: tuple[float, str, dict[str, Any] | None] | None = None


type EnergyFlowMapperConfigEntry = ConfigEntry[EnergyFlowMapperData]
