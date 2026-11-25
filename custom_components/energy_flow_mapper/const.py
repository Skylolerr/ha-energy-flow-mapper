"""Constants for the Energy Flow Mapper integration."""

from __future__ import annotations

import logging
from typing import Final

DOMAIN: Final = "energy_flow_mapper"
LOGGER = logging.getLogger(__package__)

STORAGE_VERSION: Final = 1
# 2: backups may hold the groups of that moment (old entries stay as they are).
STORAGE_MINOR_VERSION: Final = 2
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
# 2: a record per helper (what the setup made it for), next to the IDs. 3: the
# records moved to their own file (HELPER_RECORDS_STORAGE_KEY). Only
# the minor version grows, so an older release can still load the file.
HELPERS_STORAGE_MINOR_VERSION: Final = 3
HELPERS_STORAGE_KEY: Final = f"{DOMAIN}.helpers"
# What each created helper was made for, by entry ID. In a file of its own:
# 0.10.x never knows it, so its saves of the helpers file cannot drop it.
HELPER_RECORDS_STORAGE_VERSION: Final = 1
HELPER_RECORDS_STORAGE_KEY: Final = f"{DOMAIN}.helper_records"
SUGGESTIONS_STORAGE_VERSION: Final = 1
# 2: dismissed hints next to the ignored suggestions. 3: a dismissal of a
# safety-net hint names its event (hour or day). Only the minor version grows,
# so an older release can still load the file after a downgrade.
SUGGESTIONS_STORAGE_MINOR_VERSION: Final = 3
SUGGESTIONS_STORAGE_KEY: Final = f"{DOMAIN}.suggestions"
GROUPS_STORAGE_VERSION: Final = 1
GROUPS_STORAGE_KEY: Final = f"{DOMAIN}.groups"
# Where each solar feeds in (the solar block): solar statistic -> device meter.
SOLAR_PLACES_STORAGE_VERSION: Final = 1
SOLAR_PLACES_STORAGE_KEY: Final = f"{DOMAIN}.solar_places"
