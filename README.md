# Energy Flow Mapper

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Validate](https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/validate.yml/badge.svg)](https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/validate.yml)
[![Tests](https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/tests.yml/badge.svg)](https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/tests.yml)

Not another energy card – a visual editor that maps your sensors into the Home Assistant
energy dashboard.

Energy Flow Mapper adds an admin panel to Home Assistant. It shows your energy
configuration as a diagram – sources at the top, your home in the middle, devices below –
and lets you change it by drag and drop: which device is included in which, which sensor
is your grid import, export, solar, battery or water meter, and which meters are not used
yet. Electricity and water each have their own tab.

> **Beta.** Breaking changes are possible before 1.0. Every save keeps a backup of your
> previous energy settings, so you can always go back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/diagram-dark.png">
  <img alt="The Energy Flow Mapper panel: sources at the top, Home in the middle, devices below, with free sensors on the left and details of the selected device on the right" src="docs/images/diagram-light.png">
</picture>

## Features

- **Diagram of your energy dashboard:** sources, Home and devices as blocks, arranged
  automatically; arrows show which device is included in which. Zoom and move with the
  mouse wheel, by dragging or with two fingers.
- **Live power and energy per period:** switch between now, today, 7 days and 30 days.
  Arrow widths follow the value; every device with sub-devices shows the consumption
  that is *not tracked individually*.
- **Plausibility warnings:** a device is flagged when its sub-devices used clearly more
  energy than it did (more than 5 % and 0.1 kWh) – usually a wrong assignment.
- **Edit by drag and drop** (or with the ⋮ menu on phones): include a device in another
  one, move it to the top level, rename or remove it.
- **Free sensors:** energy meters and external statistics (e.g. from energy supplier
  portals) that are not in the energy dashboard yet; add them with one drag.
- **Sources:** drop a sensor onto grid import, grid export, solar or battery. Existing
  prices and compensations of your grid connection stay as they are.
- **Water tab:** the water devices of the energy dashboard as their own diagram, edited
  the same way, with water meters as sources (their prices stay too). Flow now, and water
  per period in litres and m³ (gallons with US units); a warning when sub-devices used
  more than 5 % and 10 L more than their device.
- **Meters for power and flow sensors:** for power sensors without an energy meter (a
  UPS, PoE ports, …) and flow sensors without a water meter, "Create meter" adds an
  ordinary integral helper and puts it into the diagram.
- **Find a device:** the search field above the diagram highlights matching devices,
  opens collapsed ones and moves to them.
- **Dashboard card:** the same tree, read-only, on any dashboard and for every user –
  electricity or water, now or in a period, for the whole home or from one device down.
- **Safe saving:** changes are collected in a draft and checked (loops, missing parents,
  duplicates, a sensor used twice) before anything is written. Every save first stores a
  backup; "Undo last save" and "Backups" restore an earlier state.
- **English, German, French and Italian**, light and dark theme, phone layout.

## Screenshots

| | |
|---|---|
| ![30 days with consumption not tracked individually and a plausibility warning](docs/images/period.png) | ![Dragging the coffee machine onto Office, with the possible targets highlighted](docs/images/drag.png) |
| *30 days:* energy per device, consumption not tracked individually and a warning | *Drag and drop:* the possible targets are highlighted |
| ![The list of changes shown before saving](docs/images/save.png) | ![The list of backups with restore buttons](docs/images/backups.png) |
| *Saving:* every change is listed before anything is written | *Backups:* restore an earlier state |
| ![The water tab over 30 days: water meter, Home and water devices in litres and m³](docs/images/water-dark.png) | ![The water tab now: flow of each water device in L/min](docs/images/water-light.png) |
| *Water, 30 days:* water devices with litres and m³, and what is not tracked individually | *Water, now:* the flow of each device |

<p>
  <img alt="The panel on a phone, dark theme" src="docs/images/phone-dark.png" width="260">
  <img alt="The panel on a phone, light theme, 7 days" src="docs/images/phone-light.png" width="260">
</p>

The screenshots show a demo household.

## Requirements

- Home Assistant **2026.10.0** or newer
- Admin user (the panel and all its commands are admin-only)

## Installation

