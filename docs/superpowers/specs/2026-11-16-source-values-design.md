# Source values in the diagram – design

Approved by the maintainer on 2026-11-16. Short design (small change).

## Intent

Source blocks (grid import, grid export, solar, battery discharge/charge, gas, water) show
values like device blocks do: the power now, or the energy of the selected period. Asked for
in GitHub issue #1 ("Why are those top level inputs not displaying current values like the
rest of them?"); the maintainer agreed to do it.

## Goals

- **Now:** each source block shows its current power from Home Assistant's own power sensor
  of that source (`stat_rate` in the energy settings; HA 2026.10 and 2026.11). For grid and battery that
  sensor is signed (HA: positive = from grid / discharging, negative = to grid / charging;
  HA turns `power_config` into this `stat_rate`). Grid import and battery discharge show the
  positive part, grid export and battery charge the negative part as a positive number
  (0 when the flow goes the other way). Solar shows the sensor, but never below 0
  (an inverter's standby draw at night); the home meter shows its power. Gas (already done)
  and water show their flow sensor. No power sensor: no value line, as for devices.
- **Periods (today, 7 days, 30 days):** the energy (water/gas: volume or energy) of the
  source's statistic in the period. The panel already loads these values for the home
  consumption; they are only not shown.
- **Panel and dashboard card** behave the same.

## Non-goals

- The lines from the sources to Home keep their width; they do not scale with the power.
- No guessing a power sensor from the HA device when the energy settings have none.
- Placeholders ("+ Solar", …) show no value.

## Constraints

- Minimum Home Assistant 2026.10.0: there sources may have no `stat_rate`; then "now" shows
  nothing.
- The card command stays read-only and keeps to what the card shows (SPEC §2 exception):
  it now also returns each source's `stat_rate` (an entity ID, no prices).
- New user-facing text, if any, in EN/DE/FR/IT.

## Approaches

1. **Use HA's own `stat_rate` of the source (chosen).** Exactly what HA's energy dashboard
   uses; no guessing; signs as HA defines them.
2. Guess a power sensor via the source's HA device – rejected: unreliable, may pick the
   wrong sensor.
3. Compute values in the backend – rejected: adds nothing; the panel and card already have
   period energy and read live states themselves, as for devices.

## Left to the builder

Formatting (same helpers as devices: power with the user's units, energy/volume per tab),
where the shared "signed part" logic lives (a pure helper in `draft.ts`, unit tested), and the
card's data shape for the source `stat_rate`.

## After the review (2026-11-16)

- The value stands in front of the sensor name on one line, like a device's value and area
  («800 W · Roof PV»), so the role keeps its two lines and is never cut short.
- "Save as image" without names keeps the sources' values and drops only their sensor names.
- A home meter whose data is late shows no part value in a period (Home already names it).
- Power from 1 000 kW shows in MW; GW and TW are understood; "-0" shows as 0.
