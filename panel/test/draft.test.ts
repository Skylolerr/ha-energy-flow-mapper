import { describe, expect, it } from "vitest";

import {
  applyChanges,
  applySourceChanges,
  buildTree,
  changeKind,
  coverage,
  flowInLitresPerMinute,
  NEW_GRID,
  NEW_WATER,
  canMove,
  displayName,
  ambiguousDevices,
  homeNow,
  moveTargets,
  powerInWatts,
  rateValue,
  sourceKind,
  sourceNow,
  sourcePower,
  sourceRows,
  subtree,
  suggestionsFor,
  type TreeNode,
  untracked,
  untrackedMissing,
  homeUntracked,
  walk,
} from "../src/draft";
import type { Change, ChildPair, Device, HomeAssistant, Source } from "../src/types";

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

  it.each(["remove", "use_as_home_meter"] as const)(
    "does not let children inherit a missing parent (%s)",
    (type) => {
      const devices: Device[] = [
        { stat_consumption: "p", included_in_stat: "gone" },
        { stat_consumption: "c1", included_in_stat: "p" },
        { stat_consumption: "c2", included_in_stat: "p" },
      ];
      expect(applyChanges(devices, [{ type, stat: "p" }])).toEqual([
        { stat_consumption: "c1" },
        { stat_consumption: "c2" },
      ]);
    },
  );

  it("does not make a child its own parent when removing a device in an old loop", () => {
    const devices: Device[] = [
      { stat_consumption: "a", included_in_stat: "b" },
      { stat_consumption: "b", included_in_stat: "a" },
    ];
    expect(applyChanges(devices, [{ type: "remove", stat: "a" }])).toEqual([{ stat_consumption: "b" }]);
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

  it("sets and clears a device's power sensor", () => {
    const base = [{ stat_consumption: "a", x_unknown: 1 }];
    const set = applyChanges(base, [{ type: "set_rate", stat: "a", stat_rate: "sensor.a_power" }]);
    expect(set[0]).toEqual({ stat_consumption: "a", x_unknown: 1, stat_rate: "sensor.a_power" });
    const cleared = applyChanges(set, [{ type: "set_rate", stat: "a", stat_rate: null }]);
    expect(cleared[0]).toEqual({ stat_consumption: "a", x_unknown: 1 });
  });

  it("skips set_rate for an unknown device", () => {
    expect(applyChanges([], [{ type: "set_rate", stat: "x", stat_rate: null }])).toEqual([]);
  });

  it("sets the power sensor in the water list only", () => {
    const change = { type: "set_rate", stat: "a", stat_rate: "sensor.a_flow", kind: "water" } as const;
    expect(applyChanges([{ stat_consumption: "a" }], [change], "water")).toEqual([
      { stat_consumption: "a", stat_rate: "sensor.a_flow" },
    ]);
    expect(applyChanges([{ stat_consumption: "a" }], [change])).toEqual([{ stat_consumption: "a" }]);
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

  it("gives the power now of a source in the direction of its role", () => {
    const state = (value: string, unit = "W") => ({ entity_id: "x", state: value, attributes: { unit_of_measurement: unit } });
    const hass = {
      states: {
        "sensor.grid_in": state("300"),
        "sensor.grid_out": state("-1.2", "kW"),
        "sensor.battery": state("-500"),
        "sensor.solar": state("800"),
        "sensor.flow": state("6", "L/min"),
        "sensor.na": state("unavailable"),
      },
    } as unknown as HomeAssistant;
    // Home Assistant's sign: positive from the grid / discharging, negative to it / charging.
    expect(sourceNow(hass, { stat_rate: "sensor.grid_in" }, "import")).toBe(300);
    expect(sourceNow(hass, { stat_rate: "sensor.grid_in" }, "export")).toBe(0);
    expect(sourceNow(hass, { stat_rate: "sensor.grid_out" }, "import")).toBe(0);
    expect(sourceNow(hass, { stat_rate: "sensor.grid_out" }, "export")).toBe(1200);
    expect(sourceNow(hass, { stat_rate: "sensor.battery" }, "discharge")).toBe(0);
    expect(sourceNow(hass, { stat_rate: "sensor.battery" }, "charge")).toBe(500);
    expect(sourceNow(hass, { stat_rate: "sensor.solar" }, "production")).toBe(800);
    // An inverter reporting a little standby draw at night still produces nothing.
    expect(sourceNow(hass, { stat_rate: "sensor.battery" }, "production")).toBe(0);
    expect(sourceNow(hass, { stat_rate: "sensor.solar" }, "home")).toBe(800);
    expect(sourceNow(hass, { stat_rate: "sensor.flow" }, "water")).toBe(6);
    expect(sourceNow(hass, { stat_rate: "sensor.na" }, "import")).toBeNull();
    expect(sourceNow(hass, undefined, "production")).toBeNull();
    expect(sourceNow(hass, { stat_rate: "sensor.solar" }, "gas")).toBeNull();
    expect(sourceNow(hass, { stat_rate: "sensor.solar" }, "consumption")).toBeNull();
    // A sensor reporting "-0" shows 0, never "-0 W".
    const zero = { states: { "sensor.z": state("-0") } } as unknown as HomeAssistant;
    expect(Object.is(sourceNow(zero, { stat_rate: "sensor.z" }, "home"), 0)).toBe(true);
    expect(sourceNow(zero, { stat_rate: "sensor.z" }, "water")).toBeNull(); // W is no flow
  });

  it("knows gigawatts and terawatts", () => {
    const hass = {
      states: {
        "sensor.gw": { entity_id: "sensor.gw", state: "0.002", attributes: { unit_of_measurement: "GW" } },
        "sensor.tw": { entity_id: "sensor.tw", state: "0.000001", attributes: { unit_of_measurement: "TW" } },
      },
    } as unknown as HomeAssistant;
    expect(powerInWatts(hass, "sensor.gw")).toBeCloseTo(2_000_000);
    expect(powerInWatts(hass, "sensor.tw")).toBeCloseTo(1_000_000);
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
    // A child without a value measures nothing: its share is untracked.
    values.delete("office");
    values.set("coffee", null);
    expect(untracked(roots, values)).toEqual(
      new Map([
        ["main", 20],
        ["kitchen", 30],
        ["coffee", null],
      ]),
    );
  });

  it("lists the children without a value", () => {
    const roots = buildTree(deep());
    const values = new Map<string, number | null>([
      ["main", 50],
      ["kitchen", 30],
      ["coffee", 20],
      ["grinder", 5],
      ["office", 10],
    ]);
    expect(untrackedMissing(roots, values)).toEqual(new Map());
    values.delete("office");
    values.set("coffee", null);
    expect(untrackedMissing(roots, values)).toEqual(
      new Map([
        ["main", ["office"]],
        ["kitchen", ["coffee"]],
      ]),
    );
  });

  it("computes what no top-level device covers", () => {
    const roots = buildTree(deep());
    const values = new Map<string, number | null>([["main", 50]]);
    expect(homeUntracked(roots, values, 80)).toBe(30);
    expect(homeUntracked(roots, new Map(), 80)).toBe(80);
    expect(homeUntracked(roots, values, null)).toBeNull();
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
    expect(sourceRows(sources, "electricity").map((r) => r.stat)).toEqual(["imp"]);
    expect(sourceRows(sources, "gas").map((r) => r.stat)).toEqual(["gas"]);
    expect(sourceKind(sources[2])).toBe("water");
    expect(sourceKind(sources[1])).toBe("gas");
    expect(sourceKind(sources[0])).toBe("electricity");
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

  it("adds, replaces and removes gas meters", () => {
    const gas = { type: "gas", stat_energy_from: "g1", number_energy_price: 1.2 };
    const water = { type: "water", stat_energy_from: "w" };
    const result = applySourceChanges(
      [gas, water],
      [
        { type: "assign_source", role: "gas", stat: "g2", replace: "g1" },
        // A water meter is no gas meter: nothing to replace.
        { type: "assign_source", role: "gas", stat: "g3", replace: "w" },
        { type: "assign_source", role: "gas", stat: "g4" },
      ],
    );
    expect(result).toEqual([
      { type: "gas", stat_energy_from: "g2", number_energy_price: 1.2 },
      water,
      { ...NEW_WATER, type: "gas", stat_energy_from: "g4" },
    ]);
    expect(applySourceChanges(result, [{ type: "unassign_source", stat: "g2" }])).toEqual(result.slice(1));
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

describe("home meter", () => {
  const HOME = { type: "home", stat_energy_to: "main", stat_rate: "main_power", name: "Main", x: 1 };

  it("is a source row of electricity", () => {
    expect(sourceRows([HOME])).toEqual([{ type: "home", role: "home", stat: "main", name: "Main", stat_rate: "main_power" }]);
    expect(sourceRows([HOME], "water")).toEqual([]);
  });

  it("is assigned, replaced and removed", () => {
    expect(applySourceChanges([], [{ type: "assign_source", role: "home", stat: "a" }])).toEqual([
      { type: "home", stat_energy_to: "a" },
    ]);
    expect(applySourceChanges([HOME], [{ type: "assign_source", role: "home", stat: "b" }])).toEqual([
      { ...HOME, stat_energy_to: "b" },
    ]);
    expect(applySourceChanges([HOME], [{ type: "unassign_source", stat: "main" }])).toEqual([]);
  });

  it("can be made from a device, whose children move up", () => {
    const devices = [
      { stat_consumption: "main", stat_rate: "main_power" },
      { stat_consumption: "kitchen", included_in_stat: "main" },
    ];
    const change = { type: "use_as_home_meter" as const, stat: "main" };
    expect(changeKind(change)).toBe("electricity");
    expect(applyChanges(devices, [change])).toEqual([{ stat_consumption: "kitchen" }]);
    expect(applyChanges(devices, [change], "water")).toEqual(devices);
    expect(applySourceChanges([], [change], devices)).toEqual([
      { type: "home", stat_energy_to: "main", stat_rate: "main_power" },
    ]);
    // There is only one home meter.
    expect(applySourceChanges([HOME], [change], devices)).toEqual([HOME]);
  });

  it("gives the power of Home now", () => {
    const hass = { states: { main_power: { entity_id: "main_power", state: "1.5", attributes: { unit_of_measurement: "kW" } } } };
    expect(homeNow(hass as never, [HOME])).toBe(1500);
    expect(homeNow(hass as never, [{ type: "home", stat_energy_to: "main" }])).toBeNull();
    expect(homeNow(hass as never, [])).toBeNull();
  });
});

describe("home meter from a named device", () => {
  it("keeps the device's name", () => {
    const devices = [{ stat_consumption: "main", stat_rate: "main_power", name: "Main panel" }];
    expect(applySourceChanges([], [{ type: "use_as_home_meter", stat: "main" }], devices)).toEqual([
      { type: "home", stat_energy_to: "main", stat_rate: "main_power", name: "Main panel" },
    ]);
  });
});

describe("device names like Home Assistant", () => {
  it("prefers the device's own name, then the energy name, then the statistic's name", () => {
    const stats = {
      a: { name: "A energy", energy_name: "Office hub A" },
      b: { name: "B energy", energy_name: null },
    } as never;
    expect(displayName("a", [{ stat_consumption: "a", name: "Mine" }], stats)).toBe("Mine");
    expect(displayName("a", [{ stat_consumption: "a" }], stats)).toBe("Office hub A");
    expect(displayName("b", [{ stat_consumption: "b" }], stats)).toBe("B energy");
    expect(displayName("c", [], stats)).toBe("c");
  });

  it("adds the entity part where devices of one list share a name, as HA 2026.11.2 does", () => {
    const stats = {
      ch1: { name: "x", energy_name: "Pro EM", energy_entity_name: "Pro EM Channel 1" },
      ch2: { name: "y", energy_name: "Pro EM", energy_entity_name: "Pro EM Channel 2" },
      own: { name: "z", energy_name: "Pro EM", energy_entity_name: "Pro EM Channel 3" },
      lamp: { name: "Lamp energy", energy_name: "Lamp", energy_entity_name: "Lamp energy" },
      old: { name: "w", energy_name: "Pro EM", energy_entity_name: null },
    } as never;
    const list = [{ stat_consumption: "ch1" }, { stat_consumption: "ch2" }, { stat_consumption: "lamp" }];
    expect([...ambiguousDevices(list, stats)].sort()).toEqual(["ch1", "ch2"]);
    const ambiguous = ambiguousDevices(list, stats);
    expect(displayName("ch1", list, stats, ambiguous)).toBe("Pro EM Channel 1");
    expect(displayName("lamp", list, stats, ambiguous)).toBe("Lamp");
    // A user-set name counts, but keeps its name.
    const named = [{ stat_consumption: "own", name: "Pro EM" }, { stat_consumption: "ch1" }];
    expect([...ambiguousDevices(named, stats)]).toEqual(["ch1"]);
    // Without the entity name (HA before 2026.11.2) nothing collides.
    expect(ambiguousDevices([{ stat_consumption: "old" }, { stat_consumption: "ch1" }], stats).size).toBe(0);
  });
});

describe("suggestionsFor", () => {
  const devices: Device[] = [
    { stat_consumption: "sensor.strip" },
    { stat_consumption: "sensor.mid", included_in_stat: "sensor.strip" },
    { stat_consumption: "sensor.o1" },
    { stat_consumption: "sensor.o2", included_in_stat: "sensor.mid" },
  ];
  const pair = (stat: string, parent: string, kind: ChildPair["kind"] = "electricity"): ChildPair => ({
    kind,
    stat,
    parent,
  });

  it("keeps a valid pair", () => {
    expect(suggestionsFor(devices, [pair("sensor.o1", "sensor.strip")], [], "electricity")).toEqual([
      pair("sensor.o1", "sensor.strip"),
    ]);
  });

  it("drops ignored", () => {
    const p = pair("sensor.o1", "sensor.strip");
    expect(suggestionsFor(devices, [p], [{ ...p }], "electricity")).toEqual([]);
  });

  it("drops already below parent (also via an intermediate device)", () => {
    expect(suggestionsFor(devices, [pair("sensor.mid", "sensor.strip")], [], "electricity")).toEqual([]);
    expect(suggestionsFor(devices, [pair("sensor.o2", "sensor.strip")], [], "electricity")).toEqual([]);
  });

  it("drops cycles", () => {
    expect(suggestionsFor(devices, [pair("sensor.strip", "sensor.o2")], [], "electricity")).toEqual([]);
  });

  it("drops other kind and unknown devices", () => {
    expect(suggestionsFor(devices, [pair("sensor.o1", "sensor.strip", "water")], [], "electricity")).toEqual([]);
    expect(suggestionsFor(devices, [pair("sensor.gone", "sensor.strip")], [], "electricity")).toEqual([]);
    expect(suggestionsFor(devices, [pair("sensor.o1", "sensor.gone")], [], "electricity")).toEqual([]);
  });
});

describe("coverage", () => {
  it("is the share of the home the top-level devices cover", () => {
    expect(coverage(10, [2, 3])).toBe(0.5);
    expect(coverage(10, [])).toBe(0);
    expect(coverage(10, [8, 4])).toBe(1.2);
  });

  it("counts a device without a value as covering nothing", () => {
    expect(coverage(10, [2, null])).toBe(0.2);
    expect(coverage(10, [null])).toBe(0);
  });

  it("has no value without a positive home", () => {
    expect(coverage(null, [1])).toBeNull();
    expect(coverage(0, [1])).toBeNull();
    expect(coverage(-2, [1])).toBeNull();
    // A meter that went backwards (reset, mixed statistics) gives no share.
    expect(coverage(10, [5, -1])).toBeNull();
  });
});

describe("removing a source like the backend", () => {
  const grid = { ...NEW_GRID, stat_energy_from: "meter", number_energy_price: 0.3, power_config: { stat_rate: "p" } };
  const home = { type: "home", stat_energy_to: "meter" };

  it("removes only the home meter when it shares the grid import", () => {
    expect(applySourceChanges([grid, home], [{ type: "unassign_source", stat: "meter", role: "home" }])).toEqual([grid]);
    expect(applySourceChanges([grid, home], [{ type: "unassign_source", stat: "meter", role: "import" }])).toEqual([
      { ...grid, stat_energy_from: null },
      home,
    ]);
  });

  it("prefers another source over the home meter without a role", () => {
    const bare = { ...NEW_GRID, stat_energy_from: "meter" };
    const once = applySourceChanges([home, bare], [{ type: "unassign_source", stat: "meter" }]);
    expect(once).toEqual([home]);
    expect(applySourceChanges(once, [{ type: "unassign_source", stat: "meter" }])).toEqual([]);
  });

  it("clears every key of a grid with the meter twice, or the key of the role", () => {
    const both = { ...NEW_GRID, stat_energy_from: "x", stat_energy_to: "x" };
    expect(applySourceChanges([both], [{ type: "unassign_source", stat: "x" }])).toEqual([]);
    expect(applySourceChanges([both], [{ type: "unassign_source", stat: "x", role: "export" }])).toEqual([
      { ...both, stat_energy_to: null },
    ]);
  });

  it("matches only the role given", () => {
    const sources = [
      { type: "solar", stat_energy_from: "s" },
      { type: "battery", stat_energy_from: "s", stat_energy_to: "s" },
    ];
    const types = (role: "production" | "discharge" | "charge" | "gas") =>
      applySourceChanges(sources, [{ type: "unassign_source", stat: "s", role }]).map((s) => s.type);
    expect(types("production")).toEqual(["battery"]);
    expect(types("discharge")).toEqual(["solar"]);
    expect(types("charge")).toEqual(["solar"]);
    expect(types("gas")).toEqual(["solar", "battery"]);
  });

  it("treats an empty power configuration as nothing left", () => {
    const exportOnly = { ...NEW_GRID, stat_energy_to: "exp", power_config: {} };
    expect(applySourceChanges([exportOnly], [{ type: "unassign_source", stat: "exp" }])).toEqual([]);
  });
});

describe("home meter from a device of the draft", () => {
  it("takes the power sensor of a device added earlier", () => {
    const changes: Change[] = [
      { type: "add", stat: "d0", stat_rate: "r" },
      { type: "use_as_home_meter", stat: "d0" },
    ];
    expect(applySourceChanges([], changes, [])).toEqual([{ type: "home", stat_energy_to: "d0", stat_rate: "r" }]);
  });

  it("takes the name a device got earlier", () => {
    const changes: Change[] = [
      { type: "rename", stat: "d0", name: "Main" },
      { type: "use_as_home_meter", stat: "d0" },
    ];
    expect(applySourceChanges([], changes, [{ stat_consumption: "d0" }])).toEqual([
      { type: "home", stat_energy_to: "d0", name: "Main" },
    ]);
  });

  it("skips an unknown device", () => {
    expect(applySourceChanges([], [{ type: "use_as_home_meter", stat: "new" }], [])).toEqual([]);
  });

  it("keeps the device when there is a home meter already", () => {
    const devices = [{ stat_consumption: "p" }, { stat_consumption: "c", included_in_stat: "p" }];
    const change: Change = { type: "use_as_home_meter", stat: "p" };
    expect(applyChanges(devices, [change], "electricity", [{ type: "home", stat_energy_to: "h" }])).toEqual(devices);
    // One assigned earlier in the draft counts too; one removed before does not.
    expect(applyChanges(devices, [{ type: "assign_source", role: "home", stat: "h" }, change])).toEqual(devices);
    const removed = applyChanges(
      devices,
      [{ type: "unassign_source", stat: "h", role: "home" }, change],
      "electricity",
      [{ type: "home", stat_energy_to: "h" }],
    );
    expect(removed).toEqual([{ stat_consumption: "c" }]);
  });
});

describe("set_source_rate", () => {
  const set = (sources: Source[], change: Record<string, unknown>) =>
    applySourceChanges(sources, [{ type: "set_source_rate", ...change } as Change]);

  it.each([
    [{ stat_rate: "sensor.grid_w" }],
    [{ stat_rate_inverted: "sensor.grid_w" }],
    [{ stat_rate_from: "sensor.imp_w", stat_rate_to: "sensor.exp_w" }],
  ])("writes %j as the power_config of a grid and drops stat_rate", (config) => {
    const grid = {
      type: "grid",
      stat_energy_from: "sensor.imp",
      stat_energy_to: "sensor.exp",
      stat_rate: "old",
      x: 1,
    };
    const out = set([grid], { stat: "sensor.imp", role: "import", power_config: config });
    expect(out[0].power_config).toEqual(config);
    expect(out[0]).not.toHaveProperty("stat_rate");
    expect(out[0].x).toBe(1);
  });

  it("clears grid and battery with power_config null or missing", () => {
    const sources = [
      { type: "grid", stat_energy_from: "sensor.imp", stat_energy_to: null, stat_rate: "old", power_config: { stat_rate: "old" } },
      { type: "battery", stat_energy_from: "sensor.dis", stat_energy_to: "sensor.chg", power_config: { stat_rate_inverted: "b" } },
    ];
    let out = set(sources, { stat: "sensor.imp", role: "import" });
    out = set(out, { stat: "sensor.chg", role: "charge", power_config: null });
    for (const source of out) {
      expect(source).not.toHaveProperty("power_config");
      expect(source).not.toHaveProperty("stat_rate");
    }
  });

  it("writes a battery's power_config", () => {
    const battery = { type: "battery", stat_energy_from: "sensor.dis", stat_energy_to: "sensor.chg" };
    const config = { stat_rate_from: "sensor.a", stat_rate_to: "sensor.b" };
    expect(set([battery], { stat: "sensor.dis", role: "discharge", power_config: config })[0].power_config).toEqual(config);
  });

  it.each([
    [{ type: "solar", stat_energy_from: "sensor.pv" }, "production"],
    [{ type: "gas", stat_energy_from: "sensor.pv" }, "gas"],
    [{ type: "water", stat_energy_from: "sensor.pv" }, "water"],
    [{ type: "home", stat_energy_to: "sensor.pv" }, "home"],
  ])("sets and clears stat_rate of %j, and skips a power_config", (source, role) => {
    const change = { stat: "sensor.pv", role };
    const withRate = set([{ ...source, x: 1 }], { ...change, stat_rate: "sensor.pv_w" });
    expect(withRate[0].stat_rate).toBe("sensor.pv_w");
    expect(withRate[0].x).toBe(1);
    expect(set(withRate, { ...change, stat_rate: null })[0]).not.toHaveProperty("stat_rate");
    expect(set(withRate, { ...change, power_config: { stat_rate: "sensor.pv_w" } })).toEqual(withRate);
  });

  it("picks the grid or the home meter by role when they share a statistic", () => {
    const sources = [
      { type: "home", stat_energy_to: "sensor.main" },
      { type: "grid", stat_energy_from: "sensor.main", stat_energy_to: null },
    ];
    const grid = set(sources, { stat: "sensor.main", role: "import", power_config: { stat_rate: "sensor.g" } });
    expect(grid[0]).not.toHaveProperty("stat_rate");
    expect(grid[1].power_config).toEqual({ stat_rate: "sensor.g" });
    const home = set(sources, { stat: "sensor.main", role: "home", stat_rate: "sensor.h" });
    expect(home[0].stat_rate).toBe("sensor.h");
    expect(home[1]).not.toHaveProperty("power_config");
  });

  it.each([
    [{ stat_rate: "sensor.w" }],
    [{ power_config: {} }],
    [{ power_config: { stat_rate: "a", stat_rate_inverted: "b" } }],
    [{ power_config: { stat_rate_from: "a" } }],
    [{ power_config: { stat_rate: "" } }],
    [{ power_config: { other: "a" } }],
  ])("skips an invalid grid change %j", (extra) => {
    const sources = [{ type: "grid", stat_energy_from: "sensor.imp", stat_energy_to: null }];
    expect(set(sources, { stat: "sensor.imp", role: "import", ...extra })).toEqual(sources);
  });

  it("skips an unknown source or role", () => {
    const sources = [{ type: "grid", stat_energy_from: "sensor.imp", stat_energy_to: null }];
    expect(set(sources, { stat: "sensor.gone", role: "import", power_config: null })).toEqual(sources);
    expect(set(sources, { stat: "sensor.imp", role: "export", power_config: null })).toEqual(sources);
  });

  it("is a source change, not a device change", () => {
    expect(changeKind({ type: "set_source_rate", stat: "x", role: "import" })).toBeNull();
  });
});

describe("sourcePower", () => {
  const hass = {
    states: {
      "sensor.a": { entity_id: "x", state: "500", attributes: { unit_of_measurement: "W" } },
      "sensor.from": { entity_id: "x", state: "300", attributes: { unit_of_measurement: "W" } },
      "sensor.to": { entity_id: "x", state: "100", attributes: { unit_of_measurement: "W" } },
      "sensor.zero": { entity_id: "x", state: "0", attributes: { unit_of_measurement: "W" } },
      "sensor.na": { entity_id: "x", state: "unavailable", attributes: {} },
      "sensor.derived": { entity_id: "x", state: "42", attributes: { unit_of_measurement: "W" } },
    },
  } as unknown as HomeAssistant;

  it("reads stat_rate, or the config's single sensor", () => {
    expect(sourcePower(hass, { stat_rate: "sensor.a" })).toBe(500);
    expect(sourcePower(hass, { power_config: { stat_rate: "sensor.a" } })).toBe(500);
    expect(sourcePower(hass, {})).toBeNull();
  });

  it("negates an inverted sensor", () => {
    expect(sourcePower(hass, { power_config: { stat_rate_inverted: "sensor.a" } })).toBe(-500);
    expect(Object.is(sourcePower(hass, { power_config: { stat_rate_inverted: "sensor.zero" } }), 0)).toBe(true);
    expect(sourcePower(hass, { power_config: { stat_rate_inverted: "sensor.na" } })).toBeNull();
  });

  it("subtracts the to sensor from the from sensor", () => {
    expect(sourcePower(hass, { power_config: { stat_rate_from: "sensor.from", stat_rate_to: "sensor.to" } })).toBe(200);
    expect(sourcePower(hass, { power_config: { stat_rate_from: "sensor.from", stat_rate_to: "sensor.na" } })).toBeNull();
  });

  it("prefers the derived stat_rate", () => {
    expect(
      sourcePower(hass, { stat_rate: "sensor.derived", power_config: { stat_rate_inverted: "sensor.a" } }),
    ).toBe(42);
  });

  it("feeds sourceNow with the computed value", () => {
    const source = { power_config: { stat_rate_inverted: "sensor.a" } };
    expect(sourceNow(hass, source, "import")).toBe(0);
    expect(sourceNow(hass, source, "export")).toBe(500);
  });
});
