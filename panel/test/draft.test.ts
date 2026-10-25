import { describe, expect, it } from "vitest";

import {
  applyChanges,
  applySourceChanges,
  buildTree,
  changeKind,
  flowInLitresPerMinute,
  NEW_GRID,
  NEW_WATER,
  canMove,
  displayName,
  moveTargets,
  powerInWatts,
  rateValue,
  sourceKind,
  sourceRows,
  subtree,
  type TreeNode,
  untracked,
  walk,
} from "../src/draft";
import type { Device, HomeAssistant } from "../src/types";

function device(stat: string, parent?: string, extra: Partial<Device> = {}): Device {
  return {
    stat_consumption: stat,
    ...(parent ? { included_in_stat: parent } : {}),
    ...extra,
  };
}

function deep(): Device[] {
  return [
    device("main", undefined, { name: "Main", stat_rate: "sensor.main_power" }),
    device("kitchen", "main"),
    device("coffee", "kitchen"),
    device("grinder", "coffee", { future: { keep: true } }),
    device("office", "main"),
    device("garage"),
  ];
}

type Shape = [string, Shape[]];
function shape(nodes: TreeNode[]): Shape[] {
  return nodes.map((node) => [node.stat, shape(node.children)]);
}

describe("buildTree", () => {
  it("nests in configuration order", () => {
    expect(shape(buildTree(deep()))).toEqual([
      [
        "main",
        [
          ["kitchen", [["coffee", [["grinder", []]]]]],
          ["office", []],
        ],
      ],
      ["garage", []],
    ]);
  });

  it("puts missing parents and cycles at the top", () => {
    const roots = buildTree([
      device("a", "b"),
      device("b", "a"),
      device("c", "a"),
      device("orphan", "gone"),
      device("a", "x"),
    ]);
    expect(shape(roots)).toEqual([
      ["a", [["c", []]]],
      ["b", []],
      ["orphan", []],
    ]);
    expect(roots.map((n) => n.problem)).toEqual(["cycle", "cycle", "missing_parent"]);
  });

  it("walks depth-first", () => {
    expect(walk(buildTree(deep())).map((n) => n.stat)).toEqual([
      "main",
      "kitchen",
      "coffee",
      "grinder",
      "office",
      "garage",
    ]);
  });
});

describe("applyChanges", () => {
  it("moves, adds, renames and removes like the backend", () => {
    const base = deep();
    const result = applyChanges(base, [
      { type: "move", stat: "grinder", parent: "garage" },
      { type: "add", stat: "tv", parent: "office", name: " TV ", stat_rate: "sensor.tv_power" },
      { type: "add", stat: "lamp", parent: null, name: "", stat_rate: null },
      { type: "rename", stat: "main", name: "  " },
      { type: "rename", stat: "office", name: "Office" },
      { type: "remove", stat: "kitchen" },
    ]);
    const byStat = Object.fromEntries(result.map((d) => [d.stat_consumption, d]));
    expect(byStat.grinder).toEqual(device("grinder", "garage", { future: { keep: true } }));
    expect(byStat.tv).toEqual({
      stat_consumption: "tv",
      stat_rate: "sensor.tv_power",
      name: "TV",
      included_in_stat: "office",
    });
    expect(byStat.lamp).toEqual({ stat_consumption: "lamp" });
    expect(byStat.main.name).toBeUndefined();
    expect(byStat.office.name).toBe("Office");
    expect(byStat.kitchen).toBeUndefined();
    expect(byStat.coffee.included_in_stat).toBe("main");
    // The input is not modified.
    expect(base).toEqual(deep());
  });

  it("removing a top-level device makes its children top-level", () => {
    const result = applyChanges(deep(), [{ type: "remove", stat: "main" }]);
    expect(buildTree(result).map((n) => n.stat)).toEqual(["kitchen", "office", "garage"]);
  });

  it("leaves devices alone on source changes", () => {
    const result = applyChanges(deep(), [
      { type: "unassign_source", stat: "main" },
      { type: "assign_source", role: "import", stat: "main" },
    ]);
    expect(result).toEqual(deep());
  });

  it("applies each change to its own list", () => {
    const water = [device("house"), device("tap", "house")];
    const changes = [
      { type: "remove", stat: "tap", kind: "water" },
      { type: "add", stat: "shower", parent: "house", kind: "water" },
      { type: "rename", stat: "main", name: "Main board", kind: "electricity" },
      { type: "remove", stat: "garage" },
    ] as const;
    expect(applyChanges(water, [...changes], "water")).toEqual([
      device("house"),
      device("shower", "house"),
    ]);
    const electricity = applyChanges(deep(), [...changes]);
    expect(electricity.map((d) => d.stat_consumption)).not.toContain("garage");
    expect(electricity[0].name).toBe("Main board");
    expect(changeKind(changes[0])).toBe("water");
    expect(changeKind(changes[3])).toBe("electricity");
    expect(changeKind({ type: "unassign_source", stat: "x" })).toBeNull();
  });

  it("skips changes that do not fit", () => {
    const result = applyChanges(deep(), [
      { type: "add", stat: "main" },
      { type: "move", stat: "unknown", parent: null },
      { type: "remove", stat: "unknown" },
    ]);
    expect(result).toEqual(deep());
  });
});

