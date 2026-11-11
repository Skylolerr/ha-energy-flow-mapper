// Pure group logic of the panel. It mirrors groups.py so groups can be shown and
// edited before anything is sent; the backend checks again on save. Like
// `applyChanges` in draft.ts it skips changes that do not fit instead of throwing.

import { applyChanges, changeKind, type TreeNode } from "./draft";
import type { Change, Device, DeviceKind, Group, StatInfo } from "./types";

/** Prefix of the ids of group blocks (selection, layout), as in `group:<id>`. */
export const GROUP_PREFIX = "group:";

/** The id of the block of a group. */
export function groupBlockId(id: string): string {
  return `${GROUP_PREFIX}${id}`;
}

/**
 * A new group id: a uuid4 as 32 lowercase hex characters. `crypto.randomUUID`
 * only exists in secure contexts (not on plain http), so build it from
 * `getRandomValues`, which works everywhere.
 */
export function newGroupId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const GROUP_CHANGE_TYPES: ReadonlySet<string> = new Set([
  "create_group",
  "rename_group",
  "set_group",
  "dissolve_group",
  "move_group",
]);

/** A change that does not fit; the caller skips it (groups.py raises `ChangeError`). */
class Skip extends Error {}

function parentMap(devices: Device[]): Map<string, string | null> {
  const parents = new Map<string, string | null>();
  for (const device of devices) {
    if (!parents.has(device.stat_consumption)) {
      parents.set(device.stat_consumption, device.included_in_stat ?? null);
    }
  }
  return parents;
}

/** The devices of a group and of its nested groups, in order. */
export function groupDevices(groups: Group[], id: string): string[] {
  const devices: string[] = [];
  const visited = new Set<string>();
  const collect = (current: string): void => {
    if (visited.has(current)) {
      return;
    }
    visited.add(current);
    for (const group of groups) {
      if (group.id === current) {
        devices.push(...group.members);
      }
    }
    for (const group of groups) {
      if (group.group === current) {
        collect(group.id);
      }
    }
  };
  collect(id);
  return devices;
}

function enclosingLoops(groups: Group[], group: Group): boolean {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const seen = new Set<string>();
  let current = group.group;
  while (current !== null && byId.has(current) && !seen.has(current)) {
    if (current === group.id) {
      return true;
    }
    seen.add(current);
    current = byId.get(current)!.group;
  }
  return false;
}

/**
 * The groups fitted to the current devices (the five steps of `clean_groups`):
 * drop vanished devices, adopt a new common parent, drop members with another
 * parent, move misfit nested groups to the top, remove empty groups. Never
 * mutates `groups`.
 */
export function cleanGroups(groups: Group[], devices: Device[]): Group[] {
  const kept = structuredClone(groups);
  const parents = parentMap(devices);

  // 1. Drop members whose device is gone; a device stays only in its first group.
  const seen = new Set<string>();
  for (const group of kept) {
    group.members = group.members.filter((stat) => {
      if (!parents.has(stat) || seen.has(stat)) {
        return false;
      }
      seen.add(stat);
      return true;
    });
  }

  // 2. A group whose devices all moved to one other parent adopts that parent.
  for (const group of kept) {
    const real = new Set(groupDevices(kept, group.id).map((stat) => parents.get(stat) ?? null));
    if (!real.has(group.parent) && real.size === 1) {
      group.parent = [...real][0];
    }
  }

  // 3. Drop members whose real parent differs from the group's parent.
  for (const group of kept) {
    group.members = group.members.filter((stat) => (parents.get(stat) ?? null) === group.parent);
  }

  // 4. A nested group with another parent than its enclosing group (or with an
  //    unknown or looping enclosing group) moves to the top level of its parent.
  const byId = new Map(kept.map((g) => [g.id, g]));
  for (const group of kept) {
    if (group.group === null) {
      continue;
    }
    const enclosing = byId.get(group.group);
    if (enclosing === undefined || enclosing.parent !== group.parent || enclosingLoops(kept, group)) {
      group.group = null;
    }
  }

  // 5. Groups without any device (recursively) disappear.
  return kept.filter((g) => groupDevices(kept, g.id).length > 0);
}

// --- Applying changes -------------------------------------------------------

function find(groups: Group[], id: string | null | undefined): Group {
  const group = groups.find((g) => g.id === id);
  if (group === undefined) {
    throw new Skip("unknown_group");
  }
  return group;
}

