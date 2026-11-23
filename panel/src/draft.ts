// Pure draft logic of the panel. It mirrors hierarchy.py so the tree can be
// shown and edited before anything is sent; the backend checks again on save.

import type {
  Change,
  ChildPair,
  Device,
  DeviceKind,
  HomeAssistant,
  PowerConfig,
  Source,
  StatInfo,
  Tab,
  UnassignRole,
} from "./types";

/** A grid connection without costs, as the energy settings page creates it. */
export const NEW_GRID: Source = {
  type: "grid",
  stat_energy_from: null,
  stat_energy_to: null,
  stat_cost: null,
  entity_energy_price: null,
  number_energy_price: null,
  stat_compensation: null,
  entity_energy_price_export: null,
  number_energy_price_export: null,
  cost_adjustment_day: 0,
};

/** A water meter without costs, as the energy settings page creates it. */
export const NEW_WATER: Source = {
  type: "water",
  stat_energy_from: null,
  stat_cost: null,
  entity_energy_price: null,
  number_energy_price: null,
};

export interface TreeNode {
  stat: string;
  device: Device;
  children: TreeNode[];
  /** Set when the device is shown at the top because of a broken parent. */
  problem: "cycle" | "missing_parent" | null;
}

export type SourceRole =
  | "import"
  | "export"
  | "production"
  | "discharge"
  | "charge"
  | "gas"
  | "water"
  | "home"
  | "consumption";

export interface SourceRow {
  type: string;
  role: SourceRole;
  stat: string;
  name?: string;
  /** Home Assistant's power sensor of the source (signed for grid and battery). */
  stat_rate?: string;
  /** The grid or battery's `power_config`, when it has one. */
  power_config?: PowerConfig;
}

function setOptional(device: Device, key: string, value: unknown): void {
  const text = typeof value === "string" ? value.trim() : value;
  if (text) {
    device[key] = text;
  } else {
    delete device[key];
  }
}

type Of<T extends Change["type"]> = Extract<Change, { type: T }>;

const GROUP_CHANGE_TYPES: ReadonlySet<string> = new Set([
  "create_group",
  "rename_group",
  "set_group",
  "dissolve_group",
  "move_group",
]);

type SourceChange = Of<"assign_source"> | Of<"unassign_source"> | Of<"set_source_rate">;

/** Whether a change edits the sources rather than the devices. */
export function isSourceChange(change: Change): change is SourceChange {
  return (
    change.type === "assign_source" || change.type === "unassign_source" || change.type === "set_source_rate"
  );
}

/** The device list a change belongs to, or null for a source change. */
export function changeKind(change: Change): DeviceKind | null {
  if (isSourceChange(change)) {
    return null;
  }
  return change.type === "use_as_home_meter" ? "electricity" : (change.kind ?? "electricity");
}

/**
 * Apply the device changes of one list (`kind`) in order to a copy; changes
 * that do not fit are skipped. `sources` are the sources before the changes:
 * `use_as_home_meter` is skipped while there is a home meter (`home_exists`
 * in hierarchy.py), counting one assigned or removed earlier in `changes`.
 */
export function applyChanges(
  devices: Device[],
  changes: Change[],
  kind: DeviceKind = "electricity",
  sources: Source[] = [],
): Device[] {
  return applyDraft(devices, sources, changes, kind).devices;
}

/**
 * Apply the changes in order to copies of the devices of one list (`kind`)
 * and of the sources, so each change sees both as they are at that point:
 * a home meter made from a device takes the device's power sensor and name
 * as the draft has them, and only while there is no home meter.
 */
