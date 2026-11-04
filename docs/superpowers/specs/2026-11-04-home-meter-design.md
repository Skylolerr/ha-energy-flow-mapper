# Home meter and home consumption – design

Status: draft for the maintainer's approval, 2026-11-04. Target: v0.7.0.
`SPEC.md` stays the binding specification; once this design is approved, its decisions
go into SPEC.md (§2, §6, §8, §9, §12, §17) in the same change as the code.

## Why

Home Assistant 2026.11 added a new energy source, the **home meter** (core PR #185730,
frontend #54821): a meter of what the whole house consumes, so people stop entering their
main meter as an individual device (which counted it twice in the Sankey chart). Energy
Flow Mapper passes this source through unchanged but shows it nowhere.

Energy Flow Mapper's core is the device tree and what is *not tracked individually*.
Today that only exists below devices with children. With the home meter, or with a home
consumption computed from the sources, the same works one level up: **how much of the
house is not covered by any device**. That gap is the most useful number for anyone
building up their device tree, and HA's own dashboard does not show it this way.

## Goals

1. Show the home meter at Home, and let the user assign, replace and remove it like the
   other sources (drag a free sensor, or tap).
2. Show the home's consumption in the Home block: the home meter if there is one,
   otherwise computed from the sources.
3. Show a "Not tracked individually" block below Home: home consumption minus all
   top-level devices, with the same plausibility warning as for devices.
4. The same, read-only, on the dashboard card.

## Non-goals

- No change to the water tab (a water version of goal 3 may come later).
- No editing of prices, costs or the home meter's power sensor (see below).
- No own sensors or entities (SPEC §2: untracked stays panel-only).
- No change to how HA computes or stores anything.

## Anti-goals (a failure even if it works)

- Ever losing or changing energy settings the user did not touch, in particular a home
  source on HA 2026.11 or any field we do not know.
- Writing a `home` source on HA 2026.10, whose schema rejects it.
- A wrong "not tracked" number that looks right: if a value is missing, show nothing
  rather than a guess.

## Constraints

- Minimum Home Assistant stays **2026.10.0**. The home meter itself (placeholder, block,
  assigning) appears only when the running HA supports it. The computed home consumption,
  the top-level untracked block and the Home warning do not need it and work on 2026.10
  too (my call: most users are still on 2026.10, and CI tests it for real).
- Writes follow the existing rules: full list of each changed key from a fresh deep copy,
  unknown fields passed through, backup first, conflict hash.
- All tree logic stays pure in `hierarchy.py`, tested first. Only `energy_access.py`
  touches the internals of HA's energy integration.
- New strings in EN, DE, FR, IT; panel bundle rebuilt and committed.

## Decisions (maintainer's, 2026-11-04)

- Do the home meter first of the three ideas parked for 2026.11.
- The source of the reading does not matter (a Shelly on the incoming phases, a smart
  meter reader, a utility portal): any energy statistic can be assigned.
- The maintainer left the rest to me ("mach es so wie es am besten wird"); the calls
  below are mine and marked as such.

## How it works (my calls)

### Detecting support

`energy_access.py` reports whether the running HA knows the `home` source (for example
by the presence of the home source schema in `homeassistant.components.energy.data`).
`energy_flow_mapper/get` and `energy_flow_mapper/card` include this as a flag; the panel
only offers the home meter when it is set. The backend refuses `assign_source` with role
`home` when it is not supported (`home_not_supported`).

### The home meter as a source

- New source role `home`, from the `home` source's `stat_energy_to` (HA's field name).
- `assign_source` with `role: home`: replaces the statistic of the existing home source
  (keeping `stat_rate`, `name` and unknown fields), or else adds
  `{"type": "home", "stat_energy_to": stat}`. There is at most one, as HA requires.
- `unassign_source` removes the whole home source.
- `home` joins the editable source types. Its statistic counts as used by a source, so
  it is not offered as a free sensor or device (already true today).
- Offered sensors: the same electricity energy meters as for grid import.
- The home meter's power sensor (`stat_rate`) is kept and used for "Now", but not edited
  here (HA's settings do that, like prices).

### Panel

- A dashed placeholder "+ Home meter" in the source row/column, like "+ Solar", only when
  supported and no home meter is set. Drop or tap assigns; tapping an assigned home
  meter offers replace, remove and the energy settings, like other sources.
- The home meter block sits with the sources and has an edge into Home in its own colour.
  It does not feed the energy flow, it only measures Home; the edge is drawn dashed to
  show that (my call; the builder may pick another clear marking).
- Works in both orientations.
- **Use a device as home meter** (my call; this is the case the feature exists for:
  many people entered their main meter as a top-level device): the ⋮ menu of a device
  offers "Use as home meter", and a device can be dropped on "+ Home meter". In one
  draft this removes the device (its children move to the top level, as on any removal)
  and assigns its statistic as home meter, with the device's power sensor as the home
  meter's `stat_rate`. Only offered when supported and no home meter is set. The
  confirmation lists both steps, and "Undo change" takes back both together.

### Home consumption and "not tracked" at the top level

- **Measured:** with a home meter, Home shows its value: for "Now" its `stat_rate` (if
  set, else nothing), for a period the change of its energy statistic.
- **Computed** (no home meter, periods only): grid import − grid export + solar +
  battery discharge − battery charge, summed over all sources of each kind. Only when
  every one of these statistics has a value for the period; otherwise nothing. Gas and
  water never count. "Now" is not computed (power sensors of sources come in too many
  shapes); there Home keeps today's text.
- Home's subtitle says which it is: "X measured" (home meter), "X calculated" (from the
  sources), or today's sum of the top-level devices when neither is available.
- **"Not tracked individually" below Home:** home consumption minus the sum of all
  top-level devices, as a block like the existing untracked blocks, only when home
  consumption and every top-level device have a value. Shown when "show untracked" is on
  (card) / always (panel), like the others.
- **Plausibility:** the existing rule (> 5 % and > 0.1 kWh) applied to Home: a warning
  when the top-level devices together used clearly more than the home consumption.
- **Late or coarse data** (my call): meters from a utility portal are often external
  statistics, hourly only and hours behind. A value that is missing the newest hours
  looks right but makes "not tracked" too low or negative. So for each period the backend
  checks the last statistic time of every statistic behind the home consumption (home
  meter, or the source meters). If one of them ends more than 2 hours before the end of
  the period (for "Today": it has no 5-minute statistics), Home shows no home
  consumption, no top-level untracked block and no Home warning, and Home's subtitle says
  instead that the data of that meter is not recent enough (with the meter's name).
  Comparing everything up to a common cut-off time is a possible later improvement.
- The backend computes period values, untracked and warnings as it does for devices
  today (`energy` and `card` commands); the panel computes "Now" from states as today.

### Card

Same Home value, untracked block and warning, read-only. The home meter appears with the
other sources when `show_sources` is on. No new card option (my call).

## Left to the builder

- Exact detection of home-source support, as long as it is in `energy_access.py` and
  testable on 2026.10 test packages (e.g. by patching).
- Colour and icon of the home meter block, and the exact strings (in all four languages).
- Whether computed home consumption is done in `hierarchy.py` as one pure function
  (preferred) and how it is returned in the WebSocket results.
- Test setup: CI keeps testing on 2026.10 with the current package; the home-meter code
  is unit-tested without HA's schema and checked once on a local 2026.11 instance.
