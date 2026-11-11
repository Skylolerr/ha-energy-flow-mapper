# Groups and sum meters – design

Status: approved by the maintainer 2026-11-11 (builder check done). Target: v0.9.0 (together with the
gas tab and the kept draft already on branch `gas-and-draft`).
`SPEC.md` stays the binding specification; once this design is approved, its decisions go
into SPEC.md (§2, §6, §8, §9, §11, §12, §17) in the same change as the code.
Minimum Home Assistant stays 2026.10.0; everything must keep working there.

## Why

After the 0.8.0 post on r/homeassistant (2026-11-09) and two GitHub issues:

1. **Big flat trees are hard to read.** A user with many devices directly below Home
   (Dreadino) says the layout struggles. The maintainer publicly promised grouping for
   the next version.
2. **Zone totals are hard to build.** The same user asked how to get "Kitchen
   energy/power". The answer today is an HA group helper (sensor group, type Sum), which
   has a pitfall: UI-created sensor groups ignore non-numeric members by default, so a
   member that is briefly unavailable makes the sum drop and the energy dashboard counts
   a reset. The maintainer publicly promised a "create a sum meter for a zone" button.
3. **Production inside a sub panel** (GitHub #1, simplecj): solar feeds a shop sub panel,
   so the sub panel meter measures net. HA has no negative devices; the right setup is
   solar as source and a gross sub panel meter = sub panel + solar, i.e. again a sum
   helper.

Grouping (A) and sum meters (C) are one concept: a group is a visual bundle in the panel;
with one button it becomes a real sum meter in HA.

## Decisions by the maintainer (2026-11-11)

- **Free groups**, made by the user, not derived from HA areas. (Reason given by Claude
  and accepted: multi-channel meters such as Emporia or Shelly Pro are one HA device in
  one area, so area grouping would put all their circuits into one group.) HA areas are
  only a starting point ("Suggest groups from areas").
- **Groups nest**: a group can contain devices (with all their sub-devices) and other
  groups, at any depth, and groups can exist on every level of the tree (below Home and
  below any device).
- **Energy Flow Mapper stores its own data for the first time beyond backups and helper
  bookkeeping**: the groups. This replaces the SPEC §2 row "Source of Truth … stores only
  backups". HA's energy preferences stay the source of truth for everything energy;
  groups are display only.
- **Creating**: select several blocks, then "Group". **Changing an existing group**: by
  dragging, as everything else in the panel.
- **The dashboard card shows groups too**, collapsible and expandable, and the card can
  show the whole tree or only one group.
- **Filter by floor/area** (variant D) is a possible later idea, not in this version.

## Goals

1. Group devices (and groups) of the same parent into named groups in the Electricity and
   Water tabs.
2. A collapsed group is one block with one line to its parent and the sum of its members;
   expanded, it is a labelled frame in which the sub-tree opens.
3. Group changes are draft changes: undo, kept draft, check, one save, backup, restore,
   export/import.
4. "Create sum meter": from a group (members preselected; the new meter takes the
   group's place as a real device) or freely from chosen sensors (GitHub #1).
5. The card shows groups, collapsible, and can start at a group.

## Non-goals

- No groups in HA's own energy dashboard (only a sum meter is visible there, as a normal
  device).
- No groups in the Gas tab (it has no devices).
- No filter by floor/area (later idea).
- No members from different real parents in one group.
- No free positioning of blocks (SPEC §2 "Darstellung" stays).
- No sensors for group sums (consistent with SPEC §2 "Nicht erfasster Verbrauch").

## Anti-goals (a failure even if it technically works)

- A group operation that loses or changes energy settings the user did not ask for.
- A sum meter that silently counts resets (members ignored while unavailable).
- Double counting: a group sum that adds a device and its own sub-devices.
- Groups that silently drift from the real tree so the diagram lies about what is
  included in what.

## Concept

### The rule

A group sits **between one real parent and some of its children**. Everything in a group
(devices and groups) has the same real parent: a device's `included_in_stat`, or Home
(`null`). A nested group has the same real parent as the group around it. So a group's
one line to the outside always ends at its real parent, and the real tree in HA never
depends on groups.

### Group value

The sum of its **direct members' values** (each member device already includes its
sub-devices in its own meter, and nested groups contribute their own sum). Shown "now"
(sum of members' power/flow sensors, only those that have one; if none has one, no "now"
value) and for periods (sum of members' period values). A group has no untracked rest
and no plausibility warning of its own; the real tree's warnings stay as they are.

### Panel

- **Collapsed group:** block with the group name, "N devices" (all devices inside,
  recursively) and the value; dashed border in the group colour to tell it from a
  device; one line to its real parent, drawn like a device's line.
- **Expanded group:** a labelled frame ("▾ Küche · 1,2 kW") around its members' sub-tree;
  the line from the real parent ends at the frame header; inside, the members hang from
  the header as from a parent.
- Groups **start collapsed** when the panel loads; a group just created by the user
  starts expanded. Only groups the panel has not shown yet start collapsed: a group the
  user expanded or created keeps its state across reloads (save, restore, import,
  conflict) and period switches. *(Claude's call.)* Collapse state lives in the panel's existing
  `_collapsed` set, keyed by group ID, not saved.
- **Search** and "Show" (`_reveal`) open collapsed groups above the match, as they already
  open collapsed devices.
- **Selecting several blocks:** Ctrl/Cmd+click on desktop; a "Select" button in the
  toolbar for touch, after which each tap toggles a block. A bar shows "N selected ·
  Group · Clear selection". "Group" asks for a name. It is disabled with the hint "Only
  devices with the same parent" when the selection has different real parents. Groups can
  be selected too (grouping groups nests them).
- **Dragging:**
  - a device or group onto a group (block or frame): it joins the group. If its real
    parent differs, this is also a real move in HA (a normal `move` in the draft) to the
    group's real parent;
  - a device or group out of a frame onto its real parent: it leaves the group;
  - a group onto a device: the group and all its members move there (one `move_group`
    in the draft; nested groups follow).
- **Tapping a group** opens its actions: Rename, Dissolve group (members stay, the frame
  goes; nested groups move up one level), Create sum meter (below).
- **Toolbar:** "Suggest groups from areas" creates, in the draft, one group per HA area
  per parent for children of the same parent that share an area, only where at least two
  such children exist and they are not grouped yet. *(Claude's call on the exact
  rule.)* Undo takes them back as one step.
- A group whose last member leaves disappears by itself.

### Dashboard card

- Shows groups like the panel (collapsed blocks, frames when expanded), no editing.
- Tapping a group block toggles it; groups start collapsed; state is not saved.
  *(Claude's call.)*
- Option `root` (already "device to start from") also accepts a group (`group:<id>`); the
  card editor lists groups of the chosen list after devices. With a group as root, no
  sources and no Home (as with a device root today).
- The read-only `energy_flow_mapper/card` command returns the groups of its list (names,
  members, parent). Groups contain only names chosen by the user and no prices, so this
  stays within the SPEC §2 exception.

### Sum meter

One dialog "Create sum meter", opened

- from a group's actions: the members' energy sensors are preselected, name «<group>»;
- from a device's actions (any device or source sensor may be picked): free selection of
  sensors, for cases like GitHub #1 (sub panel + solar).

The dialog:

- lists the chosen sensors and lets the user add/remove; only `sensor` entities with
  device class energy (Electricity) or water (Water) and state class `total` or
  `total_increasing` qualify; external statistics cannot be summed by a helper and are
  shown as not possible;
- creates, via the config flow of HA's `group` integration (sensor group), a helper of type
  **sum** with **ignore non-numeric off** (the sum becomes unavailable instead of dropping),
  the members' device class, a state class that the energy dashboard accepts, and the
  unit of the members; name «<name> energy» / «<name> water» in the user's language
  *(Claude's call, matching the integral helper naming)*;
- if every chosen energy sensor's device has a power (water: flow) sensor in the
  tree, also creates a second sum group of those sensors as the new meter's `stat_rate`;
  otherwise no `stat_rate`;
- records both helpers in `.storage/energy_flow_mapper.helpers` like integral helpers, so
  the panel marks them "Created by Energy Flow Mapper".

The helper is created **immediately** (as integral helpers today); what follows goes into
the draft:

- **From a group:** `add` of the new meter at the group's real parent; `move` of each
  direct member device below the new meter; the group is replaced by the device: nested
  groups now have the new meter as real parent. The group itself is removed.
- **Free:** `add` of the new meter at the parent of the device the dialog was opened
  from.

**What goes into the sum, and what moves** *(Claude's call, after the builder check)*:

- **From a group, every device in the group is in the sum and cannot be deselected**:
  the direct member devices and the devices of nested groups (they are all real siblings
  in HA). Otherwise the new meter would have children that are not in its sum, and the
  diagram would lie. If one of them cannot be summed (external statistic, unit the sensor
  group cannot convert), creation is refused with a hint naming it.
- **Sensors can be added** in both modes. A source sensor (e.g. solar for GitHub #1)
  stays a source. **Every device in the sum moves below the new meter**, including an
  added device from elsewhere in the tree; otherwise HA would count it twice.
- In free mode the device the dialog was opened from is preselected; the meter takes its
  real parent, and the chosen devices move below it.

Undo takes back the draft changes; the helpers stay (as today with integral helpers).

**Pitfalls the builder must handle:**

- Members with different units of the same device class (Wh and kWh): check whether the
  sensor group converts them on HA 2026.10; if not, refuse with a hint.
- Units of the sum: the energy dashboard needs an energy (or volume) unit; the group
  must carry it.
- A member that resets (e.g. a plug back to 0) makes a `total_increasing` sum drop;
  document this as a known limitation in the README (same as HA's own sensor group).

## Data and storage

### Group store

- New store `.storage/energy_flow_mapper.groups`, `GROUPS_STORAGE_VERSION = 1` with its
  own migration hook (CLAUDE.md "Store changes only with a migration").
- Content: `{"groups": {"electricity": [...], "water": [...]}}`, each group
  `{"id": str, "name": str, "parent": stat | null, "group": id | null, "members": [stat]}`:
  `parent` is the real parent (null = Home), `group` the enclosing group, `members` the
  device statistics directly in it. Nested groups are found through `group`.
- IDs are random (uuid4 hex), generated by the panel for new groups so draft changes can
  refer to them before saving.
- **Clean-up on read** (pure function, used by `get`, `card`, `validate`, `save`), in
  this order:
  1. drop members whose device is no longer in the list;
  2. if no remaining device of a group (recursively) has the stored `parent` any more, but
     they all share one other real parent, the group adopts that parent (this is what
     happens when the parent device was deleted in HA's own settings and its children
     moved up);
  3. drop members whose real parent still differs from the group's `parent`;
  4. a nested group whose `parent` differs from its enclosing group's leaves it and moves
     to the top level of its own parent;
  5. groups with no devices left (recursively) disappear.
  The cleaned result is what the panel shows; the store is rewritten only on the next
  save.
- **Parent removed in the draft** (`remove`, `use_as_home_meter`, which move the children
  up to the grandparent): the groups below that device **follow their members** to the
  grandparent and keep the user's grouping. `groups.py` and `draft.ts` apply this as part
  of those changes. *(Claude's call, after the builder check.)* If a group of the same
  name exists there already, the moved group gets the first free number: "Kitchen (2)",
  "Kitchen (3)", ... The adoption in clean-up step 2 does the same, so two groups below
  one parent never share a name. *(Maintainer decision of 2026-11-11.)*
- **Entity ID renames:** listen to entity registry updates and rename statistics in the
  group store, as HA renames them in its energy preferences. *(Builder: check whether HA
  2026.10 renames energy preferences on entity ID changes; follow the same behaviour.)*
- Removing Energy Flow Mapper deletes the group store (it has no meaning without the
  panel), like the helper list.

### Draft changes

New change types, accepted by `validate` and `save` with `kind`:

- `create_group` `{id, name, parent, group?, members: [stat], groups: [id]}`
- `rename_group` `{id, name}`
- `set_group` `{stat | group_id, group: id | null}`: put a device or group into a group or
  take it out
- `dissolve_group` `{id}`
- `move_group` `{id, parent, group?}`: move a group with everything in it to another real
  parent (dragging a group onto a device, or into a group under another parent). Applying
  it rewrites the group's `parent`, the `parent` of its nested groups, and moves every
  direct member device (and the devices of nested groups) to the new parent, as one draft
  step. The sum meter uses it too for nested groups. *(Claude's call, after the builder
  check: one change instead of many single moves, so undo and the change list stay
  readable.)*

Existing `move` stays the real move of one device; a drag of a device that crosses
parents sends `move` + `set_group`.
Errors (translated, all four languages): members with different real parents, a group
inside itself (loop), unknown group ID, empty name, duplicate group name below the same
parent *(Claude's call: not allowed, so the card's `root` picker and the change list stay
readable)*.

### Saving

- `base_hash` covers the energy preferences **and** the group store, so a concurrent save
  of groups by another admin is a `conflict` as today.
- Order: check everything → backup (now with groups) → write energy preferences (only if
  they changed) → write the group store (only if it changed). If HA rejects the energy
  preferences, the group store is not touched. Group-only saves work without touching the
  energy preferences.
- The change list in the confirm dialog shows group changes in their own lines
  ("Group «Küche» created with 4 devices").

### Backups, restore, export/import

- `Backup` gets `groups` (the previous group store content) when groups changed; backup
  store version bump + migration (old backups: no `groups`, restore leaves groups as
  they are).
- Restore restores groups when the backup has them.
- Export file format version 2 with `data.groups`; import of version 1 files leaves
  groups unchanged; groups go through the same clean-up and checks.
- Diagnostics include the group store.

## Where the code goes

- New pure module `groups.py` (no HA imports, like `hierarchy.py`): clean-up, applying
  group changes, checks, group values from member values, area suggestions. Tests first,
  100 % coverage like `hierarchy.py`.
- `group_store.py` (store, migration, rename listener), `sum_meter.py` (helper creation
  via the `group` config flow, next to `integral.py`).
- WebSocket: `get`/`card` return groups; `validate`/`save`/`restore`/`import*` handle them;
  new `energy_flow_mapper/create_sum_meter` (`kind`, `name`, `entity_ids`) → `entity_id`,
  `stat_rate`.
- Panel: `layout.ts` learns group blocks and frames (used by panel, card and PNG export),
  multi-select, drag rules, dialogs; translations in EN/DE/FR/IT.

## Left to the builder

- Exact visuals (colours, frame padding) within the existing panel style; the PNG export
  shows groups as currently expanded/collapsed.
- How the frame is laid out inside the automatic layout, as long as the frame encloses
  exactly its members' sub-trees and lines stay readable in both orientations.
- Splitting the work into tasks and commits.

## Open for SPEC.md when approved

§2 new rows "Gruppen" and "Summen-Zähler", changed row "Source of Truth"; §6 panel and
card; §8 change types; §9 checks; §11 backups/export; §12 WebSocket; §17 v0.9.0 entry
(publicly promised on Reddit, 2026-11-11).