export function applyDraft(
  devices: Device[],
  sources: Source[],
  changes: Change[],
  kind: DeviceKind = "electricity",
): { devices: Device[]; sources: Source[] } {
  const result: Device[] = structuredClone(devices);
  const current: Source[] = structuredClone(sources);
  for (const change of changes) {
    if (isSourceChange(change)) {
      applySourceChange(current, change);
      continue;
    }
    // Group changes do not touch the devices; groups.ts applies them.
    if (changeKind(change) !== kind || GROUP_CHANGE_TYPES.has(change.type)) {
      continue;
    }
    if (!("stat" in change)) {
      continue;
    }
    const index = result.findIndex((d) => d.stat_consumption === change.stat);
    if (change.type === "add") {
      if (index !== -1) {
        continue;
      }
      const device: Device = { stat_consumption: change.stat };
      setOptional(device, "stat_rate", change.stat_rate);
      setOptional(device, "name", change.name);
      setOptional(device, "included_in_stat", change.parent);
      result.push(device);
      continue;
    }
    if (index === -1) {
      continue;
    }
    if (change.type === "move") {
      setOptional(result[index], "included_in_stat", change.parent);
    } else if (change.type === "rename") {
      setOptional(result[index], "name", change.name);
    } else if (change.type === "set_rate") {
      setOptional(result[index], "stat_rate", change.stat_rate);
    } else if (change.type === "remove" || change.type === "use_as_home_meter") {
      if (change.type === "use_as_home_meter") {
        if (current.some((s) => s.type === "home")) {
          continue;
        }
        const device = result[index];
        current.push({
          type: "home",
          stat_energy_to: change.stat,
          ...(device.stat_rate ? { stat_rate: device.stat_rate } : {}),
          ...(device.name ? { name: device.name } : {}),
        });
      }
      const [removed] = result.splice(index, 1);
      // Like hierarchy.py: a missing parent (an old error) or the child itself
      // (an old loop) is not inherited; the child goes to the top level.
      const present = new Set(result.map((d) => d.stat_consumption));
      for (const other of result) {
        if (other.included_in_stat === change.stat) {
          const parent = removed.included_in_stat;
          const keep = parent !== undefined && present.has(parent) && parent !== other.stat_consumption;
          setOptional(other, "included_in_stat", keep ? parent : undefined);
        }
      }
    }
  }
  return { devices: result, sources: current };
}

function parentMap(devices: Device[]): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  for (const device of devices) {
    if (!parents.has(device.stat_consumption)) {
      parents.set(device.stat_consumption, device.included_in_stat ?? null);
    }
  }
  return parents;
}

function cycleMembers(parents: Map<string, string | null>): Set<string> {
  const members = new Set<string>();
  const visited = new Set<string>();
  for (const start of parents.keys()) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let node: string | null = start;
    while (node !== null && parents.has(node) && !visited.has(node)) {
      const seen = position.get(node);
      if (seen !== undefined) {
        path.slice(seen).forEach((stat) => members.add(stat));
        break;
      }
      position.set(node, path.length);
      path.push(node);
      node = parents.get(node) ?? null;
    }
    path.forEach((stat) => visited.add(stat));
  }
  return members;
}

/** Top-level nodes in configuration order. */
export function buildTree(devices: Device[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  for (const device of devices) {
    if (!nodes.has(device.stat_consumption)) {
      nodes.set(device.stat_consumption, {
        stat: device.stat_consumption,
        device,
        children: [],
        problem: null,
      });
    }
  }
  const parents = parentMap(devices);
  const cycles = cycleMembers(parents);
  const roots: TreeNode[] = [];
  for (const [stat, node] of nodes) {
    const parent = parents.get(stat) ?? null;
    if (cycles.has(stat)) {
      node.problem = "cycle";
      roots.push(node);
    } else if (parent === null) {
      roots.push(node);
    } else if (!nodes.has(parent)) {
      node.problem = "missing_parent";
      roots.push(node);
    } else {
      nodes.get(parent)!.children.push(node);
    }
  }
  return roots;
}

/**
 * The changes that put `newStat` in the place of the device `oldStat` of one
 * list (`opts.kind`), in this order: add the new meter at the old one's
 * parent, with the old one's name only if the user set one and `newRate` as
 * its power sensor (the old meter's is never copied); put it into the old
 * one's group (`groupOf`, when set); move each child of the old meter to the
 * new one; remove the old one. Nothing for an unknown device or the same meter.
 */
export function replaceChanges(
  devices: Device[],
  groupOf: string | null,
  oldStat: string,
  newStat: string,
  opts: { kind: DeviceKind; newRate?: string | null },
): Change[] {
  const old = devices.find((d) => d.stat_consumption === oldStat);
  if (old === undefined || oldStat === newStat) {
    return [];
  }
  const kind = opts.kind === "water" ? { kind: "water" as const } : {};
  const children = devices
    .filter((d) => d.included_in_stat === oldStat && d.stat_consumption !== oldStat)
    .map((d) => d.stat_consumption);
  return [
    {
      type: "add",
      stat: newStat,
      parent: old.included_in_stat ?? null,
      ...(old.name ? { name: old.name } : {}),
      ...(opts.newRate ? { stat_rate: opts.newRate } : {}),
      ...kind,
    },
    ...(groupOf !== null ? [{ type: "set_group" as const, stat: newStat, group: groupOf, ...kind }] : []),
    ...children.map((stat) => ({ type: "move" as const, stat, parent: newStat, ...kind })),
    { type: "remove", stat: oldStat, ...kind },
  ];
}

/** All nodes depth-first. */
export function walk(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...walk(node.children)]);
}

