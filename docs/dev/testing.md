# Testing

Every feature and bug fix comes with tests. Target: ≥ 90 % coverage of the Python modules
(currently 100 %). Test `hierarchy.py` changes first, and for rules shared with the panel add
the same example to `panel/test/draft.test.ts`.

## Python

### Test packages

| Home Assistant | Package | Where |
|---|---|---|
| 2026.10.0 (minimum, `hacs.json`) | `pytest-homeassistant-custom-component` | `requirements_test.txt`, CI job `minimum` |
| latest (2026.11 and newer) | `pytest-homeassistant` (HA's own) | CI job `latest` upgrades to it |

Never install both in one environment. Tests import the helpers from `tests/common.py`,
which picks whichever package is installed. `pyproject.toml` keeps the settings the
`pytest-homeassistant` docs ask for (`-p no:respx`, `pythonpath`). When the minimum is raised
to 2026.11 or newer, drop the old package.

### Commands

```bash
python -m venv .venv && .venv/bin/pip install -r requirements_test.txt
pytest                                   # tests + coverage
ruff check . && ruff format --check .
mypy custom_components/energy_flow_mapper
```

### Windows

Home Assistant cannot be imported natively on Windows. A local venv needs three stubs in
`.venv/Lib/site-packages/` (not in the repo): `fcntl.py`, `resource.py` and
`win_ha_test_shim.py`. Then:

```bash
.venv/Scripts/python.exe -m pytest -p win_ha_test_shim
```

A recreated venv needs the stubs again. Linux/macOS and CI need nothing special. A run
leaves `tests/testing_config/` behind; delete it afterwards.

### Compile tests of the gross meters (`tests/test_compile_gross.py`)

These tests prove the solar setup's gross meters against Home Assistant's own statistics:
what the energy dashboard will show. They need the recorder before Home Assistant starts
(`mock_recorder_before_hass` + `recorder_mock`), so they live in a module of their own.

- **Setup:** the helpers are created through the real WebSocket commands
  (`solar_setup_preview`, then `create_solar_setup` with what the preview showed). Each
  command opens a new connection with a fresh access token: the time moves on by hours,
  so a first token expires and an idle connection misses its heartbeats.
- **History probe:** `solar_setup.async_probe` is replaced (autouse fixture
  `lifetime_inputs`): every input is a lifetime counter, every power is signed, because
  the statistics only begin with the test. The setup's own judgement is tested in
  `test_solar_setup.py`.
- **Circuit model:** `Circuit` holds the load and the solar (W) and counts each method's
  meters as the real device would (EM import and export apart, a plug's "Energy" both
  ways, a signed net meter, the solar's lifetime counter), with switches for offline,
  `unknown`, `restored`, kW units, slow polling and a parent meter. `consumed` (read with
  `truth()`) keeps the true kWh per hour for the hand calculations in each test.
- **Clock and timing helpers:** `Clock.run` moves frozen time (`freezer`) a minute at a
  time from `EPOCH` (2026-11-20 10:00 UTC; `DST_EPOCH` for the fall-back day in the tests'
  US/Pacific zone).
  - Every report happens one second before a whole minute (`EARLY`), so a value posted
    just before an hour ends belongs to that hour.
  - Within a minute the inputs report `STAGGER` (1 ms) apart. With equal timestamps the
    recorder's "state at period start" query returns a template's intermediate and final
    state together, which real Home Assistant never does.
  - Timers fire with `async_fire_time_changed_exact` plus `SLACK` (5 ms): the normal
    helper adds 0.5 s, which an integral books as extra time.
  - At every 5-minute boundary: `async_wait_recording_done`, `do_adhoc_statistics` for
    the period that ended (the hour compiles at :55), `async_wait_recording_done` again.
  - Results are read with `statistics_during_period` (`hour` or `5minute`, `change`).
  - Home Assistant renders a `now()` template at the start of each minute, the harness at
    the minute's report, so a hold ends 11 minutes after a dropout here and after 10 to
    11 minutes in Home Assistant.
- **What they cover:** each method's formula, lag dips that cancel, unit changes, a
  restart of the helpers, invert, a replaced input that raises `gross_off`, the solar's
  hold (short and long dropouts, `unknown` and restored states, the sun rising during
  the hold), From power never falling in a dropout, the night pause of the counter path,
  constant sources without lag (the 1-minute `max_sub_interval`), a circuit power offline
  (`gross_unknown`), a solar term reused by a nested setup, and the DST fall-back. The
  hourly numbers are the same on 2026.10 and 2026.11.
- **Runtime:** about 2 to 3 seconds per test, about one minute for the 22 tests. Run them
  alone with `pytest tests/test_compile_gross.py --no-cov`.

### Panel round trip (`tests/test_panel_roundtrip.py`)

The solar setup with exactly the messages the panel builds: `panel_message` and
`panel_create` mirror `_message()` and `_create()` of `panel/src/solar-setup.ts` (only the
user's choices; on create what the preview showed). A change to what the panel sends needs
the same change here. It covers EM, inputs judged by the user (no statistics), a draft-only
device with From power, and the `not_offered` answer for a refused draft power (which
power, and why).

## Panel

```bash
cd panel && npm ci && npm run typecheck && npm test && npm run build
```

Node version: `panel/.nvmrc`. Tests run with Vitest and happy-dom. Always commit the rebuilt
bundles; CI fails if they differ from the source.

## CI

- **Tests** (`tests.yml`): pytest on the minimum and on the latest Home Assistant.
- **Validate** (`validate.yml`): hassfest, ruff, mypy (minimum and latest), panel
  typecheck/test/build plus the bundle check, and `hacs/action` with
  `category: integration` and **no ignores** (skipped while the repo is private; never add
  ignores to make it pass).

## Live tests

Unit tests do not cover how the panel looks in a real Home Assistant. Before a release, test
on a local HA instance of the minimum version and of the latest release:

1. Copy `custom_components/energy_flow_mapper/` into the test instance's
   `config/custom_components/`.
2. (Re)start the instance. Bundle URLs are hashed at startup, so a new bundle needs a
   restart, not only a page reload.
3. Reload the page (Ctrl+F5) and check panel and card, in light and dark theme and at phone
   width.

Live values for sources and devices can be faked with temporary states
(`POST /api/states/sensor.x`); they are gone after the next restart.

Never restart or reload the maintainer's own Home Assistant; `scripts/deploy.sh` only copies
the files.
