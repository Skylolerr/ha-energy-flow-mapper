# Architecture

How the code of Energy Flow Mapper is split up: which module does what, and the rules that
keep the energy settings safe. The user-facing behaviour is described in the README.

## Backend (`custom_components/energy_flow_mapper/`)

| Module | Job |
|---|---|
| `__init__.py` | Set up and unload the config entry, register panel, card and WebSocket commands |
| `models.py` | Typed runtime data (`ConfigEntry.runtime_data`, never `hass.data`) |
| `const.py` | Domain, store keys and versions, limits |
| `energy_access.py` | **The only module that touches HA's `energy` internals** (`async_get_manager`, `manager.data`, `manager.async_update`) and the feature checks for them |
| `hierarchy.py` | Pure tree logic: build, validate, move, untracked consumption, plausibility, error comparison. No HA imports needed to test it |
| `groups.py` | Pure logic of the device groups |
| `candidates.py` | Describe statistics (name, unit, device, power sensor, helper type) and find free sensors |
| `energy_stats.py` | Energy per statistic in a period, from the recorder |
| `backups.py` | Backup store, written before every change of the energy preferences |
| `group_store.py`, `created_helpers.py`, `suggestions.py` | Own stores: groups, helpers the panel created, ignored suggestions |
| `integral.py`, `sum_meter.py` | Create integral helpers ("Create meter") and sensor group sums ("Create sum meter") |
| `transfer.py` | Export and import of the energy settings as a file |
| `websocket.py` | All WebSocket commands (admin only, except the read-only card command) |
| `frontend.py` | Serve the bundles, register the panel, load the card |
| `config_flow.py`, `diagnostics.py` | Config flow / options, diagnostics download |

### Stores

All in `.storage/`, each with its own version:

- `energy_flow_mapper.backups` (`STORAGE_VERSION` / `STORAGE_MINOR_VERSION`)
- `energy_flow_mapper.helpers`, `energy_flow_mapper.suggestions`, `energy_flow_mapper.groups`

Any change of a store format bumps its version and adds a migration, with a test.

### Writing the energy preferences

HA's energy preferences are the source of truth. A write always:

1. stores a backup of the current preferences,
2. builds the new value from a fresh deep copy,
3. sends the **complete** list of every changed key (`energy_sources`, `device_consumption`, …),
4. passes unknown fields through unchanged.

Saving is refused only for errors that the change *adds*. Errors that were already in the
saved settings are kept and listed apart in the check dialog (`new_errors` / `issue_dicts`
in `hierarchy.py`, weighted with a counter so "one more of the same" still counts as new).

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
| `draft.ts` | Pure draft logic, **mirrors `hierarchy.py`** (untracked, coverage, display names, ambiguous devices, remove/lift) |
| `groups.ts` | Mirrors `groups.py` |
| `layout.ts` | Automatic diagram layout |
| `export.ts` | Diagram as SVG/PNG, anonymised export |
| `icons.ts` | Inlined MDI paths (no icon fetch) |
| `localize.ts`, `translations/` | Panel texts EN/DE/FR/IT |
| `types.ts` | Minimal HA frontend types and the WebSocket payloads |

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