/** A device and everything below it. */
export function subtree(devices: Device[], stat: string): Set<string> {
  const found = new Set<string>([stat]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const device of devices) {
      const parent = device.included_in_stat;
      if (parent && found.has(parent) && !found.has(device.stat_consumption)) {
        found.add(device.stat_consumption);
        grew = true;
      }
    }
  }
  return found;
}

/**
 * Can `stat` be put under `target` (null: top level)? A device cannot go
 * under itself or one of its own children, and a no-op is not offered.
 */
export function canMove(devices: Device[], stat: string, target: string | null): boolean {
  const device = devices.find((d) => d.stat_consumption === stat);
  if (device === undefined) {
    return false;
  }
  if ((device.included_in_stat ?? null) === target) {
    return false;
  }
  return target === null || !subtree(devices, stat).has(target);
}

/**
 * The child device suggestions that still apply to a draft: same list, not
 * ignored, both devices present, not already below the parent (also through
 * another device), and a move that is allowed (no cycle).
 */
export function suggestionsFor(
  devices: Device[],
  pairs: ChildPair[],
  ignored: ChildPair[],
  kind: DeviceKind,
): ChildPair[] {
  const known = new Set(devices.map((d) => d.stat_consumption));
  const isIgnored = (p: ChildPair) =>
    ignored.some((i) => i.kind === p.kind && i.stat === p.stat && i.parent === p.parent);
  return pairs.filter(
    (p) =>
      p.kind === kind &&
      !isIgnored(p) &&
      known.has(p.stat) &&
      known.has(p.parent) &&
      !subtree(devices, p.parent).has(p.stat) &&
      canMove(devices, p.stat, p.parent),
  );
}

/** Devices `stat` can be moved under, in configuration order. */
export function moveTargets(devices: Device[], stat: string): string[] {
  return devices
    .map((d) => d.stat_consumption)
    .filter((target) => canMove(devices, stat, target));
}

/**
 * Display name: own name, then the energy name (with the entity part where
 * `ambiguous` says devices share a name), then the statistic's name or ID.
 */
export function displayName(
  stat: string,
  devices: Device[],
  stats: Record<string, StatInfo | undefined>,
  ambiguous: ReadonlySet<string> = new Set(),
): string {
  const device = devices.find((d) => d.stat_consumption === stat);
  const info = stats[stat];
  return (
    device?.name ||
    (ambiguous.has(stat) ? info?.energy_entity_name : null) ||
    info?.energy_name ||
    info?.name ||
    stat
  );
}

/**
 * The devices of one list whose name another device of the list shares, like
 * hierarchy.py's `ambiguous_devices`: they get the entity part, as Home
 * Assistant's energy dashboard does from 2026.11.2. Only device names take
 * part (a statistic with an `energy_entity_name`); an own name counts but
 * never gives way.
 */
