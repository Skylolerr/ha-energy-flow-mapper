<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/banner-dark.png">
    <img alt="Energy Flow Mapper – a visual editor for the Home Assistant energy dashboard" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/banner-light.png" width="900">
  </picture>
</p>

<p align="center">
  <a href="https://hacs.xyz/docs/faq/custom_repositories"><img alt="HACS custom repository" src="https://img.shields.io/badge/HACS-custom-41BDF5?logo=homeassistantcommunitystore&logoColor=white"></a>
  <a href="https://github.com/Skylolerr/ha-energy-flow-mapper/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Skylolerr/ha-energy-flow-mapper?sort=semver&color=0c63b8"></a>
  <img alt="Home Assistant 2026.10 or newer" src="https://img.shields.io/badge/Home%20Assistant-2026.10%2B-18BCF2?logo=homeassistant&logoColor=white">
  <a href="https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/validate.yml"><img alt="Validate" src="https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/validate.yml/badge.svg"></a>
  <a href="https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/tests.yml"><img alt="Tests" src="https://github.com/Skylolerr/ha-energy-flow-mapper/actions/workflows/tests.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/Skylolerr/ha-energy-flow-mapper?color=555"></a>
</p>

<p align="center">
  <a href="https://my.home-assistant.io/redirect/hacs_repository/?owner=Skylolerr&repository=ha-energy-flow-mapper&category=integration"><img alt="Open this repository in HACS" src="https://my.home-assistant.io/badges/hacs_repository.svg"></a>
  <a href="https://my.home-assistant.io/redirect/config_flow_start/?domain=energy_flow_mapper"><img alt="Set up Energy Flow Mapper" src="https://my.home-assistant.io/badges/config_flow_start.svg"></a>
</p>

**Not another energy card – a visual editor that maps your sensors into the Home
Assistant energy dashboard.** Energy Flow Mapper shows your energy configuration as a
diagram – sources at the top, your home in the middle, devices below – and lets you
change it by drag and drop: which device is included in which, which sensor is your grid,
solar, battery or water meter, and which meters are not used yet.

> [!NOTE]
> **Beta.** Breaking changes are possible before 1.0. Every save keeps a backup of your
> previous energy settings, so you can always go back.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/diagram-dark.png">
    <img alt="The Energy Flow Mapper panel: sources at the top, Home in the middle, devices below, free sensors on the left, details on the right" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/diagram-light.png">
  </picture>
</p>

## See it in action

<table>
  <tr>
    <td width="50%"><img alt="Switching between now, today, 7 days and 30 days: values and arrow widths follow" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/periods.gif"></td>
    <td width="50%"><img alt="Dragging the coffee machine onto Office; the possible targets light up" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/drag.gif"></td>
  </tr>
  <tr>
    <td><b>Live and per period.</b> Power now, or energy of today, 7 or 30 days – arrow widths follow the value.</td>
    <td><b>Drag and drop.</b> Drop a device onto another one to include it there; valid targets light up.</td>
  </tr>
  <tr>
    <td colspan="2"><img alt="Switching from the electricity tab to the water tab and back" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/tabs.gif"></td>
  </tr>
  <tr>
    <td colspan="2"><b>Electricity and water.</b> Each has its own tab with its own devices, meters and free sensors.</td>
  </tr>
</table>

## Features

**See your setup**

- **Diagram of your energy dashboard** – sources, Home and devices, arranged
  automatically; zoom and move with the mouse wheel, by dragging or with two fingers.
- **Live power and energy per period** – now, today, 7 days or 30 days. Every device with
  sub-devices shows what is *not tracked individually*.
- **Plausibility warnings** – a device is flagged when its sub-devices used clearly more
  than it did (more than 5 % and 0.1 kWh, water 10 L) – usually a wrong assignment.
- **Find a device** – the search field highlights matches, opens collapsed devices and
  moves to them.

**Change it safely**

- **Drag and drop** (or the ⋮ menu on phones) – include a device in another one, move it to
  the top level, rename or remove it.
- **Sources** – drop a sensor onto grid import, grid export, solar, battery or water.
  Prices and compensations of an existing source stay as they are.
