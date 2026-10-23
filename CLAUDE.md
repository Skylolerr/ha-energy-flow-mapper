# CLAUDE.md – Energy Flow Mapper

Home Assistant custom integration with its own admin panel to view and edit the energy
dashboard configuration visually: which sensors are sources (grid import/export, solar,
battery), which are devices, and which device is included in which.

**`SPEC.md` is the binding specification.** Decisions in SPEC.md §2 are fixed. If something
is unclear or cannot be implemented with the current Home Assistant release, ask the
maintainer instead of deviating.

## Project facts

- Domain: `energy_flow_mapper` – integration code lives in `custom_components/energy_flow_mapper/`
- Repo: `Skylolerr/ha-energy-flow-mapper`, license MIT (Copyright skylolerlp)
- Local folder is `HA Energy Hierarchy` (working name before the rename)
- Minimum Home Assistant version: **2026.10.0** (`hacs.json`), raised together with the
  maintainer whenever a new HA release has been tested
- `integration_type: service`, `single_config_entry`, **no devices and no entities**
- Source of truth: **HA's energy preferences**. The integration only stores backups
  (`.storage/energy_flow_mapper.backups`)
- All tree logic lives in `hierarchy.py` as pure functions (no HA imports needed to test it)
- `energy_access.py` is the only module that touches the internals of HA's `energy`
  integration (`async_get_manager`, `manager.data`, `manager.async_update`)

## Separate from Daily Challenge

The Daily Challenge integration lives in the sibling folder `Hacs integrationen` with its
own repo. Never create, edit or commit files of one project in the other's folder.

## Rules

- **Language:** code, comments, docstrings, README, CHANGELOG and commit messages in **English**.
  The maintainer writes in German (Swiss style); answer in German.
- **Translations:** EN is the base (`strings.json` + `translations/en.json`), plus DE, FR, IT.
  Every new user-facing string (config flow, exceptions, repair issues, panel) must be
  added to all existing translation files in the same change.
- **Tests are mandatory.** Every feature or bug fix comes with tests
  (`pytest-homeassistant-custom-component`). Target ≥ 90 % coverage of the Python
  modules. Test `hierarchy.py` changes first.
- **Never lose energy settings.** Writes always send the complete list of each changed
  key, built from a fresh deep copy; unknown fields are passed through unchanged; a
  backup is stored before every write.
- **Store changes only with a migration.** Any change to the backup store format bumps
  `STORAGE_VERSION`/minor version and adds a migration.
- **Panel bundle is committed** (from Phase 2): `custom_components/energy_flow_mapper/frontend/energy-flow-mapper-panel.js`
  is built from `panel/` and committed, because HACS runs no build step. CI checks that
  the bundle matches the source – always rebuild before committing panel changes.
- **Versioning:** SemVer. `manifest.json` `version` is the single source of the version;
  git tags / GitHub releases use the form `vX.Y.Z` and must match it. Before 1.0, minor
  releases may contain breaking changes, which must be clearly marked in CHANGELOG.md.
  Releases are real GitHub releases with a changelog, not just tags.
- **Quality:** `ConfigEntry.runtime_data` with a typed entry alias, never `hass.data`.
  Fully async, no blocking I/O in the event loop. All WebSocket commands require admin.
  Errors use `HomeAssistantError`/`ServiceValidationError` with `translation_key`.
- HA ≥ 2026.10 uses `probatio` instead of `voluptuous` (`import probatio as vol`).
- Keep commits small and focused; conventional, imperative commit subjects.

## Commands

```bash
# Setup (Python version must match the HA release)
python -m venv .venv && .venv/bin/pip install -r requirements_test.txt

# Tests with coverage (on Windows add: -p win_ha_test_shim, see below)
pytest

# Lint / format / types
ruff check . && ruff format --check .
mypy custom_components/energy_flow_mapper

# Deploy to your own HA instance (values from .env, see .env.example)
scripts/deploy.sh
```

On the maintainer's Windows machine HA cannot be imported natively. The venv contains
local-only stubs (`fcntl.py`, `resource.py`, `win_ha_test_shim.py` in
`.venv/Lib/site-packages/`); run `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim`.
A recreated venv needs these stubs again.

## Phases

See SPEC.md §17. A phase is done as a whole unless the maintainer asks for part of it.
Phase 2 (panel) only starts after the maintainer has approved Phase 1.

The `hacs/action` job is not part of `.github/workflows/validate.yml` until Phase 3
(it needs a public repo, brand icons, description and topics). Phase 3 must add it with
`category: integration` and **no ignores**.