export function ambiguousDevices(devices: Device[], stats: Record<string, StatInfo | undefined>): Set<string> {
  const byLabel = new Map<string, Set<string>>();
  const named = new Set<string>();
  for (const device of devices) {
    const stat = device.stat_consumption;
    const info = stats[stat];
    const label = device.name || (info?.energy_entity_name ? info.energy_name : null);
    if (!label) {
      continue;
    }
    if (device.name) {
      named.add(stat);
    }
    const group = byLabel.get(label) ?? new Set<string>();
    group.add(stat);
    byLabel.set(label, group);
  }
  const result = new Set<string>();
  for (const group of byLabel.values()) {
    if (group.size > 1) {
      for (const stat of group) {
        if (!named.has(stat)) {
          result.add(stat);
        }
      }
    }
  }
  return result;
}

const POWER_FACTORS: Record<string, number> = { mW: 0.001, W: 1, kW: 1000, MW: 1e6, GW: 1e9, TW: 1e12 };

const GALLON = 3.785411784;
/** Flow units of Home Assistant, in L/min. */
const FLOW_FACTORS: Record<string, number> = {
  "mL/s": 0.06,
  "L/s": 60,
  "L/min": 1,
  "L/h": 1 / 60,
  "m³/s": 60000,
  "m³/min": 1000,
  "m³/h": 1000 / 60,
  "ft³/min": 28.316846592,
  "gal/min": GALLON,
  "gal/h": GALLON / 60,
  "gal/d": GALLON / 1440,
};

function stateValue(
  hass: HomeAssistant,
  entityId: string | undefined,
  factors: Record<string, number>,
  unit: string,
): number | null {
  const state = entityId ? hass.states[entityId] : undefined;
  if (state === undefined) {
    return null;
  }
  const value = Number.parseFloat(state.state);
  const factor = factors[state.attributes.unit_of_measurement ?? unit];
  if (!Number.isFinite(value) || factor === undefined) {
    return null;
  }
  return value * factor;
}

/** Current power of an entity in W, or null if unknown. */
export function powerInWatts(hass: HomeAssistant, entityId: string | undefined): number | null {
  return stateValue(hass, entityId, POWER_FACTORS, "W");
}

/** Current flow of an entity in L/min, or null if unknown. */
export function flowInLitresPerMinute(
  hass: HomeAssistant,
  entityId: string | undefined,
): number | null {
  return stateValue(hass, entityId, FLOW_FACTORS, "L/min");
}

/** Power in W (electricity) or flow in L/min (water) of a rate sensor. */
export function rateValue(
  hass: HomeAssistant,
  entityId: string | undefined,
  kind: DeviceKind,
): number | null {
  return kind === "water" ? flowInLitresPerMinute(hass, entityId) : powerInWatts(hass, entityId);
}

/** What `sourcePower` needs of a source: its derived sensor and its `power_config`. */
export interface PowerSource {
  stat_rate?: unknown;
  power_config?: PowerConfig | null;
}

