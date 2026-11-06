# HA checks, coverage, suggestions and image export – design

Status: draft for the maintainer's approval, 2026-11-06 (builder check done). Target: v0.8.0.
`SPEC.md` stays the binding specification; once this design is approved, its decisions
go into SPEC.md (§2 where needed, §6, §9, §12, §17) in the same change as the code.
Minimum Home Assistant stays 2026.10.0; everything must keep working there.

## Why

Energy Flow Mapper already shows the device tree, live values and what is untracked.
Four things are still missing to make the tree trustworthy and shareable:

1. **HA's own checks are hidden.** HA validates the energy dashboard (sensor unavailable,
   entity gone, wrong unit or state class, negative state, excluded from the recorder),
   but shows the result only in its energy settings. A device that measures wrongly
   silently spoils every number in the diagram.
2. **No single number says how complete the tree is.** Since v0.7.0 Home shows the home
   consumption and the untracked rest; the share covered by devices is the motivating
   number for anyone building up their tree. Not everyone wants to see it, so it is a
   choice.
3. **Setting up big trees is manual.** HA has *child devices* (device registry since
   2026.9, announced to integration developers in October 2026): a part of one physical
   product (an outlet of a power strip, a channel of a multi-channel meter)
   registered below its parent device. That is exactly "included in". The maintainer has
   no feedback yet that setup is hard (their own was easy), so suggestions must be quiet,
   safe and never change anything by themselves.
4. **No way to share the diagram.** The maintainer wants an image for questions (issues,
   asking someone), for showing it in a forum or on Reddit, and as a record of "how it
   looks today". Names may be private, so hiding them is the user's choice.

## Goals

1. Show HA's validation result at the affected block (device, source, home meter) in the
   panel and on the card, in HA's own words and language.
2. Show "X % covered by devices" at Home, switchable in the panel (on by default) and an
   option on the card (off by default).
3. Suggest "included in <parent>" for devices whose HA device is a child device of
   another device in the same energy list (wherever an integration registers child
   devices; nothing appears where none does); one click turns the
   suggestion into a normal draft change; suggestions can be ignored.
4. Export the whole diagram of the current tab as a PNG, optionally with names hidden.

## Non-goals

- No own entities or sensors (SPEC §2 stays).
- No fixing of HA's issues by Energy Flow Mapper (we show them; HA's settings fix them).
- No suggestions from `via_device_id` (connectivity, not energy), areas, names or power
  correlation. Only child devices.
- No coverage for water (there is no water home total yet).
- No SVG export, no export on the card, no upload or sharing service.

## Anti-goals (a failure even if it works)

- Any energy setting changed without the user saving a draft (suggestions included).
- A wrong suggestion that looks certain, or suggestions on a release without child
  devices that error or show empty UI.
- The card (non-admin) exposing prices or costs through HA's validation messages
  (SPEC §2: the card never returns prices or costs).
- An existing dashboard looking different after the update (card defaults keep it
  unchanged).
- An export that sends data anywhere; it is created in the browser only.

## 1. HA's checks at the block

**Source of the data.** HA's `energy.validate.async_validate(hass)` (same as the
WebSocket command `energy/validate`). It returns, per list (`energy_sources`,
`device_consumption`, `device_consumption_water`) and per entry *by index*, a list of
issues `{type, affected_entities: [[entity_or_stat, detail], ...],
translation_placeholders}`. Reading it is a call into HA's `energy` integration, so it
lives in `energy_access.py` (the only module that touches energy internals). The issue
types are defined by HA; we pass unknown types through.

**Mapping to blocks.** By index to the source or device of the *saved* preferences, then
to the block whose statistic is the affected entity; for a source with several blocks
(grid import and export) an affected entity that is not a block's statistic (a price
entity, a power sensor) goes to the source's first block; for a device, to the device.
Mapped by statistic, so in a draft the message moves with the device. A device that the
draft removed has no block; its messages are not shown.

