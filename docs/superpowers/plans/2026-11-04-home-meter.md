# Home Meter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and edit HA 2026.11's home meter, show the home consumption (measured or calculated) at Home, and a top-level "Not tracked individually" block with a warning, in panel and card.

**Architecture:** Pure rules in `hierarchy.py` (home source role, home consumption, top-level untracked, Home warning, the `use_as_home_meter` change); recency of statistics in `energy_stats.py`; support detection in `energy_access.py`; `websocket.py` adds a `home` result to period answers and a `home_supported` flag. The panel mirrors the draft rules in `draft.ts`, lays out the placeholder and the extra untracked block in `layout.ts`, and renders them in panel and card.

**Tech Stack:** Python (HA custom integration, `pytest-homeassistant-custom-component` 0.13.371 on HA 2026.10), TypeScript + Lit (vitest, happy-dom, rollup).

**Spec:** `docs/superpowers/specs/2026-11-04-home-meter-design.md` (approved 2026-11-04). `SPEC.md` is updated with its decisions in Task 6.

## Global Constraints

- Minimum HA stays 2026.10.0. Home meter UI and writes only when `home_supported`; calculated home consumption, top-level untracked and Home warning on every version.
- Writes: complete lists from a fresh deep copy, unknown fields passed through, backup first, conflict hash (unchanged mechanism).
- At most one `home` source; its statistic is `stat_energy_to`; keep `stat_rate`, `name` and unknown fields when replacing.
- Calculated home = Σ grid import − Σ grid export + Σ solar + Σ battery discharge − Σ battery charge; only for periods; only when there is at least one grid import and every statistic involved has a value; gas and water never count.
- Recency: a statistic behind the home value whose last hourly statistic ends more than **2 hours** before the end of the period makes the home value, top-level untracked and Home warning absent; the subtitle names that meter.
- Plausibility limits unchanged: > 5 % (`PLAUSIBILITY_RATIO`) and > 0.1 kWh (`PLAUSIBILITY_MIN_KWH`).
- New strings in EN (base), DE, FR, IT: Python `strings.json` + `translations/*.json` for exceptions, `panel/src/translations/*.ts` for the panel.
- Code, comments, docs in English; panel bundle rebuilt and committed; coverage ≥ 90 %.

## Review Focus

- A `home` source on HA 2026.11 that the user never touched must come out of every save byte-for-byte unchanged (including `stat_rate`, `name`, unknown keys). Test in Task 1.
- Sources with only export, or a battery with a missing period value, must give no calculated home value, never a partial sum. Test in Task 1.
- On HA 2026.10 a crafted `assign_source` with role `home` or a `use_as_home_meter` change must be refused before anything is validated by HA. Test in Task 3.
- "Use as home meter" on a device with children: children move to the top level, and undo restores both at once (it is one change). Tests in Tasks 1 and 4.
- The water tab shows no home value, no placeholder and no top-level untracked block. Test in Task 4.

---

### Task 1: Home rules in `hierarchy.py`

**Files:**
- Modify: `custom_components/energy_flow_mapper/hierarchy.py`
- Test: `tests/test_hierarchy.py`

**Interfaces:**
- Produces:
  - `SOURCE_ROLES["home"] = {TO: "home"}`; `"home"` in `EDITABLE_SOURCE_TYPES`; `AssignRole.HOME = "home"`; `ChangeType.USE_AS_HOME_METER = "use_as_home_meter"`; `IssueCode.DEVICES_EXCEED_HOME = "devices_exceed_home"`; `HOME = "home"` (statistic key used for Home in untracked maps and issues).
  - `home_stats(sources: Sequence[Mapping[str, Any]]) -> list[str]` – the statistics behind the home value: `[home stat]` if a home source exists, else all grid import/export, solar and battery statistics (empty if there is no grid import).
  - `home_consumption(sources, energy: Mapping[str, float | None]) -> tuple[float | None, str | None]` – `(value, basis)` with basis `"measured"`, `"calculated"` or `None`.
  - `home_untracked(roots: Sequence[Node], values: Mapping[str, float | None], home: float | None) -> float | None`.
  - `home_plausibility(roots, energy, home: float | None, ratio=PLAUSIBILITY_RATIO, min_amount=PLAUSIBILITY_MIN_KWH) -> Issue | None` – `Issue(DEVICES_EXCEED_HOME, WARNING, HOME, {"home": h, "devices": d, "excess": d - h})`.