function sensorText(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * The signed power of a source: its `stat_rate` (the sensor HA derives from
 * `power_config`), or, before HA has created that sensor, computed from the
 * config: minus the inverted sensor, or the from sensor minus the to sensor.
 * Null while a needed value is unknown.
 */
export function sourcePower(
  hass: HomeAssistant,
  source: PowerSource,
  kind: DeviceKind = "electricity",
): number | null {
  const rate = sensorText(source.stat_rate);
  if (rate !== undefined) {
    return rateValue(hass, rate, kind);
  }
  const config = (source.power_config ?? {}) as Record<string, unknown>;
  const single = sensorText(config.stat_rate);
  if (single !== undefined) {
    return rateValue(hass, single, kind);
  }
  const inverted = sensorText(config.stat_rate_inverted);
  if (inverted !== undefined) {
    const value = rateValue(hass, inverted, kind);
    return value === null || value === 0 ? value : -value;
  }
  const from = rateValue(hass, sensorText(config.stat_rate_from), kind);
  const to = rateValue(hass, sensorText(config.stat_rate_to), kind);
  return from === null || to === null ? null : from - to;
}

/**
 * The power now of one role of a source, from Home Assistant's power sensor of
 * that source (`stat_rate`, or computed from its `power_config`). For grid and battery it is signed: positive from
 * the grid or discharging, negative to the grid or charging; each role shows
 * its direction (0 while the flow goes the other way); solar never goes
 * below 0. Water is a flow in
 * L/min; gas and unknown roles have no power here.
 */
export function sourceNow(
  hass: HomeAssistant,
  source: PowerSource | undefined,
  role: SourceRole,
): number | null {
  const value = source ? sourcePower(hass, source, role === "water" ? "water" : "electricity") : null;
  if (value === null) {
    return null;
  }
  switch (role) {
    case "import":
    case "discharge":
      return Math.max(value, 0);
    case "export":
    case "charge":
      return Math.max(-value, 0);
    case "production":
      // An inverter's standby draw at night is no production.
      return Math.max(value, 0);
    case "home":
    case "water":
      // A sensor reporting "-0" shows 0.
      return value === 0 ? 0 : value;
    default:
      return null;
  }
}

/** Own value minus children for each node with children (null without an own value). */
export function untracked(
  nodes: TreeNode[],
  values: Map<string, number | null>,
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const node of walk(nodes)) {
    if (node.children.length === 0) {
      continue;
    }
    const own = values.get(node.stat) ?? null;
    // A child without a value measures nothing: its share is untracked.
    result.set(
      node.stat,
      own === null ? null : own - node.children.reduce<number>((sum, c) => sum + (values.get(c.stat) ?? 0), 0),
    );
  }
  return result;
}

/**
 * The children without a value of each device that has a value; only devices
 * with such children. Their untracked value includes what these children use.
 */
export function untrackedMissing(nodes: TreeNode[], values: Map<string, number | null>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const node of walk(nodes)) {
    if ((values.get(node.stat) ?? null) === null) {
      continue;
    }
    const missing = node.children.filter((c) => (values.get(c.stat) ?? null) === null).map((c) => c.stat);
    if (missing.length) {
      result.set(node.stat, missing);
    }
  }
  return result;
}

/** What the home uses minus all top-level devices; one without a value counts as untracked. */
export function homeUntracked(roots: TreeNode[], values: Map<string, number | null>, home: number | null): number | null {
  return home === null ? null : home - roots.reduce<number>((sum, n) => sum + (values.get(n.stat) ?? 0), 0);
}

const SOURCE_ROLES: Record<string, [SourceRole, SourceRole | null]> = {
  grid: ["import", "export"],
  solar: ["production", null],
  battery: ["discharge", "charge"],
  gas: ["gas", null],
  water: ["water", null],
  // The home meter (HA 2026.11 and newer) only has `stat_energy_to`.
  home: ["home", "home"],
};

/** The tab a source is shown in: water and gas on their own, everything else with electricity. */
export function sourceKind(source: Source): Tab {
  return source.type === "water" || source.type === "gas" ? source.type : "electricity";
}

const POWER_CONFIG_KEYS = ["stat_rate", "stat_rate_inverted", "stat_rate_from", "stat_rate_to"] as const;

/** Power sensors of a source: `stat_rate`, then those of `power_config`. */
export function powerStats(source: Source): string[] {
  const config = source.power_config as Record<string, unknown> | null | undefined;
  const values: unknown[] = [source.stat_rate, ...POWER_CONFIG_KEYS.map((key) => config?.[key])];
  return values.filter((value): value is string => typeof value === "string");
}

