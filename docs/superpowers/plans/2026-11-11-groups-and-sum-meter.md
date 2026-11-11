# Groups and Sum Meters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free, nestable device groups in the Electricity and Water tabs (panel and card), stored by Energy Flow Mapper, plus a "Create sum meter" dialog that turns a group (or freely chosen sensors) into a real HA sensor-group helper.

**Architecture:** Groups live in a new store `.storage/energy_flow_mapper.groups`; all group logic is pure (`groups.py` in Python, `groups.ts` in the panel) and runs on the same ordered change list as the existing draft, so check, save, backup, restore and export/import stay one path. The layout learns two new things: group blocks (collapsed) and frames (expanded). The sum meter is a `group` integration helper created through HA's config and options flows, like the integral helper.

**Tech Stack:** Python 3.14 / Home Assistant 2026.10+ (probatio, `Store`, config flows), Lit 3 + TypeScript, vitest + happy-dom, rollup.

**Spec:** `docs/superpowers/specs/2026-11-11-groups-and-sum-meter-design.md` (approved 2026-11-11), binding `SPEC.md`, project rules `CLAUDE.md`.

## Global Constraints

- Minimum Home Assistant **2026.10.0**; everything must work there (venv has 2026.10.0).
- Code, comments, docstrings, README, CHANGELOG, commit messages in **English**; every new user-facing string in `strings.json`, `translations/en.json`, `de.json`, `fr.json`, `it.json` (backend) and `panel/src/translations/{en,de,fr,it}.json` (panel) in the same change.
- Tests are mandatory, target ≥ 90 % overall; `groups.py` like `hierarchy.py`: **100 %**.
- Never lose energy settings: writes send complete lists from a fresh deep copy; unknown fields pass through; backup before every write.
- Any store format change bumps the version and adds a migration.
- All WebSocket commands `require_admin`, except the read-only `energy_flow_mapper/card`.
- Errors: `HomeAssistantError` / `ServiceValidationError` with `translation_key`.
- `import probatio as vol`; `ConfigEntry.runtime_data`, never `hass.data`; no blocking I/O in the loop.
- Panel bundle `custom_components/energy_flow_mapper/frontend/energy-flow-mapper-panel.js` (and the card bundles) are rebuilt (`npm run build`) and committed with every panel change.
- Never restart or reload the maintainer's HA; live tests only on the local test instance `ha-test-2611` (`.claude/launch.json`), stopped right after testing.
- Commit on branch `gas-and-draft`; never push.
- Python tests on Windows: `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim …`. Panel: `cd panel && npx vitest run …`, `npx tsc --noEmit`.
- Translations wording (DE): «Gruppe», «Gruppieren», «Gruppe auflösen», «Summen-Zähler erstellen», «Auswählen», «N ausgewählt», «Auswahl aufheben», «Nur Geräte mit demselben Elternteil», «Gruppen aus Bereichen vorschlagen». Swiss German spelling (no ß).

## Review Focus

1. A device deleted or renamed in HA's own energy settings while it sits in a group → the panel and card still load; the device simply is no longer in the group (Task 2, `test_clean_drops_devices_no_longer_in_the_list`).
2. A kept draft (browser) whose groups were changed by another admin meanwhile → the hash differs, the draft is dropped with the existing message (Task 5, `test_hash_changes_when_only_groups_change`).
3. A save with only group changes → no write to HA's energy settings, but a backup with the old groups and a new hash (Task 5, `test_save_only_groups`).
4. A damaged groups file (wrong types, a device in two groups) → loads without error, keeps what is valid (Task 3, `test_load_damaged_file`; Task 2, `test_clean_device_in_two_groups_keeps_first`).
5. Card configured with `root: group:<id>` for a group that was dissolved → shows the existing "start device missing" message, never an empty or broken card (Task 11, "shows a message when the root group is gone").

## Rulings made while planning

- **No entity-rename listener.** HA's energy integration (2026.10.0) does not follow entity ID renames (no registry listener in `components/energy`); groups behave the same: clean-up drops the renamed statistic from its group. The design asked to "follow the same behaviour".
- **`ignore_non_numeric` is set through the options flow.** The `group` config flow's `sensor` step has no `ignore_non_numeric` field and a config entry without it defaults to **True** (`group/sensor.py`), so `sum_meter.py` creates the entry, then runs the options flow with `ignore_non_numeric: False`.
- **Unit conversion is handled by HA's sensor group** (it converts members of one device class to the group's unit), so mixed Wh/kWh needs no refusal. **Mixed state classes are refused**: the group then has no state class and the energy dashboard rejects it.
- **Group values are computed in the panel and card only** (TypeScript); the backend never sums groups.