### HACS (custom repository)

[![Open your Home Assistant instance and open a repository inside HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Skylolerr&repository=ha-energy-flow-mapper&category=integration)

1. In HACS, open ⋮ → **Custom repositories**, add
   `https://github.com/Skylolerr/ha-energy-flow-mapper` with type **Integration**.
2. Search for **Energy Flow Mapper**, download it and restart Home Assistant.

### Manual

Copy `custom_components/energy_flow_mapper` into the `custom_components` folder of your
Home Assistant configuration and restart Home Assistant.

## Setup

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=energy_flow_mapper)

Settings → Devices & services → **Add integration** → **Energy Flow Mapper** → Submit.
The setup does not change your energy settings; the panel **Energy Flow Mapper** appears
in the sidebar for admins.

### Options

Settings → Devices & services → Energy Flow Mapper → **Configure**:

| Option | Default | Meaning |
|---|---|---|
| Backups to keep | 20 | How many backups of your previous energy settings are kept, 5 to 100. If you lower it, the oldest backups beyond the new number are deleted. |

## Using the panel

| To … | Do this |
|---|---|
| Include a device in another one | Drag its block onto the other block, or ⋮ → *Move to …* |
| Move a device to the top level | Drag it onto **Home**, or ⋮ → *Move to …* → *Top level* |
| Add an energy meter as device | Drag it from *Free sensors* into the diagram, or *Add* |
| Assign a source | Drag a free sensor onto *+ Grid import*, *+ Solar*, … or tap the source |
| Replace or remove a source | Tap the source block |
| Edit water devices and meters | Open the *Water* tab; everything works as for electricity |
| Get a meter for a power sensor | *Power only* → *Create meter* |
| Get a water meter for a flow sensor | *Water* tab → *Flow only* → *Create meter* |
| Find a device in a big diagram | Type in *Find device*; Enter goes to the next match |
| Take back a change of the draft | *Undo change* in the bar at the bottom, or Ctrl+Z |
| See energy instead of power | Switch *Now* to *Today*, *7 days* or *30 days* |
| Save | *Save* in the bar at the bottom, check the list of changes, confirm |
| Go back | *Undo last save* or *Backups* → *Restore* |
| Keep a copy elsewhere | *Backups* → *Export current settings*, or *Export* next to a backup |
| Bring a copy back | *Backups* → *Import from file …*, check the list of changes, confirm |

Good to know:

- **Nothing is written until you save.** The bar at the bottom shows how many changes
  your draft has; *Undo change* takes back the last one, *Discard* throws the draft away.
- **"Create meter" acts at once:** the integral helper is created immediately (not on
  save) and appears under Settings → Helpers. It is an ordinary Home Assistant helper and
  keeps working without Energy Flow Mapper; the panel labels helpers it created. Undoing
  the change in the draft does not delete the helper; it stays a free sensor. A water
  meter counts in the unit of the flow (L/min gives litres, m³/h gives m³) and is shown
  as water, so the energy dashboard accepts it.
- **Energy values** come from the Home Assistant statistics, like in the energy
  dashboard: *Today* is at most a few minutes old, *7 days* and *30 days* go up to the
  last full hour. New meters only have values from the time they were created.
- If someone changes the energy settings elsewhere while you edit, saving is refused and
  the panel reloads; your draft is kept and checked again.

## Dashboard card

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/card-dark.png">
  <img alt="Two dashboard cards: the energy flow of 30 days and the water flow now" src="docs/images/card-light.png">
</picture>

The card shows a device tree on a dashboard. It only shows – editing stays in the
panel – and every user who can see the dashboard sees it, like Home Assistant's own
energy dashboard. Tap a device to open its history.

Add it in the dashboard editor: *Add card* → search for **Energy Flow Mapper**. It comes
with the integration; there is no resource to add. In YAML:

```yaml
type: custom:energy-flow-mapper-card
kind: electricity      # or water
period: today          # now, today, week or month
root: sensor.kitchen_energy   # optional: only this device and everything below it
title: Kitchen         # optional; an empty title hides the header
show_sources: true     # sources above Home (not with root)
show_untracked: true   # blocks for what is not tracked individually
```

