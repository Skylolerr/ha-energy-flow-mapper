# Architecture

How the code of Energy Flow Mapper is split up: which module does what, and the rules that
keep the energy settings safe. The user-facing behaviour is described in the README.

## Backend (`custom_components/energy_flow_mapper/`)

| Module | Job |
|---|---|
| `__init__.py` | Set up and unload the config entry, register panel, card and WebSocket commands |
| `models.py` | Typed runtime data (`ConfigEntry.runtime_data`, never `hass.data`): the stores, the write lock, the card's validation cache and the safety net's `watch_cache` |
| `const.py` | Domain, store keys and versions, limits |
| `energy_access.py` | **The only module that touches HA's `energy` internals** (`async_get_manager`, `manager.data`, `manager.async_update`) and the feature checks for them |
| `hierarchy.py` | Pure tree logic: build, validate, move, untracked consumption, plausibility, counted twice, error comparison. No HA imports needed to test it |
| `groups.py` | Pure logic of the device groups |
| `candidates.py` | Describe statistics (name, unit, device, power sensor, helper type) and find free sensors; `contained_in` names the meter of the settings that already holds a free sensor |
| `meter_inputs.py` | What a meter holds: the inputs of template, group, `min_max` (Combine), integral, utility-meter and derivative helpers (from their config entries; YAML helpers are not seen), followed `MAX_DEPTH` (5) levels deep, with the subtracted ones and whether the signs are known (unknown for a sign turned by a factor, `x * -1`, or by a minus inside a subtracted bracket, `a - (b - c)`); `states.<domain>['<id>']` reads as `states['<entity>']`. `direct_inputs` (one level), `meter_inputs` (all levels), `counted_inputs` (plus sign only, for `counted_twice`); feeds `contained_in`, `SolarHolds`, the safety net and the setup's "solar already in the meter" |
| `device_rules.py` | Known-device rules of the solar setup (registry only, no state needed): `classify_meter` (Shelly RPC `em`/`em1`/`emdata`/`em1data` → EM; a Shelly `switch` with a returned sensor of its own: "Energy" → Plug, "Energy consumed" → EM; a meter that went below 0 → Net), the device family (own device, parent, children, disabled entities included), `drawn_candidates`, `returned_candidates` and `preselect_returned` (only a returned sensor of the meter's own channel, or the only one on its own device), `paired_power` (own device only, by a channel key per integration: Shelly, IoTaWatt, Emporia, Envoy, OpenDTU/AhoyDTU, Zigbee2MQTT), `default_inverted` (Huawei Solar's meter power) |
| `energy_stats.py` | Energy per statistic in a period, from the recorder |
| `daily_reset.py` | Recognise meters that reset periodically for `get` and the hints (the rule of `stats_probe.py`, utility meters with a cycle) |
| `stats_probe.py` | What the statistics show (`async_probe` → `StatsEvidence`): periodic counters (`periodic_from_series`: a fall to less than half the distance from 0 on 2 local days or more; with the meter's own power a fall its power explains is no reset; certain for a utility meter with a cycle or a changing `last_reset`), power sign (`went_negative`), the hourly sparkline. Reads 5-minute statistics first, hourly where they do not cover the window, in kWh and W, with one timeout. `async_read` runs several `Query`s and `read_downtimes` in one recorder executor job and returns a `Reading`, kept in a `ReadingCache` for 5 minutes |
| `hints.py` | Hints of the panel, returned by `get`: returned energy of a circuit while solar exists, daily meters in a sum, power sensors the HA device has (electricity: of the meter's own channel), and the safety net of the setup's gross meters (`async_watch`) |
| `backups.py` | Backup store, written before every change of the energy preferences |
| `group_store.py`, `created_helpers.py`, `suggestions.py` | Own stores: groups; helpers the panel created, with a record of what the solar setup made each one for; ignored suggestions and dismissed hints |
| `_flow.py` | `async_run_helper_flow`: the one place that drives a helper's config flow (and options flow). Refused input and lost flows end in the caller's error, no flow is left open; once the entry exists, any failure or a cancel removes it again (shielded) |
| `integral.py` | Create integral helpers ("Create meter"; the setup's solar term and From power). `INTEGRAL_OPTIONS`: left Riemann sum, 3 decimals, `unit_prefix` `k` only for a source in W or without a unit, `max_sub_interval` 5 min; `GROSS_INTEGRAL_OPTIONS` the same with 1 min |
| `template_meter.py` | Create template sensor helpers: energy in kWh with `state_class: total`, power in W with `measurement` |
| `sum_meter.py` | "Create sum meter": member checks (`check_sum_members`: device class, one meter state class), `SolarHolds` and `check_no_solar`, `async_create_sums` (meter sum and rate sum; a failure or cancel removes every sum of the request) |
| `solar_setup.py` | The guided setup "Solar feeds in here", see [The solar setup](#the-solar-setup) |
| `transfer.py` | Export and import of the energy settings as a file |
| `websocket.py` | All WebSocket commands (admin only, except the read-only card command), see [WebSocket commands](#websocket-commands) |
| `frontend.py` | Serve the bundles, register the panel, load the card |
| `config_flow.py`, `diagnostics.py` | Config flow / options, diagnostics download |

### Stores

All in `.storage/`, each with its own version:

- `energy_flow_mapper.backups` (`STORAGE_VERSION` 1 / `STORAGE_MINOR_VERSION` 2)
- `energy_flow_mapper.helpers` (`HELPERS_STORAGE_VERSION` 1 /
  `HELPERS_STORAGE_MINOR_VERSION` 3): `entries`, the config entry IDs of the helpers the
  panel created.
- `energy_flow_mapper.helper_records` (`HELPER_RECORDS_STORAGE_VERSION` 1): `records`,
  entry ID → what the solar setup made the helper for:
  - `{kind: "solar_power", power}`: the held template of the solar power sensor `power`;
  - `{kind: "solar_energy", power, template}`: the solar term, the integral of the held
    template whose entry ID is `template`;
  - `{kind: "gross_power", stat, method}`: the gross power of the device `stat`;
  - `{kind: "gross_energy", stat, method, power}`: the gross meter; `power` is the entry ID
    of its gross power, or None.

  The setup reuses solar terms by their records, the safety net and `SolarHolds` find the
  gross meters by them. Both files belong to `CreatedHelpers` and are written atomically
  (`atomic_writes=True`). A save writes the records file first, then the helpers file;
  removing the integration deletes both, the helpers file first, like the other stores
  (unloading keeps them). Records of IDs that are not in `entries` are dropped in memory
  on load, and from the file at the next save of the records. Records of helpers the user deleted in Home Assistant are kept: every consumer
  reaches a record only through an existing config entry (an entity's, or one the record
  names), and entry IDs are never reused, so such a record does nothing
  (`test_records_of_removed_helpers_do_nothing`). The records have their own file because
  0.10.x saves the helpers file with `entries` only. In 1.2 they were in the helpers file:
  on load, records still there move once to the records file (which wins where both have
  one), and only then is the helpers file saved without them. 1.1 files have no records.
- `energy_flow_mapper.groups` (`GROUPS_STORAGE_VERSION` 1)
- `energy_flow_mapper.suggestions` (`SUGGESTIONS_STORAGE_VERSION` 1 /
  `SUGGESTIONS_STORAGE_MINOR_VERSION` 3): ignored suggestions and dismissed hints
  (code, kind, stat, optional source role; a safety-net hint also its event, `hour` or
  `day` (`suggestions.EVENT_KEYS`), and hides only that event). The migration from 1.1
  keeps the ignored suggestions and adds an empty list of dismissed hints; the one from
  1.2 drops every safety-net dismissal (in 1.2 they had no event). A safety-net dismissal
  without its event is never stored. Entries of meters no longer in the settings, and
  dismissed events older than the 7-day watch window (`EVENT_DAYS`), are dropped on the
  next write. `clear_suggestions` clears both. Not part of backups, export or import.

Any change of a store format bumps its version and adds a migration, with a test.

**Older releases.** Only minor versions grew. HA's `Store` loads a file with the same major
and another minor version even without a migration for it (the base
`_async_migrate_func` raises `NotImplementedError`, and with an equal major version the data
is kept as it is) and saves it again under its own version. So 0.10.x (helpers and
suggestions 1.1) loads the 1.3 files; the first save of its own then keeps only what it
knows (`entries`, `ignored`). It never opens the records file, so only the dismissed hints
are lost. `test_store_1_3_loads_in_older_releases` loads the suggestions file with a plain
version-1 `Store`; `test_records_survive_a_downgrade_to_0_10` and
`test_setup_records_survive_a_downgrade_to_0_10` save the helpers file as 0.10.x does.

### Writing the energy preferences

HA's energy preferences are the source of truth. A write always:

1. stores a backup of the current preferences,
2. builds the new value from a fresh deep copy,
3. sends the **complete** list of every changed key (`energy_sources`, `device_consumption`, …),
4. passes unknown fields through unchanged.

Saving is refused only for errors that the change *adds*. Errors that were already in the
saved settings are kept and listed apart in the check dialog (`new_errors` / `issue_dicts`
in `hierarchy.py`, weighted with a counter so "one more of the same" still counts as new).

### Draft changes

The panel collects changes in a draft. `hierarchy.apply_changes` (mirrored in `draft.ts`)
knows `add`, `move`, `rename`, `set_rate` (a device's power or flow sensor; `null` clears
it), `remove`, `assign_source`, `unassign_source`, `set_source_rate` and
`use_as_home_meter`; `groups.apply_all` applies them in order together with the group
changes. `set_source_rate` is addressed by role like `unassign_source`. Grid and battery
take exactly one `power_config` shape (`stat_rate`, `stat_rate_inverted`, or
`stat_rate_from` + `stat_rate_to`) and HA derives `stat_rate` on save; clearing removes
both. Until saved, the panel computes the live value of an inverted or two-sensor config
itself.

*Replace with …* has no change of its own: `replaceChanges` in `draft.ts` composes add,
set group, a move of each child and remove into one undo step (the panel adds the moves
of groups below the old meter). *Create sum meter* and *Solar feeds in here…* use it
after their helpers exist.

### Helpers created at once

`create_integral`, `create_sum_meter` and `create_solar_setup` create HA helpers right
away (not on save), through `_flow.async_run_helper_flow`, and record them in the helpers
store; the panel then changes the draft. When a later helper of the same request fails,
or the request is cancelled, the ones created before are removed and forgotten again,
shielded from a further cancel; a helper that cannot be removed is logged and stays
recorded, the others still go.

### The solar setup

`solar_setup.py`. `async_plan(hass, prefs, helpers, Choices, saved)` returns a `Plan`
without creating anything; `async_create(hass, helpers, plan, names, offset)` creates its
helpers. The setup never writes the energy settings.

- **Settings:** `prefs` are the saved settings, or the draft's (the panel's `base_hash` +
  `changes` applied, `conflict` when the settings changed meanwhile) with the saved ones
  beside them. A power of the device or the solar that differs from the saved one comes
  from the draft and must be a power sensor (`_rate_sensor`; an entity without a state
  falls back to its registry entry), used nowhere else and none of the setup's gross
  helpers; otherwise `not_offered` with `power` (`circuit` / `solar`) and `why` (`used`,
  `not_power`, `ours`) as placeholders. A device or solar that never had a power gets
  `paired_power`; a power the draft removed stays removed.
- **Methods** (`device_rules.Method`): EM, Plug, Net (energy counters) and From power.
  Each gets a `MethodStatus` (`offered`, `verified`, `reason`): verified by the device rule
  (`device_rules.RULE_*` as the reason) with the returned sensor the rule trusts and
  inputs that have statistics, or for From power by a circuit power that went below 0;
  otherwise a `Reason` (`unverified_*`, the panel's "not verified"), or not offered
  (`no_returned_sensor`, `daily_input`, `unsupported_input`, `net_needs_signed_meter` for
  a `total_increasing` net meter, `no_power`, `unusable_power`). Suggested: the rule's
  method, else From power, else None. The inputs' history comes from one
  `stats_probe.async_probe` (3 days, the meters with their own powers); `Choices.periodic`
  is the user's daily switch per input, which a certain signal overrides.
- **Templates** read each input with Home Assistant's own unit factors (`KWH`, `WATTS`, from
  its converters) at render time and are `none` while a needed input has no number or an
  unknown unit. Gross energy: `gross_energy_template` (EM drawn − returned + solar, Plug
  energy − 2 × returned + solar, Net meter + solar, plus the offset), kWh, `total`. From
  power: an integral (`GROSS_INTEGRAL_OPTIONS`) of the gross power.
- **Held solar power** (`solar_power_template`, record `solar_power`): the solar power in
  W; while it is exactly `unavailable` and not `restored`, its own last value for
  `SOLAR_HOLD_SECONDS` (600; `now()` renders it every minute, so 10 to 11 minutes), then 0;
  `unknown`, a restored state or no own value yet give 0 at once; a number in an unknown
  unit gives `none`. The solar's `last_changed` is read as `states.<domain>['<id>']` (an
  object ID may start with a digit) and compared with `now() - timedelta(...)`, never
  subtracted, so `meter_inputs` sees no minus on the solar. One per solar power, reused
  (`_reusable_solar`) when it is exactly as the setup builds it now.
- **Solar term** (`SolarTerm`, EM/Plug/Net): `integral` of the held template (record
  `solar_energy`, reused with it), or `counter`, the solar's own energy statistic, only
  without a solar power and when the evidence shows a lifetime counter (rises on
  `MIN_DAYS` local days, no reset signal, no drop); else the plan is blocked
  (`solar_needs_power` / `solar_needs_data`).
- **Gross power** (`gross_power_template`, record `gross_power`): circuit (× −1 with
  `invert`) + held solar. `none` when the raw solar has no number and the sum is below
  −`GROSS_NOISE_W` (20 W): the true value is unknown, and From power must not fall; 0 when
  it is from −20 W to 0 (a current transformer's noise at night, else the safety net would
  report `gross_unknown` every morning). With a numeric solar there is no floor, so a wrong
  sign stays visible. Also `none` when the raw solar has a number the held template
  cannot read. Built when both powers are usable and the circuit's is enabled; for
  EM/Plug/Net only when the circuit's power went below 0, else
  `power_reason` `gross_power_needs_signed`. `live` is the circuit, solar and gross power
  now, by the same rule.
- **Offset** (`_set_offset`, EM/Plug/Net): the values the template will read now (a new
  solar integral reads 0) give the start; below `START_MIN` (100 kWh) the offset is the
  rest rounded up to whole `OFFSET_STEP` (100 kWh). The Net meter and the subtracted
  returned energy need a value, else `input_not_ready`. Create takes the previewed offset
  and refuses one that is no longer enough (`values_changed`); From power has none.
- **Blocks** (`Blocked`, each an exception key; `blocked_entity` names the input): the
  first one found wins. `daily_check_failed` (the probe did not run) comes first, then
  `solar_already_in_meter` (`_holds_solar`: the device's meter, drawn, returned or circuit
  power already holds the solar's statistic or power at any level of `meter_inputs`, or
  an energy or power sensor the solar is made of), the solar's power (`unsupported_input`,
  `input_disabled`) or solar term, then the chosen method (`no_safe_method` /
  `daily_without_power` when nothing is offered, `not_offered`, `choose_returned`,
  `returned_disabled`, `input_disabled`).
- **Create** plans again with the same choices and refuses a blocked plan, a method that
  is not offered (or From power without a gross power) and an offset that is no longer
  enough or not a whole number of 100 kWh (`values_changed`). Order: held
  template (unless reused), gross power, solar term (unless reused), gross energy; names
  per `Role` from the panel, defaults from `Plan.default_name`. It returns the gross
  meter and the gross power (or None).

### Sum meters

`create_sum_meter` judges its members with `sum_meter.SolarHolds` on the saved settings.
The solar is every solar source's statistic and power, what they count (energy and power
sensors, e.g. the inverters of a solar sum; not what they subtract, and not the meters of
the settings when the solar is computed by subtracting) and the setup's solar terms and
held templates. A member that is the solar or made only of it is always refused
(`sum_with_solar`), also as a rate member. A member that holds the solar (with unknown
signs, any input counts) is refused unless it is in `gross_ok` (the user marked it as a
gross meter already). A gross meter the setup made (record `gross_energy`) that still
reads something besides the solar is no holder; a path to the solar through such a gross
meter does not count, another path still does. `get` returns the same judgement as
`solar_holds`, so the panel offers the mark only where it can pass. The panel's sum
dialog sends the other sums to *Solar feeds in here…* and checks its members with
`daily_check` on demand, once per member and dialog (a periodic member blocks the sum).
The backend does not check members for periodic meters by design: the check reads the
recorder and gives a preselection with evidence, which is the panel's to show.

### WebSocket commands

All are `{DOMAIN}/<command>`, admin only (`@require_admin`) except `card`. Schemas use
`probatio`.

| Command | Takes | Returns |
|---|---|---|
| `get` | – | Settings with metadata (see `websocket_get`), `hints`, `dismissed_hints`, `inputs`, `solar_holds` |
| `validate`, `save` | `base_hash`, `changes` | Issues; `save` writes (backup first) |
| `backups`, `restore` | `backup_id`, `base_hash` | |
| `export`, `import_check`, `import` | `backup_id?`; `base_hash`, `document` | |
| `energy` | `period`, `base_hash` + `changes` (optional, both or neither) | Energy of devices and sources in the period; untracked and warnings follow the draft |
| `card` | `kind`, `period?` (read-only, every user) | The tree, names and consumption, no prices |
| `create_integral` | `power_entity_id`, `name` | `entity_id`, `stat_rate`, `kind` |
| `create_sum_meter` | `kind`, `name`, `entity_ids`, `rate_entity_ids?`, `rate_name?`, `gross_ok?` | `entity_id`, `stat_rate` |
| `daily_check` | `stats`, `power?` ({energy: power}, draft pairings) | `{evidence: {stat: StatsEvidence}, unknown}` |
| `solar_setup_preview` | `stat`, `solar`, `method?`, `drawn?`, `returned?`, `invert?`, `periodic?` ({entity: bool}), `base_hash` + `changes` (both or neither) | The plan, see below |
| `create_solar_setup` | the same, `method` required, `names?` ({role: name}), `offset` | `entity_id`, `stat_rate` |
| `ignore_suggestion`, `clear_suggestions` | `kind`, `stat`, `parent`; `kind?` | `ignored` |
| `dismiss_hint` | `code`, `kind`, `stat`, `role?`, `hour?`, `day?` | `dismissed` |

The preview (`Plan.as_dict`): `method`, `suggested`, `rule`, `methods` (`[{method,
offered, verified, reason}]`), `drawn`, `returned`, `invert`, `drawn_candidates` and
`returned_candidates` (`[{entity, disabled}]`), `power` (`circuit`, `solar`, `signed`,
`circuit_from`, `solar_from`: `draft`, `saved`, `paired` or None), `live` (`circuit_w`,
`solar_w`, `gross_w`), `evidence` ({stat: StatsEvidence}), `solar_term` (`kind`,
`reuse`), `helpers` (`[{role, name_default}]`, roles `solar_power`, `solar_energy`,
`power`, `energy`), `offset`, `power_reason`, `blocked`, `blocked_entity`. Errors carry
the `Blocked` keys with `entity_id`; `not_offered` for a refused draft power also `power`
and `why`.

### Hints

`hints.py` computes the hints and `get` returns them with `dismissed_hints`. They need the
entity registry (disabled returned sensors), config entries (members of a sum helper) and
the recorder (energy counted lately, daily resets via `daily_reset.py`), which the panel
cannot see. The recorder queries are guarded by a timeout: a slow recorder leaves out the
hints that need it instead of blocking `get`. Daily resets are read only for the meters of
devices and sources and the members of their sum helpers (what the hints and the sum dialog
use); free meters keep `daily_reset: false`. `dismiss_hint` stores a dismissal. The card
gets no hints.

### The safety net

`hints.async_watch` watches the gross meters of the solar setup that are devices, found by
their `gross_energy` records (`_gross_meters`: the gross power, the user's inputs, and
the solar terms each one reads). Every hint is `{code, stat, kind, data}`:

- `gross_off` (`data`: `direction` `fall`/`jump`, `hour`, `method`, `change_kwh`,
  `power_kwh?`, `input?`, `cause?` `input`/`sign`/`solar_term`): an hour of the last
  `WATCH_DAYS` (7) whose change differs from the gross power's energy (its hourly mean) by
  more than max(`OFF_KWH` 0.5 kWh, `OFF_SHARE` 30 %), with both two-hour windows around
  it off the same way; a window below −0.5 kWh is a fall in every method. The gross power
  counts only while the device still uses it as its `stat_rate` (`_Gross.compare`);
  without it only falls the next hour does not make up. `input` is the input whose counter
  fell reset-shaped (by ≥ 0.5 kWh to less than `FALL_SHARE` as far from 0), the largest
  fall.
- `gross_unknown` (`hour`, `minutes`, `method`, `input?`): more than `GAP_SECONDS` (1 h)
  without 5-minute rows of the gross meter (From power: its gross power) in the last day,
  without the downtimes. A gap where only the solar's own energy counters had no value
  is the counter path's night pause: no hint.
- `solar_term_short` / `solar_term_high` at the solar source (`role` `production`,
  `entity_id` the term, `day`, `term_kwh`, `source_kwh`, `power`): the term's last full
  local day against the source's own statistic, off by more than max(`TERM_KWH` 0.5 kWh,
  `TERM_SHARE` 15 %); not on a day the term began.

