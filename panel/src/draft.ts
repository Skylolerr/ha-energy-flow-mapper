// Pure draft logic of the panel. It mirrors hierarchy.py so the tree can be
// shown and edited before anything is sent; the backend checks again on save.

import type { Change, Device, HomeAssistant, Source, StatInfo } from "./types";

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
  | "consumption";

export interface SourceRow {
  type: string;
  role: SourceRole;
  stat: string;
  name?: string;
}

function setOptional(device: Device, key: string, value: unknown): void {
  const text = typeof value === "string" ? value.trim() : value;
  if (text) {
    device[key] = text;
  } else {
    delete device[key];
  }
}

/** Apply changes in order to a copy; changes that do not fit are skipped. */
export function applyChanges(devices: Device[], changes: Change[]): Device[] {
  const result: Device[] = structuredClone(devices);
  for (const change of changes) {
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
    } else {
      const [removed] = result.splice(index, 1);
      for (const other of result) {
        if (other.included_in_stat === change.stat) {
          setOptional(other, "included_in_stat", removed.included_in_stat);
        }
      }
    }
  }
  return result;
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

/** Devices `stat` can be moved under, in configuration order. */
export function moveTargets(devices: Device[], stat: string): string[] {
  return devices
    .map((d) => d.stat_consumption)
    .filter((target) => canMove(devices, stat, target));
}

/** Display name: own name, then the entity's name, then the statistic ID. */
export function displayName(
  stat: string,
  devices: Device[],
  stats: Record<string, StatInfo | undefined>,
): string {
  const device = devices.find((d) => d.stat_consumption === stat);
  return device?.name || stats[stat]?.name || stat;
}

const POWER_FACTORS: Record<string, number> = { mW: 0.001, W: 1, kW: 1000, MW: 1e6 };

/** Current power of an entity in W, or null if unknown. */
export function powerInWatts(hass: HomeAssistant, entityId: string | undefined): number | null {
  const state = entityId ? hass.states[entityId] : undefined;
  if (state === undefined) {
    return null;
  }
  const value = Number.parseFloat(state.state);
  const factor = POWER_FACTORS[state.attributes.unit_of_measurement ?? "W"];
  if (!Number.isFinite(value) || factor === undefined) {
    return null;
  }
  return value * factor;
}

/** Own value minus children for each node with children (null if unknown). */
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
    const children = node.children.map((child) => values.get(child.stat) ?? null);
    result.set(
      node.stat,
      own === null || children.some((v) => v === null)
        ? null
        : own - children.reduce<number>((sum, v) => sum + (v ?? 0), 0),
    );
  }
  return result;
}

const SOURCE_ROLES: Record<string, [SourceRole, SourceRole | null]> = {
  grid: ["import", "export"],
  solar: ["production", null],
  battery: ["discharge", "charge"],
  gas: ["consumption", null],
  water: ["consumption", null],
};

/** One row per energy statistic of the sources. */
export function sourceRows(sources: Source[]): SourceRow[] {
  const rows: SourceRow[] = [];
  for (const source of sources) {
    const [from, to] = SOURCE_ROLES[source.type] ?? ["consumption", null];
    if (source.stat_energy_from) {
      rows.push({ type: source.type, role: from, stat: source.stat_energy_from, name: source.name });
    }
    if (to !== null && source.stat_energy_to) {
      rows.push({ type: source.type, role: to, stat: source.stat_energy_to, name: source.name });
    }
  }
  return rows;
}