describe("moving", () => {
  it("knows a device's subtree", () => {
    expect([...subtree(deep(), "kitchen")].sort()).toEqual(["coffee", "grinder", "kitchen"]);
  });

  it("refuses the own subtree and no-ops", () => {
    const devices = deep();
    expect(canMove(devices, "kitchen", "grinder")).toBe(false);
    expect(canMove(devices, "kitchen", "kitchen")).toBe(false);
    expect(canMove(devices, "kitchen", "main")).toBe(false); // already there
    expect(canMove(devices, "kitchen", null)).toBe(true);
    expect(canMove(devices, "garage", null)).toBe(false);
    expect(canMove(devices, "unknown", null)).toBe(false);
    expect(moveTargets(devices, "kitchen")).toEqual(["office", "garage"]);
  });
});

describe("names and power", () => {
  it("prefers the own name, then the entity name", () => {
    const stats = {
      kitchen: { name: "Kitchen meter" },
    } as unknown as Parameters<typeof displayName>[2];
    expect(displayName("main", deep(), stats)).toBe("Main");
    expect(displayName("kitchen", deep(), stats)).toBe("Kitchen meter");
    expect(displayName("garage", deep(), stats)).toBe("garage");
  });

  it("converts power to W", () => {
    const hass = {
      states: {
        "sensor.w": { entity_id: "sensor.w", state: "50", attributes: { unit_of_measurement: "W" } },
        "sensor.kw": { entity_id: "sensor.kw", state: "1.5", attributes: { unit_of_measurement: "kW" } },
        "sensor.none": { entity_id: "sensor.none", state: "7", attributes: {} },
        "sensor.na": { entity_id: "sensor.na", state: "unavailable", attributes: {} },
        "sensor.bad": { entity_id: "sensor.bad", state: "1", attributes: { unit_of_measurement: "A" } },
      },
    } as unknown as HomeAssistant;
    expect(powerInWatts(hass, "sensor.w")).toBe(50);
    expect(powerInWatts(hass, "sensor.kw")).toBe(1500);
    expect(powerInWatts(hass, "sensor.none")).toBe(7);
    expect(powerInWatts(hass, "sensor.na")).toBeNull();
    expect(powerInWatts(hass, "sensor.bad")).toBeNull();
    expect(powerInWatts(hass, "sensor.missing")).toBeNull();
    expect(powerInWatts(hass, undefined)).toBeNull();
  });

  it("converts flow to L/min", () => {
    const state = (unit: string | undefined, value = "2") => ({
      entity_id: "x",
      state: value,
      attributes: unit ? { unit_of_measurement: unit } : {},
    });
    const hass = {
      states: {
        "sensor.lmin": state("L/min"),
        "sensor.m3h": state("m³/h", "0.6"),
        "sensor.gal": state("gal/min", "1"),
        "sensor.none": state(undefined),
        "sensor.bad": state("W"),
        "sensor.w": state("W", "50"),
      },
    } as unknown as HomeAssistant;
    expect(flowInLitresPerMinute(hass, "sensor.lmin")).toBe(2);
    expect(flowInLitresPerMinute(hass, "sensor.m3h")).toBeCloseTo(10);
    expect(flowInLitresPerMinute(hass, "sensor.gal")).toBeCloseTo(3.785);
    expect(flowInLitresPerMinute(hass, "sensor.none")).toBe(2);
    expect(flowInLitresPerMinute(hass, "sensor.bad")).toBeNull();
    expect(flowInLitresPerMinute(hass, undefined)).toBeNull();
    expect(rateValue(hass, "sensor.w", "electricity")).toBe(50);
    expect(rateValue(hass, "sensor.w", "water")).toBeNull();
    expect(rateValue(hass, "sensor.lmin", "water")).toBe(2);
  });

  it("computes untracked consumption", () => {
    const roots = buildTree(deep());
    const values = new Map<string, number | null>([
      ["main", 50],
      ["kitchen", 30],
      ["coffee", 20],
      ["grinder", 5],
      ["office", 10],
    ]);
    expect(untracked(roots, values)).toEqual(
      new Map([
        ["main", 10],
        ["kitchen", 10],
        ["coffee", 15],
      ]),
    );
    values.delete("office");
    expect(untracked(roots, values).get("main")).toBeNull();
  });
});