A tree wider than the card is shown at half size at least; then the card scrolls
sideways and starts at Home. Values are read again every minute; power and flow *now*
follow the sensors live.

## Backups

- **When:** before every save, restore and import, Energy Flow Mapper backs up the
  previous content of the energy settings it changes (sources, devices and/or water
  devices), with the time, the user and a short summary.
- **Where:** in `/config/.storage/energy_flow_mapper.backups`, next to Home Assistant's own
  energy settings (`/config/.storage/energy`). Both are part of every **Home Assistant
  backup**, so to keep them off the device, use a Home Assistant backup location such as a
  network share or the cloud.
- **How many:** the last 20 by default; set 5 to 100 in the [options](#options).
- **Restore:** *Undo last save* restores the newest backup, *Backups* → *Restore* any of
  them. The current settings are backed up first.
- **Export:** *Backups* → *Export current settings* downloads the energy sources,
  devices and water devices as a JSON file; *Export* next to a backup downloads that
  backup. Keep it wherever you like.
- **Import:** *Backups* → *Import from file …* reads such a file, checks it like a draft
  (including what Home Assistant itself would reject) and shows the list of changes
  before anything is written. Only files exported by Energy Flow Mapper are accepted;
  files from 0.2.0 (without water devices) leave the water devices as they are.
- **Removal:** the backups are deleted with the integration; exported files stay.

## How it works

- The energy dashboard configuration of Home Assistant stays the single source of truth.
  Energy Flow Mapper reads it fresh, writes it through the same checks as the energy
  settings page and always sends complete lists, so unrelated settings are kept.
- Backups are stored in `.storage/energy_flow_mapper.backups` (see [Backups](#backups)),
  the list of helpers created by the panel in `.storage/energy_flow_mapper.helpers`.
- The integration has no entities and no devices.
- The card is served with the panel. Its small loader is added to every frontend page;
  the card itself only loads when a dashboard shows it. Its one command only reads the
  device tree, names and consumption, never prices, and is the only command that users
  who are not admins may use.

## Known limitations

- A device can be included in **one** other device only (a Home Assistant rule).
- Prices, costs and solar forecasts are edited in the energy settings of Home Assistant,
  not in the panel.
- Gas sources are shown only; Home Assistant has no gas devices, so there is nothing
  to arrange.
- "Create meter" needs a flow in litres, m³, ft³ or gallons per time unit; mL/s has no
  matching water unit.
- An external statistic in m³ is offered as free water meter; it may also measure gas.
- Dragging works with a mouse and with a long press on phones; the ⋮ menu offers the
  same actions.

## Troubleshooting

- **Repair issue "does not support this Home Assistant release":** the energy settings of
  your Home Assistant release do not match what Energy Flow Mapper expects. To protect
  your settings the editor is disabled. Update Energy Flow Mapper or open an issue.
- **Something looks wrong after saving:** use *Undo last save* or restore a backup.
- **Report a problem:** open an [issue](https://github.com/Skylolerr/ha-energy-flow-mapper/issues)
  with the diagnostics (Settings → Devices & services → Energy Flow Mapper → ⋮ →
  Download diagnostics; it contains counts only, no entity names) and the log entries for
  `energy_flow_mapper`.

## Removal

Settings → Devices & services → Energy Flow Mapper → ⋮ → **Delete**, then remove it in
HACS. Your energy settings stay as they are, and helpers created by the panel stay too
(delete them under Settings → Helpers if you no longer need them). The backups are
deleted with the integration.

## Translations

English and German are maintained by the author; French and Italian are new – community
review is welcome.

Missing your language? Open an
[issue](https://github.com/Skylolerr/ha-energy-flow-mapper/issues) and it will gladly be
added. Translations and corrections from users are very welcome, as an issue or a pull
request. The texts are in two places:

- `custom_components/energy_flow_mapper/translations/<language>.json` (setup, options and
  messages; English base: `en.json`)
- `panel/src/translations/<language>.ts` (the panel; English base: `en.ts`)

Copy the English file, translate the texts and keep the keys and `{placeholders}` as they
are. You do not need to build anything; registering the new language is done when it is
merged.

## License

MIT, see [LICENSE](LICENSE).