One recorder executor job (`stats_probe.async_read`) reads two `Query`s – a week of hourly
statistics (gross meters, compared powers, inputs, terms and their sources) and a day of
5-minute statistics (gross meters, From power's gross powers, inputs, terms) – plus Home
Assistant's downtimes, together with the other queries of `get`; the `Reading` is kept for
5 minutes per set of queries (`watch_cache` in the runtime data). No window reaches back
further than the recorder's `keep_days`.

**Downtimes** (`stats_probe.read_downtimes`): from the end of one recorder run to the
start of the next; a run that was not closed properly (`closed_incorrect`, or no end)
ended with its last state written (`States.last_updated_ts`). The recorder fills a
downtime with the last values (flat rows, no gaps), so hours around a downtime of
`MIN_DOWNTIME` (10 min) or more are skipped by `gross_off` (unless an input's counter
fell, with the hour below −0.5 kWh), and downtime is not counted as a gap. `RecorderRuns`
and `States` are internal tables of the recorder: they are imported lazily inside a guard,
and any failure gives None; then `gross_off` and `gross_unknown` are left out while the
solar-term check stays (see [ha-compat.md](ha-compat.md)). Each check runs on its own: a
failing check only loses its hint.

## Panel and card (`panel/`)

Lit + TypeScript, built with Rollup into three bundles in
`custom_components/energy_flow_mapper/frontend/`:

- `energy-flow-mapper-panel.js` – the admin panel (`energy-flow-mapper-panel.ts`)
- `energy-flow-mapper-card.js` – small loader on every frontend page (`card-loader.ts`)
- `energy-flow-mapper-card-view.js` – the read-only dashboard card (`card.ts`, `card-config.ts`)

The bundles are **committed** (HACS runs no build step) and must be reproducible: CI rebuilds
them and fails if they differ from the committed files. Rebuild before every commit that
touches `panel/`.

| File | Job |
|---|---|
| `draft.ts` | Pure draft logic, **mirrors `hierarchy.py`** (untracked, coverage, display names, ambiguous devices, counted twice, remove/lift, `set_rate` / `set_source_rate`), plus `replaceChanges` |
| `groups.ts` | Mirrors `groups.py` |
| `layout.ts` | Automatic diagram layout |
| `export.ts` | Diagram as SVG/PNG, anonymised export |
| `energy-flow-mapper-panel.ts` | The panel: diagram, list, dialogs (power sensors, replace, sum, backups), hints and their texts (`README_ANCHORS` links a safety-net hint to its README section), the draft |
| `solar-setup.ts` | `<efm-solar-setup>`, the *Solar feeds in here…* dialog, see below |
| `evidence.ts` | Sentences and dates of the statistics evidence (`evidenceText`, `inputEvidenceText`, `formatDayTime`, `formatDay`), for the setup, the sum dialog and the hints |
| `icons.ts` | Inlined MDI paths (no icon fetch) |
| `localize.ts`, `translations/` | Panel texts EN/DE/FR/IT |
| `types.ts` | Minimal HA frontend types and the WebSocket payloads |

### The setup dialog

`<efm-solar-setup>` renders into the panel's shadow root (no shadow root of its own, so the
dialog styles apply). The panel gives it `hass`, `localize` (not `translate`, which every
HTML element has) and a `SolarSetupContext`: the device `stat` and its `deviceName`, the
draft's `solars`, an optional `solar` to preselect (from the sum dialog), `resume`, `busy`,
`name` and `sensorName`, `draft()` (`{base_hash, changes}` of the panel, or null without
changes) and `reload()` (load the settings again after a `conflict`; the draft is kept).