- [ ] **Step 1: Write the failing tests** in `tests/test_hierarchy.py`:
  - `test_home_source_roles`: `source_roles([{"type": "home", "stat_energy_to": "sensor.main"}]) == [("home", "sensor.main")]`; `source_energy_stats` contains it.
  - `test_assign_home_adds_then_replaces`: on no home source, `assign_source role=home stat=a` adds `{"type": "home", "stat_energy_to": "a"}`; on `{"type": "home", "stat_energy_to": "a", "stat_rate": "sensor.p", "name": "Main", "x": 1}` assigning `b` keeps `stat_rate`, `name`, `x` and sets `b`.
  - `test_unassign_home_removes_source`.
  - `test_untouched_home_source_survives`: `apply_changes` with a device move leaves a home source with unknown keys equal to the input.
  - `test_use_as_home_meter`: device `main` (rate `sensor.main_power`) with children `a`, `b` → devices without `main`, `a`/`b` at top level, sources gain `{"type": "home", "stat_energy_to": "main", "stat_rate": "sensor.main_power"}`; on an existing home source → `ChangeError("home_exists")`; unknown device → `ChangeError("unknown_device")`.
  - `test_home_consumption`: measured `(5.0, "measured")`; calculated with grid import 10, export 2, solar 4, discharge 1, charge 3 → `(10.0, "calculated")`; only export → `(None, None)`; one value None → `(None, None)`; gas/water ignored.
  - `test_home_untracked_and_plausibility`: roots worth 3 + 4 and home 10 → untracked 3.0; a None root → None; home 6.0 with roots 3 + 4 → issue with `excess` 1.0 (> 5 % and > 0.1); home 10 with roots 10.3 → no issue (0.3 < 5 % of 10); home None → no issue.
  - `test_diff_home_source`: adding a home source yields `{"type": "source_added", "stat": ..., "role": "home"}`.

- [ ] **Step 2: Run them to verify they fail**
  Run: `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_hierarchy.py -q --no-cov`
  Expected: FAIL (names not defined / wrong results).

- [ ] **Step 3: Implement** the interfaces above. `_assign_source`: role `home` replaces the existing home source's `TO` or appends `{"type": "home", TO: stat}`. `_unassign_source`: home is not a grid, so the whole entry goes (existing branch). `apply_changes`: `USE_AS_HOME_METER` on the electricity list = the existing removal, then the home assignment with `RATE` from the removed device; raise `ChangeError("home_exists", stat)` before changing anything when a home source exists.

- [ ] **Step 4: Run the tests to verify they pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Add home meter rules to the hierarchy"`.

### Task 2: Recency of statistics and home support

**Files:**
- Modify: `custom_components/energy_flow_mapper/energy_stats.py`, `custom_components/energy_flow_mapper/energy_access.py`
- Test: `tests/test_energy_stats.py`, `tests/test_energy_access.py`

**Interfaces:**
- Produces:
  - `RECENT_LAG: Final = timedelta(hours=2)`.
  - `async_last_ends(hass, stats: Collection[str]) -> dict[str, datetime | None]` – end of each statistic's last hourly statistic (`get_last_statistics(hass, 1, stat, True, {"sum"})` in the recorder executor, start + 1 h); None without data or without recorder.
  - `stale_stat(stats: Sequence[str], ends: Mapping[str, datetime | None], end: datetime) -> str | None` – the first statistic whose end is None or earlier than `end - RECENT_LAG`.
  - `energy_access.home_supported() -> bool` – `hasattr(energy_data, "HOME_SOURCE_SCHEMA")`.

- [ ] **Step 1: Write failing tests**: `test_stale_stat` (end 3 h before → that stat; 1 h before → None; None end → that stat; order kept); `test_async_last_ends` with imported hourly statistics in the test recorder (last hour → its end; unknown stat → None; no recorder → all None); `test_home_supported` with `monkeypatch.setattr(energy_data, "HOME_SOURCE_SCHEMA", object(), raising=False)` → True, without → False on 2026.10.
- [ ] **Step 2: Run** `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_energy_stats.py tests/test_energy_access.py -q --no-cov` → FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Run** the same command → PASS.
- [ ] **Step 5: Commit** `git commit -m "Check how recent energy statistics are"`.

