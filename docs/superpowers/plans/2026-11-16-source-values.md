# Source Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Source blocks in the panel and on the dashboard card show the power now (from HA's
`stat_rate` of the source) or the energy of the selected period.

**Architecture:** One pure helper in `panel/src/draft.ts` turns a source's signed `stat_rate`
into the value of one role. The panel and the card call it for "now" and read the period
energy they already load. The card command also returns each source's `stat_rate`.

**Tech Stack:** TypeScript + Lit (panel, card), vitest; Python (HA integration), pytest.

**Spec:** `docs/superpowers/specs/2026-11-16-source-values-design.md`

## Global Constraints

- Minimum Home Assistant 2026.10.0; a source without `stat_rate` shows no "now" value.
- HA's sign: `stat_rate` positive = from grid / discharging, negative = to grid / charging.
- Placeholders show no value; edge widths of source lines do not change.
- Card command stays read-only; it may add the sources' `stat_rate` (entity IDs, no prices).
- New user-facing text in EN/DE/FR/IT; German Swiss style, no ß.
- Tests first; Python coverage stays 100 %; rebuild and commit the bundles.

## Review Focus

- `stat_rate` state `unavailable`/`unknown`/empty: no value, not "0 W".
- Grid export at night with a signed sensor at +300 W: export shows 0 W, import 300 W.
- Water source "now" in L/min (gal/min with US units), period in L/gal like devices.
- Gas keeps its existing rendering (`_renderGasValue`), unchanged.
- The home meter block (role `home`) shows its power now, as Home already does.

---

### Task 1: `sourceNow` helper

**Files:**
- Modify: `panel/src/draft.ts` (next to `rateValue`/`powerStats`)
- Test: `panel/test/draft.test.ts`

**Interfaces:**
- Produces: `export function sourceNow(hass: HomeAssistant, rate: string | undefined, role: SourceRole): number | null`
  — reads `rate` with `rateValue(hass, rate, role === "water" ? "water" : "electricity")`;
  `import`/`discharge` → `max(v, 0)`, `export`/`charge` → `max(-v, 0)`, `production`/`home`/`water` → `v`,
  any other role (`gas`, `consumption`) → `null`; `null` when the reading is `null`.

- [ ] **Step 1: Failing tests** `describe("sourceNow")`: signed grid sensor at 300 W gives import 300, export 0;
  at −1.2 kW gives import 0, export 1200; battery −500 W gives discharge 0, charge 500; solar 800 W gives 800;
  `unavailable` state and missing `rate` give `null`; role `gas` gives `null`; water flow 6 L/min gives 6.
- [ ] **Step 2:** `cd panel && npx vitest run test/draft.test.ts` → FAIL (`sourceNow` not exported).
- [ ] **Step 3:** Implement `sourceNow` as above.
- [ ] **Step 4:** same command → PASS.
- [ ] **Step 5:** Commit `Add a helper for a source's power now`.

### Task 2: Values on the panel's source blocks

**Files:**
- Modify: `panel/src/energy-flow-mapper-panel.ts` (source block render, `case "source"`)
- Test: `panel/test/panel.test.ts` (`describe("sources")`)

**Interfaces:**
- Consumes: `sourceNow` (Task 1); `this._energy?.energy[stat]`; `this._formatValue(value)`.
- Produces: `private _renderSourceValue(block: Block): TemplateResult | typeof nothing` — a
  `<span class="sub value">` like devices; gas still goes through `_renderGasValue`.

- [ ] **Step 1: Failing tests:**
  - "shows the power now on the source blocks": grid `{stat_energy_from: "sensor.import", stat_energy_to: "sensor.export", stat_rate: "sensor.grid_power"}` with `sensor.grid_power` = `"-1200"` W → the import block text contains "0 W", the export block "1.2 kW"; solar with `stat_rate` "800" W → "800 W"; a source without `stat_rate` has no `.value`.
  - "shows the energy of the period on the source blocks": `setPeriod("week")` with energy `{"sensor.import": 12.5}` → import block contains "12.5 kWh".
  - Review Focus: `unavailable` power sensor → no `.value`; placeholder blocks never have `.value`.