describe("sourceRows", () => {
  it("lists one row per energy statistic", () => {
    expect(
      sourceRows([
        { type: "grid", stat_energy_from: "imp", stat_energy_to: "exp" },
        { type: "grid", stat_energy_from: null, stat_energy_to: "exp2" },
        { type: "solar", stat_energy_from: "pv", name: "Roof" },
        { type: "battery", stat_energy_from: "out", stat_energy_to: "in" },
        { type: "gas", stat_energy_from: "gas" },
        { type: "water", stat_energy_from: "water" },
        { type: "heat", stat_energy_from: "heat" },
      ]),
    ).toEqual([
      { type: "grid", role: "import", stat: "imp", name: undefined },
      { type: "grid", role: "export", stat: "exp", name: undefined },
      { type: "grid", role: "export", stat: "exp2", name: undefined },
      { type: "solar", role: "production", stat: "pv", name: "Roof" },
      { type: "battery", role: "discharge", stat: "out", name: undefined },
      { type: "battery", role: "charge", stat: "in", name: undefined },
      { type: "gas", role: "gas", stat: "gas", name: undefined },
      { type: "water", role: "water", stat: "water", name: undefined },
      { type: "heat", role: "consumption", stat: "heat", name: undefined },
    ]);
  });

  it("lists the sources of one tab", () => {
    const sources = [
      { type: "grid", stat_energy_from: "imp" },
      { type: "gas", stat_energy_from: "gas" },
      { type: "water", stat_energy_from: "water" },
    ];
    expect(sourceRows(sources, "water").map((r) => r.stat)).toEqual(["water"]);
    expect(sourceRows(sources, "electricity").map((r) => r.stat)).toEqual(["imp", "gas"]);
    expect(sourceKind(sources[2])).toBe("water");
    expect(sourceKind(sources[1])).toBe("electricity");
  });
});

describe("applySourceChanges", () => {
  const grid = {
    type: "grid",
    stat_energy_from: "imp",
    stat_energy_to: null,
    number_energy_price: 0.3,
    power_config: { stat_rate: "p" },
  };

  it("replaces grid meters and keeps prices", () => {
    const result = applySourceChanges(
      [grid],
      [
        { type: "assign_source", role: "import", stat: "imp2" },
        { type: "assign_source", role: "export", stat: "exp" },
      ],
    );
    expect(result).toEqual([{ ...grid, stat_energy_from: "imp2", stat_energy_to: "exp" }]);
    expect(grid.stat_energy_from).toBe("imp");
  });

  it("creates a grid without costs and adds solar and battery", () => {
    const result = applySourceChanges(
      [],
      [
        { type: "assign_source", role: "export", stat: "exp" },
        { type: "assign_source", role: "production", stat: "pv" },
        { type: "assign_source", role: "battery", stat: "out", stat_to: "in" },
        { type: "assign_source", role: "battery", stat: "lonely" },
      ],
    );
    expect(result).toEqual([
      { ...NEW_GRID, stat_energy_to: "exp" },
      { type: "solar", stat_energy_from: "pv", config_entry_solar_forecast: null },
      { type: "battery", stat_energy_from: "out", stat_energy_to: "in" },
    ]);
    expect(NEW_GRID.stat_energy_to).toBeNull();
  });

  it("removes meters and empty sources", () => {
    const sources = [
      { ...grid, stat_energy_to: "exp" },
      { type: "grid", stat_energy_from: "imp2", stat_energy_to: null },
      { type: "solar", stat_energy_from: "pv" },
    ];
    const result = applySourceChanges(sources, [
      { type: "unassign_source", stat: "imp" },
      { type: "unassign_source", stat: "imp2" },
      { type: "unassign_source", stat: "pv" },
      { type: "unassign_source", stat: "unknown" },
    ]);
    expect(result).toEqual([{ ...grid, stat_energy_from: null, stat_energy_to: "exp" }]);
  });

  it("replaces the meter of the given grid connection", () => {
    const second = { type: "grid", stat_energy_from: "b", number_energy_price: 0.2 };
    const result = applySourceChanges(
      [grid, second],
      [
        { type: "assign_source", role: "import", stat: "c", replace: "b" },
        { type: "assign_source", role: "export", stat: "d", replace: "nope" },
      ],
    );
    expect(result).toEqual([grid, { ...second, stat_energy_from: "c" }]);
  });

  it("keeps gas sources", () => {
    const gas = { type: "gas", stat_energy_from: "g" };
    expect(applySourceChanges([gas], [{ type: "unassign_source", stat: "g" }])).toEqual([gas]);
  });

  it("adds, replaces and removes water meters", () => {
    const water = { type: "water", stat_energy_from: "w1", number_energy_price: 2 };
    const result = applySourceChanges(
      [water],
      [
        { type: "assign_source", role: "water", stat: "w2", replace: "w1" },
        { type: "assign_source", role: "water", stat: "w3", replace: "nope" },
        { type: "assign_source", role: "water", stat: "w4" },
      ],
    );
    expect(result).toEqual([
      { ...water, stat_energy_from: "w2" },
      { ...NEW_WATER, stat_energy_from: "w4" },
    ]);
    expect(NEW_WATER.stat_energy_from).toBeNull();
    expect(applySourceChanges(result, [{ type: "unassign_source", stat: "w4" }])).toEqual([
      { ...water, stat_energy_from: "w2" },
    ]);
  });

  it("ignores device changes", () => {
    expect(applySourceChanges([grid], [{ type: "remove", stat: "x" }])).toEqual([grid]);
  });
});
