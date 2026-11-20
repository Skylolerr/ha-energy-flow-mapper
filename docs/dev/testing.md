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

A recreated venv needs the stubs again. Linux/macOS and CI need nothing special.

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