function nestedIds(groups: Group[], id: string): Set<string> {
  const found = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of groups) {
      if (group.group !== null && found.has(group.group) && !found.has(group.id)) {
        found.add(group.id);
        grew = true;
      }
    }
  }
  return found;
}

/** The trimmed name; it must be set and unique among the groups of its parent. */
function checkName(groups: Group[], name: string, parent: string | null, ownId: string | null): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Skip("group_name_empty");
  }
  if (groups.some((g) => g.name === trimmed && g.parent === parent && g.id !== ownId)) {
    throw new Skip("group_name_taken");
  }
  return trimmed;
}

function takeOut(groups: Group[], stat: string): void {
  for (const group of groups) {
    group.members = group.members.filter((m) => m !== stat);
  }
}

type Of<T extends Change["type"]> = Extract<Change, { type: T }>;

function createGroup(groups: Group[], parents: Map<string, string | null>, change: Of<"create_group">): void {
  const parent = change.parent ?? null;
  if (groups.some((g) => g.id === change.id)) {
    throw new Skip("group_exists");
  }
  const name = checkName(groups, change.name ?? "", parent, null);
  const members = [...change.members];
  for (const stat of members) {
    if (!parents.has(stat) || parents.get(stat) !== parent) {
      throw new Skip("unknown_device_or_parents_differ");
    }
  }
  const nested = (change.groups ?? []).map((id) => find(groups, id));
  for (const child of nested) {
    if (child.parent !== parent) {
      throw new Skip("group_parents_differ");
    }
  }
  const enclosingId = change.group ?? null;
  if (enclosingId !== null) {
    const enclosing = find(groups, enclosingId);
    if (enclosing.parent !== parent) {
      throw new Skip("group_parents_differ");
    }
    if (nested.some((child) => nestedIds(groups, child.id).has(enclosingId))) {
      throw new Skip("group_loop");
    }
  }
  for (const stat of members) {
    takeOut(groups, stat);
  }
  for (const child of nested) {
    child.group = change.id;
  }
  groups.push({ id: change.id, name, parent, group: enclosingId, members });
}

function setGroup(groups: Group[], parents: Map<string, string | null>, change: Of<"set_group">): void {
  const stat = change.stat ?? null;
  const groupId = change.group_id ?? null;
  if ((stat === null) === (groupId === null)) {
    throw new Skip("unknown_change");
  }
  const targetId = change.group ?? null;
  const target = targetId !== null ? find(groups, targetId) : null;
  if (stat !== null) {
    if (!parents.has(stat)) {
      throw new Skip("unknown_device");
    }
    if (target !== null && target.parent !== parents.get(stat)) {
      throw new Skip("group_parents_differ");
    }
    takeOut(groups, stat);
    target?.members.push(stat);
    return;
  }
  const group = find(groups, groupId);
  if (target !== null) {
    if (target.parent !== group.parent) {
      throw new Skip("group_parents_differ");
    }
    if (nestedIds(groups, group.id).has(target.id)) {
      throw new Skip("group_loop");
    }
  }
  group.group = targetId;
}

function dissolveGroup(groups: Group[], id: string): void {
  const group = find(groups, id);
  const enclosing = group.group;
  if (enclosing !== null) {
    find(groups, enclosing).members.push(...group.members);
  }
  for (const other of groups) {
    if (other.group === id) {
      other.group = enclosing;
    }
  }
  groups.splice(groups.indexOf(group), 1);
}

/** Move a group; returns the devices with all devices of the group moved. */
function moveGroup(
  devices: Device[],
  groups: Group[],
  kind: DeviceKind,
  change: Of<"move_group">,
): Device[] {
  const group = find(groups, change.id);
  const parent = change.parent ?? null;
  const members = groupDevices(groups, group.id);
  if (parent !== null) {
    if (members.includes(parent)) {
      throw new Skip("group_loop");
    }
    if (!devices.some((d) => d.stat_consumption === parent)) {
      throw new Skip("unknown_device");
    }
  }
  const enclosingId = change.group ?? null;
  const nested = nestedIds(groups, group.id);
  for (const other of groups) {
    if (nested.has(other.id)) {
      checkName(groups, other.name, parent, other.id);
    }
  }
  if (enclosingId !== null) {
    const enclosing = find(groups, enclosingId);
    if (nested.has(enclosingId)) {
      throw new Skip("group_loop");
    }
    if (enclosing.parent !== parent) {
      throw new Skip("group_parents_differ");
    }
  }
  const moves: Change[] = members.map((stat) => ({ type: "move", stat, parent, kind }));
  const result = applyChanges(devices, moves, kind);
  for (const other of groups) {
    if (nested.has(other.id)) {
      other.parent = parent;
    }
  }
  group.group = enclosingId;
  return result;
}