### Task 3: WebSocket results and refusals

**Files:**
- Modify: `custom_components/energy_flow_mapper/websocket.py`, `strings.json`, `translations/en.json`, `de.json`, `fr.json`, `it.json`
- Test: `tests/test_websocket.py`, `tests/test_translations.py` (existing completeness check)

**Interfaces:**
- Consumes: Task 1 and 2 names.
- Produces:
  - `energy_flow_mapper/get` result gains `"home_supported": bool`; `energy_flow_mapper/card` result gains `"home_supported": bool` and, for `kind: electricity` only, the home source in `sources` (role `home`).
  - `_async_period(...)` result gains, for electricity only, `"home": {"value": float | None, "basis": "measured" | "calculated" | None, "stale": str | None, "untracked": float | None}`; `untracked[HOME]` is set to the same untracked value; the Home warning (`DEVICES_EXCEED_HOME`, stat `HOME`) is in `issues`. When `stale` is set, `value`, `basis`, `untracked` are None and there is no Home warning. Water answers have no `home` key.
  - Changes with `role: home` or `type: use_as_home_meter` are refused with `HomeAssistantError(translation_key="home_not_supported")` when `home_supported()` is False (in `_apply`, before HA's schema). `CHANGE_SCHEMA` accepts `use_as_home_meter` with `stat` and role `home`.
  - New exception keys: `home_not_supported` ("This Home Assistant release has no home meter; it needs 2026.11 or newer."), `home_exists` ("There is already a home meter.").

- [ ] **Step 1: Write failing tests**: get/card flag True/False via the monkeypatch of Task 2; energy for `today` with a home meter (measured value, untracked, warning when devices exceed it); calculated with grid/solar/battery stats; `stale` when the home meter's last statistic is 3 h old (patch `async_last_ends`); water answer without `home`; validate and save refuse `assign_source role=home` and `use_as_home_meter` when unsupported, accept them when supported (save writes the home source; HA 2026.10's schema rejects `home`, so patch `energy_access.validate` to pass through in that test); card answer includes the home source row.
- [ ] **Step 2: Run** `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_websocket.py tests/test_translations.py -q --no-cov` → FAIL.
- [ ] **Step 3: Implement**; strings in all four languages.
- [ ] **Step 4: Run** the full suite `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim` → PASS, coverage ≥ 90 %; `ruff check . && ruff format --check . && mypy custom_components/energy_flow_mapper` clean.
- [ ] **Step 5: Commit** `git commit -m "Report home consumption and accept the home meter"`.

### Task 4: Draft, layout and panel

**Files:**
- Modify: `panel/src/types.ts`, `panel/src/draft.ts`, `panel/src/layout.ts`, `panel/src/energy-flow-mapper-panel.ts`, `panel/src/translations/{en,de,fr,it}.ts`
- Test: `panel/test/draft.test.ts`, `panel/test/layout.test.ts`, `panel/test/panel.test.ts`, `panel/test/localize.test.ts` (existing completeness check)

