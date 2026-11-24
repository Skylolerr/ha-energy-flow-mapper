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
- `manifest.json` `categories` (`energy.meters_monitoring`) is read from 2026.11 on (website,
  app, Marketplace). The 2026.10 loader reads the manifest without a schema and ignores the key.
  Hassfest and the HACS action check the value
  ([categories](https://contributors.home-assistant.io/core/integrations/categories/)).

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

## Recorder internals (safety net)

`stats_probe.read_downtimes` reads when Home Assistant was not running from the
recorder's own tables: `RecorderRuns` (`start`, `end`, `closed_incorrect`) and, for a run
that was not closed properly, the newest `States.last_updated_ts` in it. HA has no public
API for this. The tables are imported lazily from
`homeassistant.components.recorder.db_schema` (and `process_timestamp` from
`recorder.models`) inside the function, under a guard: any failure, of the import too,
gives None, and then the safety net leaves out `gross_off` and `gross_unknown` (their
flat downtime fills would look like falls and gaps) and keeps the solar-term check. So a
schema change cannot break loading the integration, but it silently switches those two
hints off.

The other recorder calls are public helpers: `statistics_during_period`,
`get_instance(hass).keep_days`, `async_add_executor_job`, `session_scope`.

## Helper behaviour the solar setup relies on

The gross meters are ordinary `template` and `integration` helpers. Their numbers depend
on Home Assistant's behaviour, which `tests/test_compile_gross.py` checks against the real
statistics compile:

- a `total` sensor's statistics book every change 1:1, also a dip (no reset detection);
- an integral counts nothing while its source is unknown and stays available, and updates
  on its `max_sub_interval` timer while the source is constant;
- a template with `now()` renders every minute; `this.state` and an entity's
  `last_changed` and `restored` attribute are readable in it;
- the config and options flows of `template`, `integration` and `group` take the options
  the setup sends (`template_meter.SENSOR_OPTIONS`, `integral.INTEGRAL_OPTIONS`,
  `GROSS_INTEGRAL_OPTIONS`, the sum options in `sum_meter.py`).

## Checking a new HA release

When a new HA release (or beta) is out:

1. Read the release notes and the merged `energy` PRs of `home-assistant/core` and
   `home-assistant/frontend` (preferences schema, dashboard naming, new source types,
   validation).
2. Test it on a local instance (see [testing.md](testing.md)); CI job `latest` picks up the
   new `pytest-homeassistant` by itself.
3. If HA changed something we mirror, add a version gate and tests for both the old and the
   new behaviour.
4. Recorder and helpers: check the merged `recorder` PRs for changes to `db_schema`
   (`RecorderRuns`, `States.last_updated_ts`) and `models.process_timestamp`, and the
   `template`, `integration` and `group` PRs for their options and behaviour above. Run
   `tests/test_stats_probe_recorder.py` (the downtimes against a real recorder) and
   `tests/test_compile_gross.py` on the new release; a downtime reading that returns None
   shows only in the debug log («Reading the downtimes failed»).
5. Raise the minimum only together with the maintainer (see [releasing.md](releasing.md)).