/** Apply one group change to `groups` (in place); returns the devices. */
function applyGroupChange(devices: Device[], groups: Group[], kind: DeviceKind, change: Change): Device[] {
  const parents = parentMap(devices);
  if (change.type === "create_group") {
    createGroup(groups, parents, change);
  } else if (change.type === "rename_group") {
    const group = find(groups, change.id);
    group.name = checkName(groups, change.name ?? "", group.parent, group.id);
  } else if (change.type === "set_group") {
    setGroup(groups, parents, change);
  } else if (change.type === "dissolve_group") {
    dissolveGroup(groups, change.id);
  } else if (change.type === "move_group") {
    return moveGroup(devices, groups, kind, change);
  }
  return devices;
}

/** Groups below a device that is about to disappear go to its former parent. */
function adoptRemovedParent(devices: Device[], groups: Group[], stat: string): void {
  const removed = devices.find((d) => d.stat_consumption === stat);
  if (removed === undefined) {
    return;
  }
  for (const group of groups) {
    if (group.parent === stat) {
      group.parent = removed.included_in_stat ?? null;
    }
  }
}

/** A device that moves to another parent than its group's leaves the group. */
function leaveGroupOnMove(groups: Group[], stat: string, parent: string | null): void {
  for (const group of groups) {
    if (group.members.includes(stat) && group.parent !== parent) {
      takeOut(groups, stat);
      return;
    }
  }
}

/**
 * Apply the changes of one list (`kind`) strictly in order to copies of the
 * devices and groups: device changes with `applyChanges`, group changes here.
 * After every change the groups are cleaned against the new devices; changes
 * that do not fit are skipped.
 */
export function applyAllChanges(
  devicesBefore: Device[],
  groupsBefore: Group[],
  changes: Change[],
  kind: DeviceKind,
): { devices: Device[]; groups: Group[] } {
  let devices: Device[] = structuredClone(devicesBefore);
  let groups: Group[] = structuredClone(groupsBefore);
  for (const change of changes) {
    if (changeKind(change) !== kind) {
      continue;
    }
    if (GROUP_CHANGE_TYPES.has(change.type)) {
      // Work on a copy so a refused change leaves nothing half done.
      const draft = structuredClone(groups);
      try {
        devices = applyGroupChange(devices, draft, kind, change);
      } catch (error) {
        if (error instanceof Skip) {
          continue;
        }
        throw error;
      }
      groups = draft;
    } else {
      if (change.type === "remove" || change.type === "use_as_home_meter") {
        adoptRemovedParent(devices, groups, change.stat);
      } else if (change.type === "move") {
        if (devices.some((d) => d.stat_consumption === change.stat)) {
          leaveGroupOnMove(groups, change.stat, change.parent);
        }
      }
      devices = applyChanges(devices, [change], kind);
    }
    groups = cleanGroups(groups, devices);
  }
  return { devices, groups };
}

/** Like `applyAllChanges`, but only the resulting groups. */
export function applyGroupChanges(
  devicesBefore: Device[],
  groups: Group[],
  changes: Change[],
  kind: DeviceKind,
): Group[] {
  return applyAllChanges(devicesBefore, groups, changes, kind).groups;
}

// --- Display ----------------------------------------------------------------

export type DisplayNode =
  | { type: "device"; node: TreeNode; children: DisplayNode[] }
  | { type: "group"; group: Group; children: DisplayNode[] };