## File Structure

| File | Responsibility |
|---|---|
| `custom_components/energy_flow_mapper/groups.py` (new) | Pure: group types, clean-up, applying all draft changes (device, source and group) in order, group diff, groups hash |
| `custom_components/energy_flow_mapper/group_store.py` (new) | `GroupStore`: load (tolerant), save, migration hook, remove |
| `custom_components/energy_flow_mapper/sum_meter.py` (new) | Create the sum helper(s) through the `group` config + options flow |
| `custom_components/energy_flow_mapper/const.py` | `GROUPS_STORAGE_VERSION`, `GROUPS_STORAGE_KEY`, `STORAGE_MINOR_VERSION` for backups |
| `custom_components/energy_flow_mapper/backups.py` | `Backup.groups`, minor version 2 + migration |
| `custom_components/energy_flow_mapper/transfer.py` | Export format version 2 with `data.groups` |
| `custom_components/energy_flow_mapper/websocket.py` | Schemas, `get`/`validate`/`save`/`restore`/`export`/`import*`/`card` with groups, `create_sum_meter` |
| `custom_components/energy_flow_mapper/models.py`, `__init__.py`, `diagnostics.py` | Wire the store; remove it with the entry; diagnostics |
| `panel/src/groups.ts` (new) | Pure TS mirror: apply group changes, clean-up, display tree, group values, area suggestions, `canGroup` |
| `panel/src/types.ts` | `Group`, `Groups`, new `Change` members, `Snapshot.groups`, `DiffEntry` group types |
| `panel/src/layout.ts` | Group blocks, frames, extra span for frames |
| `panel/src/energy-flow-mapper-panel.ts` | Rendering, collapse, multi-select, drag rules, dialogs, suggestions, sum meter dialog |
| `panel/src/card.ts`, `card-config.ts` | Groups on the card, toggle, `root: group:<id>`, editor |
| `SPEC.md`, `README.md`, `CHANGELOG.md` | Docs |

## Shared data shapes (used by every task)

```python
# groups.py
class Group(TypedDict):
    id: str            # uuid4 hex, made by the panel
    name: str
    parent: str | None # real parent statistic; None = Home
    group: str | None  # enclosing group id; None = top level of its parent
    members: list[str] # device statistics directly in this group
type Groups = dict[str, list[Group]]   # by DeviceKind value: "electricity", "water"
```

Store file content: `{"groups": Groups}`.

New change types (all optional `kind`, default electricity; `GROUP_CHANGE_TYPES` in `groups.py`):

| type | fields |
|---|---|
| `create_group` | `id`, `name`, `parent`, `group` (opt.), `members: [stat]`, `groups: [id]` |
| `rename_group` | `id`, `name` |
| `set_group` | exactly one of `stat` / `group_id`, plus `group: id \| None` |
| `dissolve_group` | `id` |
| `move_group` | `id`, `parent`, `group` (opt.) |

`ChangeError` codes (translation keys, backend + panel): `unknown_group`, `group_parents_differ`, `group_loop`, `group_name_empty`, `group_name_taken`, `group_exists`.

