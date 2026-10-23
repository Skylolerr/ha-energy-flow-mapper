"""Constants for the Energy Flow Mapper integration."""

from __future__ import annotations

import logging
from typing import Final

DOMAIN: Final = "energy_flow_mapper"
LOGGER = logging.getLogger(__package__)

STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = f"{DOMAIN}.backups"
MAX_BACKUPS: Final = 20

# Children may exceed their parent by this much before the panel warns
# (both limits must be exceeded): metering plugs are not exact.
PLAUSIBILITY_RATIO: Final = 0.05
PLAUSIBILITY_MIN_KWH: Final = 0.1

ISSUE_UNSUPPORTED_ENERGY_API: Final = "unsupported_energy_api"