- **Free sensors** – energy and water meters and external statistics (for example from
  your supplier's portal) that are not in the dashboard yet, added with one drag.
- **Meters for power and flow sensors** – "Create meter" turns a power sensor (a UPS, PoE
  ports, …) or a flow sensor into an ordinary integral helper and puts it in the diagram.
- **Draft, check, save** – changes are collected in a draft and checked (loops, missing
  parents, duplicates, a sensor used twice) before anything is written. *Undo change*
  takes back a step, and every save stores a backup first.

**Everywhere**

- **Dashboard card** – the same tree, read-only, on any dashboard and for every user.
- **Water tab** – water devices and meters, in litres and m³ (gallons with US units).
- **Backups, export and import** – restore any earlier state or keep a copy elsewhere.
- **English, German, French and Italian**, light and dark theme, phone layout.

## Installation

1. **HACS:** click *Open this repository in HACS* above, or add
   `https://github.com/Skylolerr/ha-energy-flow-mapper` under HACS → ⋮ → **Custom
   repositories** with type **Integration**. Download **Energy Flow Mapper** and restart
   Home Assistant.
2. **Set up:** click *Set up Energy Flow Mapper* above, or Settings → Devices & services →
   **Add integration** → **Energy Flow Mapper**.
3. **Open the panel:** **Energy Flow Mapper** appears in the sidebar for admins. The setup
   itself does not change your energy settings.

Requires Home Assistant **2026.10.0** or newer. The panel is for admins; the dashboard
card is for everyone.

<details>
<summary>Manual installation</summary>

Copy `custom_components/energy_flow_mapper` into the `custom_components` folder of your
Home Assistant configuration and restart Home Assistant.
</details>

### Options

Settings → Devices & services → Energy Flow Mapper → **Configure**:

| Option | Default | Meaning |
|---|---|---|
| Backups to keep | 20 | How many backups of your previous energy settings are kept, 5 to 100. If you lower it, the oldest backups beyond the new number are deleted. |

## Dashboard card

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/card-dark.png">
    <img alt="Two dashboard cards: the energy flow of 30 days and the water flow now" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/card-light.png">
  </picture>
</p>

The card shows a device tree on a dashboard. It only shows – editing stays in the panel –
and every user who can see the dashboard sees it, like Home Assistant's own energy
dashboard. Tap a device to open its history.

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

## Using the panel

| To … | Do this |
|---|---|
| Include a device in another one | Drag its block onto the other block, or ⋮ → *Move to …* |
| Move a device to the top level | Drag it onto **Home**, or ⋮ → *Move to …* → *Top level* |
| Add a meter as device | Drag it from *Free sensors* into the diagram, or *Add* |
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

> [!TIP]
> **Nothing is written until you save.** The bar at the bottom shows how many changes your
> draft has; *Undo change* takes back the last one, *Discard* throws the draft away.

<details>
<summary>Good to know</summary>

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
</details>

## Screenshots

| | |
|---|---|
| ![30 days with consumption not tracked individually and a plausibility warning](https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/period.png) | ![The list of changes shown before saving](https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/save.png) |
| *30 days:* energy per device, what is not tracked individually, and a warning | *Saving:* every change is listed before anything is written |
| ![The list of backups with export and restore buttons](https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/backups.png) | ![The water tab over 30 days in litres and m³](https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/water-dark.png) |
| *Backups:* restore, export or import | *Water, 30 days:* litres and m³ per device |

<p align="center">
  <img alt="The panel on a phone, dark theme" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/phone-dark.png" width="260">
  <img alt="The panel on a phone, light theme, 7 days" src="https://raw.githubusercontent.com/Skylolerr/ha-energy-flow-mapper/main/docs/images/phone-light.png" width="260">
</p>

<p align="center"><sub>The screenshots show a demo household.</sub></p>

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

<details>
<summary><b>How it works</b></summary>

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
</details>

<details>
<summary><b>Known limitations</b></summary>

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
</details>

<details>
<summary><b>Troubleshooting</b></summary>

- **Repair issue "does not support this Home Assistant release":** the energy settings of
  your Home Assistant release do not match what Energy Flow Mapper expects. To protect
  your settings the editor is disabled. Update Energy Flow Mapper or open an issue.
- **Something looks wrong after saving:** use *Undo last save* or restore a backup.
- **The card shows "Custom element doesn't exist" or an old version** right after
  installing or updating: reload the page. The browser keeps the Home Assistant page
  cached, and the card's loader is part of it.
- **Report a problem:** open an [issue](https://github.com/Skylolerr/ha-energy-flow-mapper/issues)
  with the diagnostics (Settings → Devices & services → Energy Flow Mapper → ⋮ →
  Download diagnostics; it contains counts only, no entity names) and the log entries for
  `energy_flow_mapper`.
</details>

<details>
<summary><b>Removal</b></summary>

Settings → Devices & services → Energy Flow Mapper → ⋮ → **Delete**, then remove it in
HACS. Your energy settings stay as they are, and helpers created by the panel stay too
(delete them under Settings → Helpers if you no longer need them). The backups are
deleted with the integration.
</details>

## Translations

English and German are maintained by the author; French and Italian are new – community
review is welcome.

Missing your language? Open an
[issue](https://github.com/Skylolerr/ha-energy-flow-mapper/issues) and it will gladly be
added. Translations and corrections from users are very welcome, as an issue or a pull
request. The texts are in two places:

- `custom_components/energy_flow_mapper/translations/<language>.json` (setup, options and
  messages; English base: `en.json`)
- `panel/src/translations/<language>.ts` (the panel and the card; English base: `en.ts`)

Copy the English file, translate the texts and keep the keys and `{placeholders}` as they
are. You do not need to build anything; registering the new language is done when it is
merged.

## Support

Energy Flow Mapper is free and open source. If it saves you time, you can
[buy me a coffee](https://buymeacoffee.com/skylolerr) – thank you! A star on GitHub, a
bug report or a translation helps just as much.

<a href="https://buymeacoffee.com/skylolerr"><img alt="Buy me a coffee" src="https://img.shields.io/badge/Buy%20me%20a%20coffee-FFDD00?logo=buymeacoffee&logoColor=000000"></a>

More of my Home Assistant projects: [skylolerr.com](https://skylolerr.com)

## License

MIT © Skylolerr – see [LICENSE](LICENSE). Changes are listed in the
[changelog](CHANGELOG.md).
