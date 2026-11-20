# Home Assistant compatibility

Energy Flow Mapper edits HA's energy preferences and shows them the way the energy
dashboard does. Both depend on HA internals that can change between releases.

## Rules

- Minimum version: **2026.10.0** (`hacs.json`). Everything must keep working there.
- Only `energy_access.py` touches the internals of HA's `energy` integration. If HA changes
  them, the integration shows a repair issue instead of writing something wrong
  (`async_is_supported`, `REQUIRED_NAMES`).
- HA ≥ 2026.10 uses `probatio` instead of `voluptuous` (`import probatio as vol`).
- Unknown fields in the preferences are passed through unchanged, so fields of newer HA
  releases survive a save.

## Version gates

Checked at runtime, so one release works on all supported HA versions:

| Feature | From | Check |
|---|---|---|
| Home meter (energy source `home`) | 2026.11 | `energy_access.home_supported()` (`HOME_SOURCE_SCHEMA` exists) |
| Device names after their HA device | 2026.11 | `candidates.names_by_device()` |
| Entity part for devices with several meters of the same kind | 2026.11.2 (frontend 20261028.6) | `candidates.names_with_entity()` |

Prefer a feature check (`hasattr`) over a version number where HA offers one.

## Behaviours mirrored from the energy dashboard

These are computed in `hierarchy.py` / `candidates.py` **and** in `panel/src/draft.ts`:

- **Device names** (2026.11): a device is named after its HA device; a name set by the user
  wins. From 2026.11.2, devices whose label collides within one list also get the entity name
  (`ambiguous_devices` / `ambiguousDevices`, frontend #55778). A user-set name counts towards a
  collision but is never changed.
- **Power sensors of sources**: `stat_rate`, then the grid's `power_config`
  (`stat_rate`, `stat_rate_inverted`, `stat_rate_from`, `stat_rate_to`, in HA's order).
- **Home meter**: at most one source of type `home`; it measures Home itself, so untracked
  consumption at Home uses it when present.
- **Untracked consumption**: parent minus its children; a child without a value counts as 0
  and is listed in the hint ("without …").

## Checking a new HA release

When a new HA release (or beta) is out:

1. Read the release notes and the merged `energy` PRs of `home-assistant/core` and
   `home-assistant/frontend` (preferences schema, dashboard naming, new source types,
   validation).
2. Test it on a local instance (see [testing.md](testing.md)); CI job `latest` picks up the
   new `pytest-homeassistant` by itself.
3. If HA changed something we mirror, add a version gate and tests for both the old and the
   new behaviour.
4. Raise the minimum only together with the maintainer (see [releasing.md](releasing.md)).