/** One level of the tree: the siblings below `parentKey`, with their groups put in. */
function displayLevel(siblings: TreeNode[], parentKey: string | null, groups: Group[]): DisplayNode[] {
  const position = new Map(siblings.map((node, index) => [node.stat, index]));
  const own = groups.filter((g) => g.parent === parentKey);
  const ownIds = new Set(own.map((g) => g.id));
  const placed = new Set<string>();
  const building = new Set<string>();
  type Entry = { node: DisplayNode; order: number };

  const deviceEntry = (node: TreeNode): Entry => ({
    node: { type: "device", node, children: displayLevel(node.children, node.stat, groups) },
    order: position.get(node.stat)!,
  });

  const groupEntry = (group: Group): Entry | null => {
    if (building.has(group.id)) {
      return null;
    }
    building.add(group.id);
    const entries: Entry[] = [];
    for (const stat of group.members) {
      const index = position.get(stat);
      if (index !== undefined && !placed.has(stat)) {
        placed.add(stat);
        entries.push(deviceEntry(siblings[index]));
      }
    }
    for (const nested of own.filter((g) => g.group === group.id)) {
      const entry = groupEntry(nested);
      if (entry !== null) {
        entries.push(entry);
      }
    }
    building.delete(group.id);
    if (entries.length === 0) {
      return null;
    }
    entries.sort((a, b) => a.order - b.order);
    return {
      node: { type: "group", group, children: entries.map((e) => e.node) },
      order: entries[0].order,
    };
  };

  const entries: Entry[] = [];
  for (const group of own) {
    if (group.group === null || !ownIds.has(group.group)) {
      const entry = groupEntry(group);
      if (entry !== null) {
        entries.push(entry);
      }
    }
  }
  for (const node of siblings) {
    if (!placed.has(node.stat)) {
      entries.push(deviceEntry(node));
    }
  }
  entries.sort((a, b) => a.order - b.order);
  return entries.map((e) => e.node);
}

/**
 * The tree with the groups put in: a group sits between a parent and its
 * grouped children, nested groups inside, ordered by the position of the first
 * device of the group.
 */
export function displayTree(roots: TreeNode[], groups: Group[]): DisplayNode[] {
  return displayLevel(roots, null, groups);
}

/**
 * The value of a node: a device's own value; a group's sum of its direct
 * children (groups recursive). Children without a value are skipped; null when
 * none has one.
 */
export function groupValue(node: DisplayNode, values: Map<string, number | null>): number | null {
  if (node.type === "device") {
    return values.get(node.node.stat) ?? null;
  }
  const known = node.children
    .map((child) => groupValue(child, values))
    .filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
}

/** Can the selection (statistics and `group:<id>` ids) be grouped? Same real parent. */
export function canGroup(devices: Device[], groups: Group[], selection: string[]): boolean {
  if (selection.length === 0) {
    return false;
  }
  const parents = parentMap(devices);
  const found = new Set<string | null>();
  for (const id of selection) {
    if (id.startsWith(GROUP_PREFIX)) {
      const group = groups.find((g) => g.id === id.slice(GROUP_PREFIX.length));
      if (group === undefined) {
        return false;
      }
      found.add(group.parent);
    } else {
      if (!parents.has(id)) {
        return false;
      }
      found.add(parents.get(id)!);
    }
  }
  return found.size === 1;
}

/**
 * Suggest groups from areas: one `create_group` per parent and area that has
 * two or more ungrouped children, unless a group of that name exists already.
 */
export function areaGroups(
  devices: Device[],
  groups: Group[],
  stats: Record<string, StatInfo | undefined>,
  names: (area: string) => string,
  kind: DeviceKind = "electricity",
): Change[] {
  const grouped = new Set(groups.flatMap((g) => g.members));
  const known = new Set(devices.map((d) => d.stat_consumption));
  const parents: (string | null)[] = [];
  for (const device of devices) {
    const parent = device.included_in_stat ?? null;
    if (!parents.includes(parent) && (parent === null || known.has(parent))) {
      parents.push(parent);
    }
  }
  const taken = groups.map((g) => ({ parent: g.parent, name: g.name }));
  const changes: Change[] = [];
  for (const parent of parents) {
    const byArea = new Map<string, string[]>();
    for (const device of devices) {
      const stat = device.stat_consumption;
      const area = stats[stat]?.area_name;
      if ((device.included_in_stat ?? null) !== parent || grouped.has(stat) || !area) {
        continue;
      }
      byArea.set(area, [...(byArea.get(area) ?? []), stat]);
    }
    for (const [area, members] of byArea) {
      const name = names(area).trim();
      if (members.length < 2 || !name || taken.some((t) => t.parent === parent && t.name === name)) {
        continue;
      }
      taken.push({ parent, name });
      changes.push({
        type: "create_group",
        id: newGroupId(),
        name,
        parent,
        members,
        groups: [],
        kind,
      });
    }
  }
  return changes;
}