It calls `solar_setup_preview` on every choice (a late answer for an earlier one is
dropped) and `create_solar_setup` with what the preview showed (method, drawn, returned,
invert, offset, names). Only the user's choices are sent; `periodic` only for the inputs
the user touched. A `conflict` reloads once; a pick or method the backend no longer
offers is dropped with a note; a refused draft power (`not_offered` with `power` and
`why`) is named with the way on; any other failure keeps the last preview and offers
*Try again*.

Events (none bubble):

- `close`;
- `created` (`SolarCreatedDetail`: `stat`, `entity_id`, `stat_rate`, `old`, `name`): the
  panel loads the settings again and puts the gross meter in the device's place
  (`_replace`, one undo step), also when the dialog was closed meanwhile;
- `failed` (`{error}`): the panel shows the error, the dialog stays and checks again;
- `set-solar-power` (`{solar, state}`) and `set-circuit-power` (`{stat, state}`): the
  panel opens the power dialog of the solar source or the device and, on OK, Cancel or
  Escape, opens the setup again with `resume: state`;
- `open-settings` (`{entity_id}`): HA's entity settings (a disabled sensor).

`SolarSetupState` (`solar`, `choices`, `names`) is what the setup hands out in those two
events and takes back as `context.resume`, so it comes back as the user left it.

### Python and TypeScript parity

Rules that both sides compute (untracked consumption, coverage, plausibility, device names
like the energy dashboard) live in `hierarchy.py` **and** `draft.ts`. Change both in the same
commit and add a test on both sides with the same example.

### Per-browser switches

Stored in `localStorage` (per browser, not per user):

- `energy_flow_mapper.helper_marks` – "Mark helpers" (off by default)
- `energy_flow_mapper.free_collapsed` – free sensors column folded
- `energy_flow_mapper.coverage` – coverage shown at Home
- `energy_flow_mapper.orientation` – horizontal or vertical diagram
- `energy_flow_mapper.draft` – the kept draft of unsaved changes

## Translations

EN is the base (`strings.json` + `translations/en.json`), plus DE, FR, IT, for the backend and
for `panel/src/translations/`. Every new user-facing string goes into all of them in the same
change; `tests/test_translations.py` and `panel/test/localize.test.ts` check that the keys match.