- [ ] **Step 2:** `npx vitest run test/panel.test.ts -t "source blocks"` → FAIL.
- [ ] **Step 3:** Render `_renderSourceValue` in the source block after the sensor name line: placeholders → nothing; `role === "gas"` → `_renderGasValue(stat)`; period `"now"` → `sourceNow(hass, block.source?.stat_rate, role)`; otherwise `this._energy?.energy[stat]`; `null` → nothing; else `_formatValue(value)`.
- [ ] **Step 4:** `npx vitest run` → all PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `Show power and energy on the panel's source blocks`.

### Task 3: Card command returns the sources' power sensors

**Files:**
- Modify: `custom_components/energy_flow_mapper/websocket.py` (`websocket_card`, the `"sources"` list)
- Test: `tests/test_websocket.py`

**Interfaces:**
- Produces: each item of `card` → `sources` has `stat_rate` when the source has a string `stat_rate`
  (all roles, not only `home`); absent otherwise.

- [ ] **Step 1: Failing test** `test_card_sources_carry_their_power_sensor`: prefs with a solar source
  `stat_rate: "sensor.solar_power"` and a grid with `stat_rate: "sensor.grid_power"` → the card's solar row has
  `stat_rate == "sensor.solar_power"`, both grid rows `"sensor.grid_power"`; a source without one has no key.
- [ ] **Step 2:** `.venv/Scripts/python.exe -m pytest -p win_ha_test_shim tests/test_websocket.py -k card -q --no-cov` → FAIL.
- [ ] **Step 3:** Include `stat_rate` for every row whose source has a string `RATE`.
- [ ] **Step 4:** Full suite with coverage → PASS, 100 %; ruff, format, mypy clean.
- [ ] **Step 5:** Commit `Send the sources' power sensors to the card`.

### Task 4: Values on the card's source blocks

**Files:**
- Modify: `panel/src/card.ts` (source block render, `case "source"`; `CardSource` doc comment)
- Test: `panel/test/card.test.ts`

**Interfaces:**
- Consumes: `sourceNow` (Task 1), `CardSource.stat_rate` (Task 3), `this._data?.energy[stat]`, `this._format(value)`.

- [ ] **Step 1: Failing tests:** "shows the power now on its sources" (data source `{type:"solar", role:"production", stat:"sensor.solar", name:"Roof", stat_rate:"sensor.solar_power"}`, state 800 W, period now → block text contains "800 W"); "shows the energy of the period on its sources" (period week, energy `{"sensor.import": 3}` → "3 kWh").
- [ ] **Step 2:** `npx vitest run test/card.test.ts` → FAIL.
- [ ] **Step 3:** Add a `<span class="sub value">` under the source name: now → `sourceNow`, period → `_data.energy[stat]`, formatted with `_format`.
- [ ] **Step 4:** `npx vitest run` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `Show power and energy on the card's sources`.

### Task 5: Docs and bundles

**Files:** `SPEC.md` (§6 Diagramm, §6 Karte, §12 `card` row), `CHANGELOG.md` (`[Unreleased]` → Added),
`README.md` (feature line on sources if one exists), `custom_components/energy_flow_mapper/frontend/*.js`.

- [ ] **Step 1:** SPEC: source blocks show power now (HA `stat_rate`, split by role) or the period's energy; card the same; `card` returns `stat_rate` per source.
- [ ] **Step 2:** CHANGELOG Added: "**Values on the sources:** grid, solar, battery and water show their power now (from the power sensor in Home Assistant's energy settings) or their energy in the period, in the panel and on the card."
- [ ] **Step 3:** `cd panel && npm run build`; `git status` shows only the bundles that changed.
- [ ] **Step 4:** Commit `Rebuild the bundles and document source values`.