/** One row per energy statistic of the sources (of one tab, if `kind` is given). */
export function sourceRows(sources: Source[], kind?: Tab): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const source of sources) {
    if (kind !== undefined && sourceKind(source) !== kind) {
      continue;
    }
    const [from, to] = SOURCE_ROLES[source.type] ?? ["consumption", null];
    const config = parsePowerConfig(source.power_config);
    const rate = {
      ...(typeof source.stat_rate === "string" ? { stat_rate: source.stat_rate } : {}),
      ...(config === null ? {} : { power_config: config }),
    };
    if (source.stat_energy_from) {
      rows.push({ type: source.type, role: from, stat: source.stat_energy_from, name: source.name, ...rate });
    }
    if (to !== null && source.stat_energy_to) {
      rows.push({ type: source.type, role: to, stat: source.stat_energy_to, name: source.name, ...rate });
    }
  }
  return rows;
}

const ENERGY_KEYS = ["stat_energy_from", "stat_energy_to"] as const;

/** Source types the panel may change. */
const EDITABLE_SOURCE_TYPES = ["grid", "solar", "battery", "gas", "water", "home"];

/** A grid connection stays while one of these is set. */
const GRID_KEEPS = ["stat_energy_from", "stat_energy_to", "stat_rate", "power_config"] as const;

/** Whether `key` of an editable source has `role`; without a role every key has. */
function hasRole(source: Source, key: (typeof ENERGY_KEYS)[number], role: UnassignRole | undefined): boolean {
  if (role === undefined) {
    return true;
  }
  if (source.type === "home") {
    return role === "home";
  }
  const [from, to] = SOURCE_ROLES[source.type] ?? [null, null];
  return (key === "stat_energy_from" ? from : to) === role;
}

/** An empty value as Python sees it: nothing, "", 0, or an empty object or list. */
function isEmpty(value: unknown): boolean {
  return !value || (typeof value === "object" && Object.keys(value).length === 0);
}

const POWER_CONFIG_SHAPES: readonly (readonly string[])[] = [
  ["stat_rate"],
  ["stat_rate_inverted"],
  ["stat_rate_from", "stat_rate_to"],
];

/** Whether `config` is one of HA's power_config shapes, with a sensor in each key. */
function validPowerConfig(config: unknown): config is PowerConfig {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return false;
  }
  const keys = Object.keys(config);
  return (
    POWER_CONFIG_SHAPES.some((shape) => shape.length === keys.length && shape.every((k) => keys.includes(k))) &&
    Object.values(config).every((value) => typeof value === "string" && value !== "")
  );
}

/** `raw` as a `PowerConfig` if it is one of HA's shapes with a sensor in each key, else null. */
export function parsePowerConfig(raw: unknown): PowerConfig | null {
  return validPowerConfig(raw) ? ({ ...raw } as PowerConfig) : null;
}

/** The device list a tab shows: water has its own, electricity is the default, gas has none. */
export function tabKind(tab: Tab): DeviceKind {
  return tab === "water" ? "water" : "electricity";
}

/**
 * Set or clear the power sensor of the source holding `stat` as `role`, like
 * hierarchy.py: grid and battery take `power_config` and lose `stat_rate`
 * (HA derives it); the other sources take `stat_rate`. Changes that do not
 * fit are skipped.
 */
function setSourceRate(result: Source[], change: Of<"set_source_rate">): void {
  const source = result.find(
    (s) =>
      EDITABLE_SOURCE_TYPES.includes(s.type) &&
      ENERGY_KEYS.some((key) => s[key] === change.stat && hasRole(s, key, change.role)),
  );
  if (source === undefined) {
    return;
  }
  const config = change.power_config ?? null;
  if (source.type === "grid" || source.type === "battery") {
    if (change.stat_rate || (config !== null && !validPowerConfig(config))) {
      return;
    }
    delete source.stat_rate;
    if (config === null) {
      delete source.power_config;
    } else {
      source.power_config = structuredClone(config);
    }
    return;
  }
  if (config !== null) {
    return;
  }
  const rate = change.stat_rate?.trim();
  if (rate) {
    source.stat_rate = rate;
  } else {
    delete source.stat_rate;
  }
}