Diff entries (`DiffEntry.type` additions): `group_created` (`id`, `name`, `count`), `group_renamed` (`id`, `from`, `to`), `group_dissolved` (`id`, `name`), `group_changed` (`id`, `name`, `count`), each with `kind` and `stat` set to `group:<id>` (the panel's diff list keys entries by `stat`). `summarize` counts them by type like every other entry.

---

### Task 1: SPEC.md carries the approved design

**Files:**
- Modify: `SPEC.md` (§2 rows, §6, §8, §9, §11, §12, §17)

- [ ] **Step 1: Write the SPEC changes (German, like the rest of SPEC.md)**
  - §2: change row «Source of Truth» to: «Die Energie-Konfiguration von HA. Die Integration speichert dazu nur Sicherungen, ihre angelegten Helfer, ignorierte Vorschläge und ab v0.9.0 die Gruppen (reine Darstellung)»; new rows «Gruppen» and «Summen-Zähler» with the maintainer decisions of 2026-11-11 from the design ("Decisions by the maintainer") and a pointer to the design file.
  - §6: groups in panel (collapsed block, frame, start collapsed, multi-select, drag rules, actions, suggestions from areas) and card (`root` accepts `group:<id>`, toggling).
  - §8: the five change types and the rule "same real parent"; `remove`/`use_as_home_meter` take groups along; `move` leaves the group when the parent changes.
  - §9: the six error codes.
  - §11: store `.storage/energy_flow_mapper.groups`, backups with `groups` (minor version 2), export version 2.
  - §12: `get`/`card` return `groups`; `hash` covers groups; `create_sum_meter`.
  - §17: v0.9.0 entry lists groups and sum meters.
- [ ] **Step 2: Commit**

```bash
git add SPEC.md
git commit -m "Specify groups and sum meters"
```

---

### Task 2: `groups.py` – data and clean-up

**Files:**
- Create: `custom_components/energy_flow_mapper/groups.py`
- Test: `tests/test_groups.py`

**Interfaces:**
- Produces: `Group`, `Groups` (above); `GROUP_KINDS = (DeviceKind.ELECTRICITY, DeviceKind.WATER)`; `empty_groups() -> Groups` (both kinds, empty lists); `clean_groups(groups: Groups, prefs: Prefs) -> Groups` (new object, never mutates input); `groups_of(groups: Groups, kind: DeviceKind) -> list[Group]`; `all_devices(groups: list[Group], group_id: str) -> list[str]` (devices of a group and its nested groups, in order).

- [ ] **Step 1: Write the failing tests** (prefs built with plain dicts as in `tests/test_hierarchy.py`)

```python
def test_clean_keeps_a_valid_group(): ...           # unchanged when all members fit
def test_clean_drops_devices_no_longer_in_the_list(): # member missing in device_consumption → dropped, group stays with the rest
def test_clean_adopts_new_common_parent():           # parent device deleted in HA, children now under grandparent → group.parent == grandparent
def test_clean_drops_member_with_other_parent():
def test_clean_moves_nested_group_with_other_parent_to_top():  # its `group` becomes None
def test_clean_removes_groups_without_devices():     # also a group containing only an empty group
def test_clean_device_in_two_groups_keeps_first():
def test_clean_unknown_enclosing_group_becomes_top_level():
def test_clean_water_groups_use_water_devices():
def test_all_devices_includes_nested_groups():
```

Expected values for the adopt case: devices `a` (parent `p`), `b`, `c` with `included_in_stat: "a"`; group `{parent: "a", members: ["b", "c"]}`; after deleting `a` from prefs (so `b`, `c` have parent `None` because HA moved them up) → `clean_groups(...)[...][0]["parent"] is None` and members `["b", "c"]`.

- [ ] **Step 2: Run them, expect FAIL (module missing)**

Run: `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_groups.py -q`

- [ ] **Step 3: Implement** in `groups.py` (no HA imports; may import from `.hierarchy`). Clean-up order exactly as the design's five steps; a member's real parent comes from `hierarchy.parent_map`.
- [ ] **Step 4: Run, expect PASS**
- [ ] **Step 5: Commit** `git commit -m "Add pure group data and clean-up"`

---

### Task 3: `GroupStore`

**Files:**
- Create: `custom_components/energy_flow_mapper/group_store.py`
- Modify: `const.py`, `models.py`, `__init__.py` (setup + `async_remove_entry`), `diagnostics.py`
- Test: `tests/test_group_store.py`, `tests/test_init.py`, `tests/test_diagnostics.py`

**Interfaces:**
- Consumes: `Groups`, `empty_groups()` (Task 2)
- Produces: `GROUPS_STORAGE_VERSION = 1`, `GROUPS_STORAGE_KEY = f"{DOMAIN}.groups"`; `class GroupStore(hass)` with `async_load() -> None`, `groups() -> Groups` (deep copy), `async_save(groups: Groups) -> None`, `async_remove() -> None`; `EnergyFlowMapperData.groups: GroupStore`.

- [ ] **Step 1: Write failing tests**
  - `test_load_empty` → `groups() == empty_groups()`
  - `test_save_and_load_again` (round trip through a second `GroupStore`)
  - `test_load_damaged_file`: file with `{"groups": {"electricity": [{"id": 1}, "x", {"id": "g", "name": "K", "parent": None, "group": None, "members": ["sensor.a"]}], "gas": [...]}}` → only the valid group under electricity, no `gas` key, water empty
  - `test_groups_returns_a_copy`
  - `test_remove_entry_deletes_groups` (in `test_init.py`)
  - diagnostics contain `groups` (in `test_diagnostics.py`)
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** like `SuggestionStore`; `Store(hass, GROUPS_STORAGE_VERSION, GROUPS_STORAGE_KEY)`; pass a `minor_version=1` and an `_async_migrate_func` that returns the data unchanged for now (the hook the rule asks for).
- [ ] **Step 4: Run, expect PASS** (`tests/test_group_store.py tests/test_init.py tests/test_diagnostics.py`)
- [ ] **Step 5: Commit** `git commit -m "Store groups in their own file"`

---

### Task 4: Applying changes with groups

**Files:**
- Modify: `custom_components/energy_flow_mapper/groups.py`
- Test: `tests/test_groups.py`

**Interfaces:**
- Consumes: `hierarchy.apply_changes`, `ChangeError`, `ChangeType`, `DEVICE_KEYS`
- Produces: `GROUP_CHANGE_TYPES: frozenset[str]`; `apply_all(prefs: Prefs, groups: Groups, changes: Sequence[Mapping[str, Any]]) -> tuple[dict[str, Any], Groups]` — applies changes in order: group types change the groups, all others go to `hierarchy.apply_changes`; after each change the groups are cleaned against the new prefs. `diff_groups(old: Groups, new: Groups) -> list[dict[str, Any]]`; `state_hash(prefs: Prefs, groups: Groups) -> str` (= `prefs_hash({"prefs": prefs, "groups": groups})`).

Behaviour pinned by the tests:

- `create_group`: all `members` and all `groups` must have real parent `parent` (else `group_parents_differ`); `group` (enclosing) must exist with the same parent; `id` new (`group_exists`); name stripped, not empty (`group_name_empty`), unique among groups with the same `parent` in that kind (`group_name_taken`). Members leave their previous group.
- `rename_group`: same name rules.
- `set_group`: the device's/group's parent must equal the target group's parent (`group_parents_differ`); a group into itself or into one of its nested groups → `group_loop`; `group: None` takes it out.
- `dissolve_group`: members and nested groups go to the dissolved group's enclosing group (or top level).
- `move_group`: every device of `all_devices(group)` gets `included_in_stat = parent` (through `hierarchy.apply_changes` `move`s); the group and all nested groups get `parent`; the group gets `group` (opt.; must have that parent). Moving onto one of its own devices → `group_loop`.
- `move` of a device: when its group's parent differs from the new parent, it leaves the group (follows from clean-up).
- `remove` / `use_as_home_meter` of device X: every group with `parent == X` gets X's parent (rewrite **before** cleaning, so grouping is kept).

- [ ] **Step 1: Write the failing tests**

```python
def test_create_group(): ...
def test_create_group_refuses_members_of_other_parents():   # ChangeError code "group_parents_differ"
def test_create_group_nests_groups():
def test_group_name_rules():          # "" → group_name_empty, duplicate below same parent → group_name_taken, same name below other parent ok
def test_rename_group():
def test_set_group_in_and_out():
def test_set_group_refuses_loop():
def test_dissolve_group_moves_members_up_one_level():
def test_move_group_moves_all_devices_and_nested_groups():
def test_move_group_onto_own_device_is_a_loop():
def test_move_out_of_parent_leaves_group():
def test_remove_parent_keeps_groups_below_it():          # parent X removed → groups now under X's parent with the same members
def test_use_as_home_meter_keeps_groups_below_it():
def test_unknown_group_id():                              # every group change type → unknown_group
def test_apply_all_leaves_inputs_unchanged():
def test_diff_groups():                                   # created / renamed / dissolved / changed entries with kind
def test_state_hash_changes_with_groups():
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** `apply_all`, `diff_groups`, `state_hash`. `hierarchy.py` stays unchanged: `summarize` already counts diff entries by `type`, so the caller passes `diff(...) + diff_groups(...)` and the backup summary gets `group_created` etc. as their own counts.
- [ ] **Step 4: Run, expect PASS**, and coverage of `groups.py` 100 %:
  `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_groups.py tests/test_hierarchy.py -q --cov=custom_components.energy_flow_mapper.groups --cov-report=term-missing`
- [ ] **Step 5: Commit** `git commit -m "Apply group changes together with the draft"`

---

### Task 5: WebSocket – get, validate, save with groups

**Files:**
- Modify: `custom_components/energy_flow_mapper/websocket.py`, `backups.py`, `const.py`, `strings.json`, `translations/*.json`
- Test: `tests/test_websocket.py`, `tests/test_backups.py`, `tests/test_translations.py`

**Interfaces:**
- Consumes: `apply_all`, `clean_groups`, `diff_groups`, `state_hash` (Task 4), `runtime.groups` (Task 3)
- Produces:
  - `CHANGE_SCHEMA` accepts the five group change types (`kind` limited to `_KINDS`).
  - `get` result: `groups` (cleaned), `hash = state_hash(prefs, cleaned_groups)`.
  - `_async_current(hass, runtime, base_hash) -> tuple[dict, Groups]` compares against `state_hash`.
  - `validate`/`save` use `apply_all`; `diff` = `diff(prefs, new) + diff_groups(old_groups, new_groups)`.
  - `BackupStore.async_add(data, user_id, user_name, summary, groups: Groups | None = None)`; `Backup` gets `NotRequired[groups]`; backups store `minor_version` 2 with a migration that leaves old entries as they are.
  - Save order: check → backup (with `groups` when they changed) → energy write only if energy keys changed → `runtime.groups.async_save(new_groups)` only if groups changed → result `{hash: state_hash(...), backup_id}`. If HA rejects the energy write, groups are not saved.
  - ChangeError codes of Task 4 as backend translations (`exceptions` in `strings.json` and all four translation files).

- [ ] **Step 1: Write the failing tests**
  - `test_get_returns_cleaned_groups`
  - `test_hash_changes_when_only_groups_change` (save groups → `get` hash differs; a `validate` with the old hash → error `conflict`)
  - `test_validate_group_changes` (diff contains `group_created`)
  - `test_save_groups_with_device_change` (both written, one backup holding old prefs and old groups)
  - `test_save_only_groups` (energy write not called — patch `energy_access.async_write` and assert not awaited; backup has `groups`; hash new)
  - `test_save_rejected_by_ha_keeps_groups` (energy write raises → store unchanged)
  - `test_group_change_error_is_translated` (`group_parents_differ` → `HomeAssistantError` translation key)
  - `test_backup_migration_keeps_old_backups` (in `test_backups.py`: a v1.1 file loads, entries have no `groups`)
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `tests/test_websocket.py tests/test_backups.py tests/test_translations.py`, expect PASS
- [ ] **Step 5: Commit** `git commit -m "Validate and save groups with the draft"`

---

### Task 6: Restore, export/import and card command with groups

**Files:**
- Modify: `websocket.py`, `transfer.py`
- Test: `tests/test_websocket.py`, `tests/test_transfer.py`

**Interfaces:**
- Produces:
  - `restore`: when the backup has `groups`, they are restored (after backing up the current groups); otherwise groups stay.
  - `EXPORT_VERSION = 2`; `build_export(data, exported, backup=None, groups: Groups | None = None)` writes `data.groups`; `parse_import(document) -> tuple[dict[str, list[Any]], Groups | None]` accepts versions 1 and 2 (`groups` only in 2, schema: dict of kind → list of dict).
  - `import_check` / `import`: groups go through `clean_groups` against the imported prefs; diff includes group entries; version 1 files leave groups unchanged.
  - `card` result: `groups` = cleaned groups of its `kind` (list of `{id, name, parent, group, members}`).
- [ ] **Step 1: Write the failing tests**
  - `test_restore_brings_back_groups`, `test_restore_old_backup_leaves_groups`
  - `test_export_contains_groups`, `test_import_version_1_leaves_groups`, `test_import_version_2_sets_groups`, `test_import_rejects_bad_groups` (`invalid_import`)
  - `test_card_returns_groups_of_its_list` (non-admin user, water groups not in electricity card)
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `tests/test_websocket.py tests/test_transfer.py`, expect PASS
- [ ] **Step 5: Commit** `git commit -m "Restore, export and show groups on the card"`

---

### Task 7: Sum meter helper

**Files:**
- Create: `custom_components/energy_flow_mapper/sum_meter.py`
- Modify: `websocket.py`, `strings.json`, `translations/*.json`
- Test: `tests/test_sum_meter.py`, `tests/test_websocket.py`

**Interfaces:**
- Produces:
  - `async_create_sum(hass, name: str, entity_ids: list[str]) -> tuple[str, str]` (entry ID, entity ID): `group` config flow → menu step `sensor` → `{name, entities, hide_members: False, type: "sum"}`; then options flow of the new entry → `{entities, hide_members: False, ignore_non_numeric: False, type: "sum"}`.
  - `check_sum_members(hass, entity_ids, kind) -> None`: raises `ServiceValidationError` `sum_not_possible` with placeholder `entity` when a member is not a `sensor` entity, has the wrong device class (energy / water), a state class other than `total`/`total_increasing`, or when the state classes differ (`sum_state_classes_differ`).
  - WebSocket `energy_flow_mapper/create_sum_meter` (`kind`, `name`, `entity_ids` (min 1), optional `rate_entity_ids`) → `{entity_id, stat_rate}`: checks, creates the energy/water sum named «<name> energy» / «<name> water» (translated name passed by the panel as `name`, the backend appends nothing), and when `rate_entity_ids` is given and non-empty a second sum of those as `stat_rate`; both entry IDs into `runtime.helpers` (`async_add`).
- [ ] **Step 1: Write the failing tests**
  - `test_creates_sum_without_ignoring_non_numeric` (entry options: `type == "sum"`, `ignore_non_numeric is False`; with two `total_increasing` kWh sensors the new sensor has `state_class total_increasing`, `device_class energy`)
  - `test_converts_mixed_units` (Wh + kWh member → numeric sum in kWh)
  - `test_refuses_external_statistic`, `test_refuses_wrong_device_class`, `test_refuses_mixed_state_classes`
  - `test_ws_create_sum_meter_with_rate` (two helpers, both marked as created)
  - `test_ws_create_sum_meter_requires_admin`
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** next to `integral.py` (same failure key style: `sum_failed`).
- [ ] **Step 4: Run** `tests/test_sum_meter.py tests/test_websocket.py`, expect PASS; then the full suite with coverage:
  `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim` → all pass, ≥ 90 %, `groups.py` 100 %; `ruff check . && ruff format --check . && mypy custom_components/energy_flow_mapper` clean.
- [ ] **Step 5: Commit** `git commit -m "Create sum meters as Home Assistant group helpers"`

---

### Task 8: Panel – types and `groups.ts`

**Files:**
- Create: `panel/src/groups.ts`
- Modify: `panel/src/types.ts`
- Test: `panel/test/groups.test.ts`

**Interfaces:**
- Produces (TS mirror of Task 2/4, same rules and error codes, but like `applyChanges` it **skips** changes that do not fit instead of throwing):
  - `types.ts`: `interface Group { id: string; name: string; parent: string | null; group: string | null; members: string[] }`, `type Groups = Partial<Record<DeviceKind, Group[]>>`; `Change` gains the five group types (with `kind?: DeviceKind`); `Snapshot.groups?: Groups`; `DiffEntry.type` gains `group_created | group_renamed | group_dissolved | group_changed`, with optional `id`, `name`, `count`.
  - `groups.ts`:
    - `applyGroupChanges(devicesBefore: Device[], groups: Group[], changes: Change[], kind: DeviceKind): Group[]` (uses `applyChanges` from `draft.ts` for device changes in order)
    - `cleanGroups(groups: Group[], devices: Device[]): Group[]`
    - `groupDevices(groups: Group[], id: string): string[]`
    - `type DisplayNode = { type: "device"; node: TreeNode; children: DisplayNode[] } | { type: "group"; group: Group; children: DisplayNode[] }`
    - `displayTree(roots: TreeNode[], groups: Group[]): DisplayNode[]` (groups inserted between each parent and its grouped children, nested groups inside, order: first member position)
    - `groupValue(node: DisplayNode, values: Map<string, number | null>): number | null` (sum of direct children; groups recursive; `null` when no child has a value; children without a value are skipped)
    - `canGroup(devices: Device[], groups: Group[], selection: string[]): boolean` (selection of stats and `group:<id>` ids; same real parent)
    - `areaGroups(devices: Device[], groups: Group[], stats: Record<string, StatInfo>, names: (area: string) => string): Change[]` (`create_group` per parent and area with ≥ 2 ungrouped children; `id` from `crypto.randomUUID().replaceAll("-", "")`)
    - `GROUP_PREFIX = "group:"`, `groupBlockId(id: string): string`
- [ ] **Step 1: Write the failing tests** in `panel/test/groups.test.ts`: one `it` per Python test of Tasks 2 and 4 that has a TS counterpart (same inputs, same expected groups; "refuses" cases expect the change to be skipped), plus
  - "builds the display tree with nested groups"
  - "sums the direct children of a group, skipping unknown values"
  - "allows grouping only with the same parent"
  - "suggests one group per parent and area with two or more children"
- [ ] **Step 2: Run** `cd panel && npx vitest run test/groups.test.ts`, expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** again + `npx tsc --noEmit`, expect PASS
- [ ] **Step 5: Commit** `git commit -m "Add group logic to the panel"`

---

### Task 9: Layout – group blocks and frames

**Files:**
- Modify: `panel/src/layout.ts`
- Test: `panel/test/layout.test.ts`

**Interfaces:**
- Consumes: `DisplayNode` (Task 8)
- Produces:
  - `BlockKind` gains `"group"`; `Block.group?: Group`; `EdgeKind` gains `"group"` (drawn like `device`).
  - `interface Frame { id: string; x: number; y: number; w: number; h: number; group: Group }`; `Layout.frames: Frame[]` (empty array when no group is expanded; existing callers keep working).
  - `layout(roots: DisplayNode[] | TreeNode[], …)` — same parameters; `TreeNode[]` input still accepted (wrapped as device nodes) so the card and export keep working until Tasks 10/11.
  - A collapsed group (`collapsed.has(groupBlockId(id))`) is one block `group:<id>`, no children. An expanded group is a header block `group:<id>` plus a frame around the header and all blocks below it; `FRAME_PAD = 12` on every side; a group item's span across the flow is its children's span `+ 2 * FRAME_PAD`.
- [ ] **Step 1: Write the failing tests**
  - "draws a collapsed group as one block with one edge to its parent"
  - "draws an expanded group as a frame around its sub-tree"
  - "frames of siblings never overlap, nested frames lie inside their outer frame" (both orientations)
  - "keeps the old output for trees without groups" (existing snapshot-style test still passes; `frames` is `[]`)
- [ ] **Step 2: Run** `npx vitest run test/layout.test.ts`, expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run**, expect PASS
- [ ] **Step 5: Commit** `git commit -m "Lay out groups as blocks and frames"`

---

### Task 10: Panel – show, select, group and drag

**Files:**
- Modify: `panel/src/energy-flow-mapper-panel.ts`, `panel/src/export.ts`, `panel/src/translations/{en,de,fr,it}.json`
- Test: `panel/test/panel.test.ts` (new `describe("groups")`), `panel/test/export.test.ts`

**Interfaces:**
- Consumes: Tasks 8, 9; `Snapshot.groups`
- Produces: panel state `_groups` derived as `applyGroupChanges(saved devices, snapshot.groups[kind], draft, kind)`; group changes are ordinary draft entries (undo, kept draft, check and save unchanged).

Behaviour (each line has an `it` below):
- groups start collapsed on load (`_collapsed` gets every `group:<id>` once per load); a group created in this session starts expanded;
- collapsed group block: name, «N Geräte» (all devices inside), value from `groupValue` in the period's unit; dashed border (`.block.group`); tap opens the group actions dialog;
- the frame header «▾ <name> · <value>» toggles; the toggle on a collapsed block «▸»;
- search and `_reveal` open collapsed groups above the match;
- Ctrl/Cmd+click adds/removes a block to `_multi: Set<string>`; toolbar button «Auswählen» toggles a touch mode where a tap does the same; with a selection, the footer shows «N ausgewählt · Gruppieren · Auswahl aufheben»; «Gruppieren» is disabled with title «Nur Geräte mit demselben Elternteil» when `canGroup` is false; «Gruppieren» asks for a name (existing name dialog style) and adds `create_group`;
- dragging a device/group onto a group block or frame: same parent → `set_group`; other parent → `move` + `set_group` (device) or `move_group` with `group` (group); onto a device → `move_group` for a group; out of a frame onto the real parent → `set_group` with `group: null`;
- the confirm dialog lists the group diff entries («Gruppe «Küche» erstellt (4 Geräte)», …);
- the PNG export draws groups as currently shown (collapsed blocks / frames).
- [ ] **Step 1: Write the failing tests** (snapshot fixture gets `groups: { electricity: [{ id: "g1", name: "Media", parent: "sensor.server", group: null, members: ["sensor.sonos"] }] }` plus a second child of `sensor.server` added to the fixture)
  - "shows a saved group collapsed with its device count and value"
  - "expands a group into a frame and collapses it again"
  - "opens a collapsed group when search finds a device inside"
  - "selects several devices with Ctrl+click and groups them"
  - "selects with the touch mode"
  - "does not group devices of different parents"
  - "drags a device into a group and out again"
  - "drags a device of another parent into a group: move and set_group"
  - "drags a group onto a device: move_group"
  - "lists group changes in the confirm dialog"
  - "keeps group changes in the kept draft" (localStorage round trip)
  - export test: "draws groups in the image"
- [ ] **Step 2: Run** `npx vitest run test/panel.test.ts test/export.test.ts`, expect FAIL
- [ ] **Step 3: Implement**, with all new strings in the four panel translation files
- [ ] **Step 4: Run**, expect PASS; `npx tsc --noEmit`
- [ ] **Step 5: Commit** `git commit -m "Show, select and drag groups in the panel"`

---

### Task 11: Panel – group actions, area suggestions, sum meter dialog

**Files:**
- Modify: `panel/src/energy-flow-mapper-panel.ts`, `panel/src/translations/*.json`
- Test: `panel/test/panel.test.ts`

**Interfaces:**
- Consumes: `areaGroups`, `groupDevices` (Task 8); WS `create_sum_meter` (Task 7)
- Produces: the dialogs; draft sequences for the sum meter:
  - **from a group G** (real parent P): call `create_sum_meter` with `entity_ids = groupDevices(G)` + added sensors, `rate_entity_ids` = their devices' `stat_rate` only if every device in the sum has one; then draft: `add {stat: new, parent: P, stat_rate}`; for each nested group of G: `move_group {id, parent: new}`; for each direct member device of G and each added device: `move {stat, parent: new}`; finally `dissolve_group` is **not** used — G is removed by the clean-up once empty (its nested groups now have parent `new`, its members left it by moving).
  - **free** (opened on device D with real parent P): preselected D; `add {stat: new, parent: P}`; `move` of every device in the sum below `new`; sources in the sum stay sources.

Behaviour:
- tap on a group → dialog «<name>» with «Umbenennen» (`rename_group`), «Gruppe auflösen» (`dissolve_group`), «Summen-Zähler erstellen»;
- device actions gain «Summen-Zähler erstellen»;
- sum dialog: name field (default «<group or device name> Energie» / «… Wasser»), list of sensors in the sum; from a group the group's devices are fixed (no remove button); «Sensor hinzufügen» picks from devices and source sensors of the tab; sensors that cannot be summed (external statistic, other device class or state class, read from `stats`) are shown with the reason and block «Erstellen»; errors of the backend shown as today;
- toolbar «Gruppen aus Bereichen vorschlagen» adds all `areaGroups` changes as one undo step (`_draft` push of several changes, undo removes them together — reuse the bundling used by «Alle Vorschläge übernehmen»); a toast if there is nothing to suggest;
- undo after creating a sum meter takes back the draft changes; the helper stays (existing integral wording «Der Helfer bleibt bestehen»).
- [ ] **Step 1: Write the failing tests**
  - "renames and dissolves a group"
  - "creates a sum meter from a group: add, move_group and moves, group gone"
  - "creates a free sum meter from a device with a solar source added"
  - "refuses a sum with an external statistic"
  - "suggests groups from areas as one undo step"
  - "says when there is nothing to suggest"
- [ ] **Step 2: Run**, expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run**, expect PASS; `npx tsc --noEmit`
- [ ] **Step 5: Commit** `git commit -m "Add group actions, area suggestions and the sum meter dialog"`

---

### Task 12: Card – groups and group as root

**Files:**
- Modify: `panel/src/card.ts`, `panel/src/card-config.ts`, `panel/src/translations/*.json`
- Test: `panel/test/card.test.ts`

**Interfaces:**
- Consumes: `card` result `groups` (Task 6), `displayTree`, `groupValue`, `layout` frames (Tasks 8–9)
- Produces: card renders group blocks/frames; tap on a group toggles it (in-memory `Set`, all groups collapsed on first render); `root` accepts `group:<id>` (then the tree is that group's display node, no sources, no Home); the editor's root picker lists groups of the chosen list after devices (labels «Gruppe: <name>»).
- [ ] **Step 1: Write the failing tests**
  - "shows groups collapsed and toggles them"
  - "starts at a group"
  - "shows a message when the root group is gone" (uses existing `card_root_missing`)
  - "lists groups in the editor's start picker"
- [ ] **Step 2: Run** `npx vitest run test/card.test.ts`, expect FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** the whole panel suite `npx vitest run`, `npx tsc --noEmit`, `npm run build`; expect all green and rebuilt bundles
- [ ] **Step 5: Commit** (with the rebuilt bundles in `custom_components/energy_flow_mapper/frontend/`) `git commit -m "Show groups on the dashboard card"`

---

### Task 13: Docs, full checks and live test

**Files:**
- Modify: `README.md`, `CHANGELOG.md` (`[Unreleased]`), `SPEC.md` §17 status

- [ ] **Step 1: Docs**
  - README: features («Groups», «Sum meters»), usage table rows (group, add to group, dissolve, create sum meter, card from a group), «Good to know» (groups are only shown by Energy Flow Mapper; HA's energy dashboard sees a sum meter as a normal device), known limitation: a member meter that resets to 0 makes a sum drop, as with HA's own sensor groups.
  - CHANGELOG `[Unreleased]` ✨ Added: groups, sum meters, card groups.
- [ ] **Step 2: Full checks**
  - `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim` → all pass, coverage ≥ 90 %, `groups.py` 100 %
  - `ruff check . && ruff format --check . && mypy custom_components/energy_flow_mapper` → clean
  - `cd panel && npx tsc --noEmit && npx vitest run && npm run build` → green; `git status` shows no bundle diff after the build
- [ ] **Step 3: Live test on `ha-test-2611`** (copy the integration into its config, start it with `preview_start {name: "ha-test-2611"}`, sign in as the trusted-network test user):
  - group three devices, collapse/expand, save, reload → group still there;
  - nest a group, drag a device out, dissolve;
  - create a sum meter from a group → helper exists with `ignore_non_numeric` off, new device with the members below it, energy dashboard of the test instance shows it;
  - card with `root: group:<id>` on a test dashboard;
  - stop the server right after (`preview_stop`).
- [ ] **Step 4: Commit** `git commit -m "Document groups and sum meters"`