**Shown how.** The existing badge and detail list, as a separate group "Home Assistant
reports" below our own issues, severity *warning* (never blocks saving). Text: HA's own
translation, loaded with `hass.loadBackendTranslation("issues", "energy")` and
`hass.localize("component.energy.issues.<type>.title")` (with its placeholders), plus
the affected entity and detail if it is not the block's own statistic. Fallback when no
translation exists: the type as is.

**Overlap with our own checks.** Our `statistic_missing` / `not_energy_unit` /
`not_water_unit` and HA's `statistics_not_defined` / `entity_unexpected_unit_energy` /
`entity_unexpected_unit_water` can say the same. *My call:* where our issue on the same statistic covers it, HA's is not shown
again (one message, ours, as today).

**When.** With every snapshot (panel load, reload after save, conflict reload) and on the
card's load and refresh. It costs one recorder metadata query, so it is not repeated per
period switch; the card's periodic refresh may reuse a short-lived cached result
(builder's choice). A failure of the validation (exception) is logged once and gives no
messages, never a broken panel.

**Card.** The card command returns the messages for the blocks it shows, but **without**
anything about prices or costs. Implemented as an **allowlist**: only issues whose
affected entity is a block statistic (or the power/flow sensor) of a shown device or
source pass, and never the price issue types (`entity_unexpected_unit_*_price`,
`entity_gas_price_unit_mismatch`, cost checks). So HA's auto-generated cost sensors,
which are not in the preferences, cannot leak. HA allows `energy/validate` for every user, so
this is no new exposure; the filter keeps SPEC §2.

## 2. Coverage at Home

- Value: sum of the top-level devices ÷ home consumption, for the current period, only
  when Home has a value (measured or calculated, see v0.7.0) and that value is > 0.
  "Now" uses the same values as Home's "Now".
- Text below the home value: "72 % covered by devices". Rounded to whole percent; below
  1 % shows "< 1 %". When the devices use more than the home, "over 100 %" (the existing
  `devices_exceed_home` warning stays).
- No value, no line (never a made-up number); same as `home_untracked`: when any
  top-level device has no value for the period, no coverage either.
- Electricity tab only.
- **Panel:** a toggle *Coverage* (my call: in the toolbar next to the orientation, same
  button style), on by default, remembered per browser like the orientation
  (`localStorage`, try/catch).
- **Card:** option `show_coverage` (boolean, default `false`), in the card editor and
  YAML; the editor does not write the default.

## 3. Suggestions from child devices

**Only where child devices really exist.** No version gate and no setting: the rule runs
on the device registry as it is. HA 2026.10.0 (our minimum) already has `ChildDeviceEntry`
with `parent_device_id` (registry 3.4, since 2026.9); a device entry without
`parent_device_id` simply gives no suggestion. Read it with `getattr(entry,
"parent_device_id", None)` so an entry type without the field is just "no parent". As
long as no integration in an installation registers child devices, the panel shows
nothing at all (no marker, no empty section, no toolbar button).

**Rule (pure function in `hierarchy.py`, input prepared by the backend).** For every
device of the list (electricity and water separately) whose statistic is an entity of
HA device *C*, where *C* is a child device with parent *P*:
- the list has **exactly one** device whose statistic is an entity of *P* (zero or
  several: no suggestion, never guess);
- that parent device *p* is not already an ancestor of the child in the current tree
  (draft included), and the move would not create a cycle;
- the child is not a source, and *p* is not the child itself;
- the suggestion is not ignored.
Result: `{stat, parent, kind}` = "move `stat` below `parent`". The backend sends the
child→parent statistic pairs with the snapshot; the panel evaluates the rule against the
draft (my call: the rule is a pure function in `hierarchy.py` and mirrored in `draft.ts`,
like the other draft logic; or returned by the existing per-draft `validate` call,
builder's choice).

**Shown how.** A quiet marker on the device block (not the warning badge; my call: a
small "suggestion" icon) and in its detail view the line "Suggestion: included in
<parent>" with the buttons *Apply* and *Ignore*. *Apply* adds the existing `move` change
to the draft (saved like any change, with backup). Suggestions are computed for the
draft as it is, so applied ones disappear and a discarded draft brings them back.
Optional *Apply all suggestions* in the toolbar only when there are two or more (my
call).

**Ignore.** Stored in Home Assistant (maintainer decision of 2026-11-06), so an ignored
suggestion stays away on every device and for every admin. A **new, separate store**
`.storage/energy_flow_mapper.suggestions` (own `STORAGE_VERSION` 1, `{"ignored":
[{"kind", "stat", "parent"}]}`); the backup store is not touched, so no migration of
existing data. Admin-only WebSocket commands to ignore one suggestion and to clear all
ignores (e.g. *Show ignored suggestions again* in the panel, my call). Ignores whose
devices no longer exist are dropped when the store is written. The ignored list is
part of the snapshot; the rule filters it. Not part of backups, export or import (it is
not an energy setting). Diagnostics: count of ignored suggestions only.

**Card.** No suggestions on the card (read-only).

## 4. Image export

- Button *Save as image* in the panel toolbar. Downloads
  `energy-flow-mapper-<tab>-<YYYY-MM-DD>.png`.
- Always the **whole diagram** of the current tab, independent of zoom and pan; current
  orientation, period, values, warnings, collapsed state, light or dark theme.
- A footer line in the image: "Energy Flow Mapper · <tab> · <period> · <date time>"
  (localized), and "Draft, not saved" when the draft has changes.
- Before saving, a small dialog with the option *Hide names* (off by default) and the
  button *Save*. With names hidden: devices become "Device 1, Device 2, …" in diagram
  order (stable within one image), sources keep their role label (Grid import, Solar…),
  sensor names and entity IDs never appear, and **areas are hidden too** (device blocks
  show "value · area" today; an area like a child's room is as private as a name). With
  names shown, the image shows areas like the diagram does.
- How it is made is the builder's call; my recommendation: draw the image from the
  layout data (`layout.ts`) as a standalone SVG (rectangles, text, paths in the current
  theme colours) and rasterise it via a canvas at 2× scale, so it does not depend on
  the browser rendering HTML into an image and needs no new dependency. Very large
  diagrams are capped so the canvas stays within browser limits (scale down instead of
  failing).
- Nothing leaves the browser.

## Translations

New panel strings (EN base, DE, FR, IT in the same change), plus any new backend
exception (`strings.json` and `translations/*.json`): toggle *Coverage*, the
coverage texts, "Home Assistant reports", suggestion line and buttons (*Apply*, *Ignore*,
*Apply all suggestions*), *Save as image*, export dialog (*Hide names*, *Save*),
"Device {n}", "Draft, not saved", footer, card editor label for `show_coverage`.
HA's issue texts come from HA itself.

## Tests

- `hierarchy.py` first: suggestion rule (exactly one parent stat, zero/several, already
  ancestor, cycle, ignored, separate lists), suggestion store (ignore, clear, admin only,
  stale ignores dropped), coverage value (none, zero, over 100 %),
  mapping of validation issues to statistics and the overlap filter, card price filter.
- Backend with the test HA: validation passed through and mapped, failure gives no
  messages, child-device pairs with a hand-registered child device (both CI jobs, since
  2026.10 has child devices too), none without, card without price issues.
- Panel/card (vitest): badges and detail group, coverage toggle and card option, apply and
  ignore suggestions, export dialog and name hiding (names absent from the generated
  SVG), footer, draft label.
- Live check on the test instances 2026.10.4 and 2026.11.0, with a hand-registered child
  device.

## Left to the builder

Exact icons, wording polish within the given meaning, the rendering technique of the
export, where helpers live, test structure.