**Interfaces:**
- Consumes: Task 3 answers.
- Produces:
  - Types: `SourceRole` and `AssignRole` gain `"home"`; `Change` gains `{ type: "use_as_home_meter"; stat: string }`; `Snapshot.home_supported?: boolean`; `EnergyResult.home?: HomeResult` with `HomeResult = { value: number | null; basis: "measured" | "calculated" | null; stale: string | null; untracked: number | null }`.
  - `draft.ts`: `sourceRows` yields `{type: "home", role: "home", stat}` for a home source; `applySourceChanges` and `applyChanges` mirror Task 1 (assign/replace/unassign home, `use_as_home_meter`); `homeNow(hass, sources): number | null` – power of the home meter's `stat_rate` via `rateValue`, else null.
  - `layout.ts`: `HOME_PLACEHOLDER_ROLES = [...PLACEHOLDER_ROLES, "home"]`; `"home"` in `INTO_HOME`; `SOURCE_COLORS.home = "var(--secondary-text-color)"`; new last parameter `homeUntracked = false` of `layout(...)` adds the block `untrackedId(HOME_ID)` (kind `untracked`, stat `HOME_ID`) as the last child of Home with an `untracked` edge from Home.
  - Panel: placeholder roles include `home` only when `home_supported` and on the electricity tab; the home meter edge is dashed; `assignRole("home") === "home"`; drop of a **device** on the home placeholder and a menu entry "Use as home meter" (only when supported, electricity tab, no home meter) add `{type: "use_as_home_meter", stat}`; Home subtitle: `home_measured` / `home_calculated` / `home_stale` (with the meter's name) / today's sum; top-level untracked block when a home value exists; the Home warning badge on Home.
  - Strings: `role_home` "Home meter", `home_calculated` "{power} calculated", `home_stale` "{name}: data not recent enough", `use_as_home_meter` "Use as home meter", `issue_devices_exceed_home` "The devices use more than the home", `error_home_not_supported`, `error_home_exists` (texts as in Task 3). DE: "Hauszähler", "{power} berechnet", "{name}: Daten nicht aktuell genug", "Als Hauszähler verwenden", "Die Geräte verbrauchen mehr als das Zuhause". FR/IT translated alike.

- [ ] **Step 1: Write failing tests**: draft (sourceRows home; assign/replace/unassign home keeps unknown keys; use_as_home_meter moves children up and adds the source); layout (home placeholder only when in the roles; edge `placeholder`→none, `source:home`→Home; `homeUntracked` adds the block after the last root, both orientations); panel (no home placeholder when `home_supported` false or on the water tab; tapping it assigns; dropping a device on it and the menu entry add one `use_as_home_meter` change, undo removes it; Home subtitle measured/calculated/stale from a mocked energy answer; "Now" uses `homeNow`; untracked block under Home shows `home.untracked`; warning badge on Home).
- [ ] **Step 2: Run** `cd panel && npx vitest run` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd panel && npm run typecheck && npx vitest run` → PASS.
- [ ] **Step 5: Commit** `git commit -m "Show the home meter and home consumption in the panel"`.

### Task 5: Card

**Files:**
- Modify: `panel/src/card.ts`
- Test: `panel/test/card.test.ts`

**Interfaces:**
- Consumes: Task 3 card answer, Task 4 `layout(..., homeUntracked)`, `homeNow`, strings.
- Produces: the card shows the home meter with the sources (when `show_sources`), the Home subtitle as in the panel, the top-level untracked block (when `show_untracked` and a home value exists) and the Home warning badge. No new option.

- [ ] **Step 1: Write failing tests**: card with a home source and `home` in the period answer shows "measured", the untracked block under Home, the badge; with `show_untracked: false` no block; "Now" uses the home meter's power sensor; water card unchanged.
- [ ] **Step 2: Run** `cd panel && npx vitest run test/card.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd panel && npm run typecheck && npx vitest run && npm run build` → PASS; bundle rebuilt.
- [ ] **Step 5: Commit** (including the rebuilt bundle) `git commit -m "Show home consumption on the card"`.

### Task 6: Docs and local checks

**Files:**
- Modify: `SPEC.md` (§2 row "Hauszähler", §6 panel/card, §8 role `home`, §9 rules, §12 results, §17 v0.7.0 entry "in Arbeit"), `README.md` (features and card), `CHANGELOG.md` ([Unreleased])

- [ ] **Step 1:** Write the docs from the design (German in SPEC.md, English elsewhere).
- [ ] **Step 2:** Full checks: Python suite + ruff + mypy; panel typecheck, tests, build; `git status` shows the bundle committed.
- [ ] **Step 3:** Local HA 2026.10 instance (`ha-test`): no home placeholder; calculated Home value and top-level untracked for 7 days; nothing changes on save. Local HA 2026.11 instance (`ha-test-2611`): assign, replace, remove the home meter; use a device as home meter and undo; save keeps the source; card as non-admin; phone layout. Stop the instances afterwards.
- [ ] **Step 4: Commit** `git commit -m "Document the home meter"`. Do not push or release without the maintainer's OK.
