# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Before 1.0, minor releases may contain
breaking changes; they are marked as **Breaking**.

## [Unreleased]

### Added

- Option "Backups to keep" (5 to 100, default 20) under Settings → Devices & services →
  Energy Flow Mapper → Configure.
- Export of the current energy sources and devices, or of any backup, as a JSON file from
  the Backups dialog.
- Import of such a file: it is checked like a draft, the changes are shown for
  confirmation, and the current settings are backed up first.
- README section about where backups are kept and how they get into Home Assistant
  backups.

## [0.1.0] - 2026-10-23

First public beta.

### Added

- Admin panel **Energy Flow Mapper** in the sidebar that shows the energy dashboard
  configuration as a diagram: sources, Home and devices as blocks, arranged
  automatically, with arrows from each device to the devices it includes. Zoom and move
  with the mouse wheel, by dragging or with two fingers.
- Live power and energy per period (now, today, 7 days, 30 days): blocks, Home and arrow
  widths follow the value; devices with sub-devices show the consumption that is not
  tracked individually.
- Plausibility warnings when sub-devices used clearly more energy than their device
  (more than 5 % and 0.1 kWh).
- Edit by drag and drop or the ⋮ menu: include a device in another one, move it to the
  top level, rename or remove it. While dragging, valid targets are highlighted.
- Free sensors: unused energy meters and external energy statistics (e.g. from energy
  supplier portals) can be added as devices.
- Sources: drag a free sensor onto grid import, grid export, solar or battery, or tap a
  source to assign, replace or remove its sensor. Prices of the grid connection stay.
  Gas and water sources are shown only.
- Meters for power sensors without an energy meter: "Create meter" adds an ordinary
  integral helper (it keeps working without Energy Flow Mapper) and puts it into the
  draft; helpers created by the panel are labelled.
- Changes are collected in a draft, checked (loops, missing parents, duplicates, a
  sensor used as source and device or by two sources, and what Home Assistant itself
  would reject) and saved in one step after a confirmation. Every save stores a backup first (the last 20 are kept); "Undo last
  save" and "Backups" restore an earlier state.
- Saving is refused when the energy settings were changed elsewhere in the meantime;
  the panel reloads and keeps the draft.
- Repair issue and disabled editor when the energy settings of the Home Assistant
  release are not supported.
- Diagnostics with counts only (no entity names).
- English, German, French and Italian; light and dark theme; phone layout.
