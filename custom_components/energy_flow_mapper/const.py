"""Constants for the Energy Flow Mapper integration."""

from __future__ import annotations

import logging
from typing import Final

DOMAIN: Final = "energy_flow_mapper"
LOGGER = logging.getLogger(__package__)

STORAGE_VERSION: Final = 1
STORAGE_KEY: Final = f"{DOMAIN}.backups"
# How many backups are kept; the user picks a number in the options.
CONF_MAX_BACKUPS: Final = "max_backups"
DEFAULT_MAX_BACKUPS: Final = 20
MIN_BACKUPS: Final = 5
MAX_BACKUPS: Final = 100

# Children may exceed their parent by this much before the panel warns
# (both limits must be exceeded): metering plugs are not exact.
PLAUSIBILITY_RATIO: Final = 0.05
PLAUSIBILITY_MIN_KWH: Final = 0.1
# The same for water, in litres (converted for gallons).
PLAUSIBILITY_MIN_LITERS: Final = 10.0

ISSUE_UNSUPPORTED_ENERGY_API: Final = "unsupported_energy_api"

HELPERS_STORAGE_VERSION: Final = 1
HELPERS_STORAGE_KEY: Final = f"{DOMAIN}.helpers"
