import { describe, expect, it } from "vitest";

import { buildTree, freeSolars, solarDrop, solarElsewhere, solarPlaces, sourceRows } from "../src/draft";
import { displayTree } from "../src/groups";
import { BOX_H, layout, solarBlockId, untrackedId } from "../src/layout";
import type { Device, Source } from "../src/types";

function device(stat: string, parent?: string): Device {
  return parent ? { stat_consumption: stat, included_in_stat: parent } : { stat_consumption: stat };
}

const ROOF: Source = { type: "solar", stat_energy_from: "sensor.roof" } as Source;
const GARAGE: Source = { type: "solar", stat_energy_from: "sensor.garage_pv" } as Source;
const GRID: Source = { type: "grid", stat_energy_from: "sensor.grid_in" } as Source;
const DEVICES = [device("f11"), device("tv", "f11"), device("f13")];

describe("solar places in the draft", () => {
  it("keeps places of solar sources at electricity devices of the draft", () => {
    const places = {
      "sensor.roof": "f11",
      "sensor.garage_pv": "gone",
      "sensor.grid_in": "f13",
      "sensor.old_solar": "f13",
    };
    const found = solarPlaces([GRID, ROOF, GARAGE], DEVICES, places);
    expect([...found.entries()]).toEqual([["f11", ["sensor.roof"]]]);
    // The solar at a removed device is free again.
    expect(freeSolars([GRID, ROOF, GARAGE], DEVICES, places)).toEqual(["sensor.garage_pv"]);
    expect(freeSolars([GRID], DEVICES, places)).toEqual([]);
  });

  it("lists two solars at one device in source order", () => {
    const found = solarPlaces([ROOF, GARAGE], DEVICES, { "sensor.garage_pv": "f13", "sensor.roof": "f13" });
    expect(found.get("f13")).toEqual(["sensor.roof", "sensor.garage_pv"]);
    expect(freeSolars([ROOF, GARAGE], DEVICES, { "sensor.garage_pv": "f13", "sensor.roof": "f13" })).toEqual([]);
  });

  it("warns at a meter that still counts a solar placed elsewhere", () => {
    const counted = { f11: ["sensor.roof"], f13: ["sensor.roof"], free_gross: ["sensor.roof"] };
    expect([...solarElsewhere([ROOF], DEVICES, { "sensor.roof": "f13" }, counted).entries()]).toEqual([
      ["f11", [{ solar: "sensor.roof", placedAt: "f13" }]],
    ]);
    // Not placed, or placed at no device of the draft: no warning.
    expect(solarElsewhere([ROOF], DEVICES, {}, counted).size).toBe(0);
    expect(solarElsewhere([ROOF], DEVICES, { "sensor.roof": "gone" }, counted).size).toBe(0);
  });
});

describe("dropping a solar block", () => {
  const counted = { f11: ["sensor.roof"] };
  const holds = { "sensor.roof_copy": "solar" as const };
  const devices = [...DEVICES, device("sensor.roof"), device("sensor.roof_copy")];

  it("places at a meter that counts the solar and sets up the others", () => {
    expect(solarDrop("sensor.roof", "f11", devices, {}, counted, holds)).toBe("place");
    expect(solarDrop("sensor.roof", "f13", devices, {}, counted, holds)).toBe("setup");
  });

  it("refuses the solar's own meter, a meter that is the solar, its place and no device", () => {
    expect(solarDrop("sensor.roof", "sensor.roof", devices, {}, counted, holds)).toBeNull();
    expect(solarDrop("sensor.roof", "sensor.roof_copy", devices, {}, counted, holds)).toBeNull();
    expect(solarDrop("sensor.roof", "f11", devices, { "sensor.roof": "f11" }, counted, holds)).toBeNull();
    expect(solarDrop("sensor.roof", "gone", devices, {}, counted, holds)).toBeNull();
    expect(solarDrop("sensor.roof", "home", devices, {}, counted, holds)).toBeNull();
  });
});

describe("layout with solar places", () => {
  const rows = sourceRows([ROOF]);
  const places = new Map([["f11", rows], ["f13", rows]]);

  it("puts a placed solar first below its device, edge into the device", () => {
    const result = layout(buildTree(DEVICES), rows, new Map(), new Map(), new Set(), [], true, "horizontal", false, places);
    const blocks = Object.fromEntries(result.blocks.map((b) => [b.id, b]));
    const solar = blocks[solarBlockId("sensor.roof", "f11")];
    expect(solar).toMatchObject({ kind: "solar", stat: "sensor.roof", placedAt: "f11", role: "production" });
    expect(solar.source?.stat).toBe("sensor.roof");
    expect(solar.y).toBe(blocks.tv.y);
    expect(solar.x).toBeLessThan(blocks.tv.x);
    expect(result.edges).toContainEqual({ from: solarBlockId("sensor.roof", "f11"), to: "f11", kind: "solar", power: null });
    // A device without children gets the solar too, but no untracked block.
    const lone = blocks[solarBlockId("sensor.roof", "f13")];
    expect(lone.y).toBe(blocks.f13.y + BOX_H + 56);
    expect(blocks[untrackedId("f13")]).toBeUndefined();
    expect(blocks[untrackedId("f11")]).toBeDefined();
  });

  it("hides the solar of a collapsed device", () => {
    const result = layout(
      displayTree(buildTree(DEVICES), []),
      rows,
      new Map(),
      new Map(),
      new Set(["f11"]),
      [],
      true,
      "vertical",
      false,
      places,
    );
    const ids = result.blocks.map((b) => b.id);
    expect(ids).not.toContain(solarBlockId("sensor.roof", "f11"));
    expect(ids).toContain(solarBlockId("sensor.roof", "f13"));
  });

  it("without places it is the plain layout", () => {
    const tree = buildTree(DEVICES);
    expect(layout(tree, rows, new Map(), new Map(), new Set(), [], true, "horizontal", false, new Map())).toEqual(
      layout(tree, rows, new Map(), new Map(), new Set(), [], true, "horizontal", false),
    );
  });
});
