"""Runtime data of the config entry."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from homeassistant.config_entries import ConfigEntry

from .backups import BackupStore
from .created_helpers import CreatedHelpers


@dataclass
class EnergyFlowMapperData:
    """Shared state of the integration.

    `lock` serializes writes so that two saves cannot interleave between
    the conflict check and the write.
    """

    backups: BackupStore
    helpers: CreatedHelpers
    supported: bool
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


type EnergyFlowMapperConfigEntry = ConfigEntry[EnergyFlowMapperData]