/**
 * Apply one change of the sources (in place), like hierarchy.py: grid
 * import/export replace the meter given as `replace`, or else that of the
 * first grid connection (keeping its prices); a water or gas meter replaces
 * the one of its type given as `replace`, or else is added; solar and battery
 * add a source; the home meter replaces the one there is. Removing takes the
 * source of `role`, or without one prefers a source other than the home
 * meter; a grid connection loses each key holding the statistic and goes when
 * nothing is left. Changes that do not fit are skipped.
 */
function applySourceChange(result: Source[], change: SourceChange): void {
  if (change.type === "set_source_rate") {
    setSourceRate(result, change);
    return;
  }
  if (change.type === "assign_source") {
    if (change.role === "home") {
      const home = result.find((s) => s.type === "home");
      if (home) {
        home.stat_energy_to = change.stat;
      } else {
        result.push({ type: "home", stat_energy_to: change.stat });
      }
    } else if (change.role === "import" || change.role === "export") {
      const key = change.role === "import" ? "stat_energy_from" : "stat_energy_to";
      const grids = result.filter((s) => s.type === "grid");
      let grid = change.replace ? grids.find((s) => s[key] === change.replace) : grids[0];
      if (grid === undefined) {
        if (change.replace) {
          return;
        }
        grid = structuredClone(NEW_GRID);
        result.push(grid);
      }
      grid[key] = change.stat;
    } else if (change.role === "production") {
      result.push({
        type: "solar",
        stat_energy_from: change.stat,
        config_entry_solar_forecast: null,
      });
    } else if (change.role === "battery" && change.stat_to) {
      result.push({ type: "battery", stat_energy_from: change.stat, stat_energy_to: change.stat_to });
    } else if (change.role === "water" || change.role === "gas") {
      const type = change.role;
      let meter = change.replace
        ? result.find((s) => s.type === type && s.stat_energy_from === change.replace)
        : undefined;
      if (meter === undefined) {
        if (change.replace) {
          return;
        }
        meter = { ...structuredClone(NEW_WATER), type };
        result.push(meter);
      }
      meter.stat_energy_from = change.stat;
    }
    return;
  }
  const matches = result
    .map((source, index) => ({
      index,
      keys: EDITABLE_SOURCE_TYPES.includes(source.type)
        ? ENERGY_KEYS.filter((key) => source[key] === change.stat && hasRole(source, key, change.role))
        : [],
    }))
    .filter((m) => m.keys.length > 0);
  const match = matches.find((m) => result[m.index].type !== "home") ?? matches[0];
  if (match === undefined) {
    return;
  }
  const source = result[match.index];
  if (source.type !== "grid") {
    result.splice(match.index, 1);
    return;
  }
  for (const key of match.keys) {
    source[key] = null;
  }
  if (GRID_KEEPS.every((key) => isEmpty(source[key]))) {
    result.splice(match.index, 1);
  }
}

/**
 * Apply the source changes of a draft to a copy (see `applySourceChange`).
 * A device used as home meter brings its power sensor and name as the draft
 * has them at that point, starting from the electricity devices `devices`;
 * it is skipped for an unknown device or while there is a home meter, as
 * hierarchy.py refuses it.
 */
export function applySourceChanges(sources: Source[], changes: Change[], devices: Device[] = []): Source[] {
  return applyDraft(devices, sources, changes, "electricity").sources;
}

/** Power of the whole home now in W, from the home meter's power sensor. */
export function homeNow(hass: HomeAssistant, sources: Source[]): number | null {
  const rate = sources.find((s) => s.type === "home")?.stat_rate;
  return typeof rate === "string" ? powerInWatts(hass, rate) : null;
}

/**
 * How much of the home the top-level devices cover (1 = all of it); a device
 * without a value covers nothing, as in the untracked value. Null without a
 * positive home value, or when a top-level device has a negative value (a meter
 * that went backwards gives no meaningful share).
 */
export function coverage(home: number | null, tops: (number | null)[]): number | null {
  if (home === null || home <= 0 || tops.some((v) => v !== null && v < 0)) {
    return null;
  }
  return tops.reduce<number>((sum, v) => sum + (v ?? 0), 0) / home;
}
