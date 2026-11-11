// Automatic layout of the diagram: sources, then Home, then the device tree,
// top-down (horizontal, it grows wide) or from left to right (vertical, it
// grows tall). Pure geometry, no DOM; positions are never stored.

import type { SourceRole, SourceRow, TreeNode } from "./draft";
import { groupBlockId, groupValue, type DisplayNode } from "./groups";
import type { Group, Orientation } from "./types";

export const BOX_W = 220;
export const BOX_H = 72;
export const SOURCE_W = 160;
export const H_GAP = 24;
export const V_GAP = 56;
/** Space between the levels of a vertical diagram; its edges fan out further. */
export const COLUMN_GAP = 80;
/** Space between stacked blocks of a vertical diagram, which keeps it short. */
export const ROW_GAP = 12;
export const MARGIN = 24;
/** Space between the frame of an expanded group and the blocks inside it. */
export const FRAME_PAD = 12;

export const HOME_ID = "home";

/** CSS colour of a source edge or block by its role. */
export const SOURCE_COLORS: Record<string, string> = {
  import: "var(--energy-grid-consumption-color, #488fc2)",
  export: "var(--energy-grid-return-color, #8353d1)",
  production: "var(--energy-solar-color, #ff9800)",
  battery: "var(--energy-battery-out-color, #4db6ac)",
  discharge: "var(--energy-battery-out-color, #4db6ac)",
  charge: "var(--energy-battery-in-color, #f06292)",
  gas: "var(--energy-gas-color, #8e021b)",
  water: "var(--energy-water-color, #00bcd4)",
  consumption: "var(--energy-gas-color, #8e021b)",
  home: "var(--secondary-text-color)",
};

export type BlockKind = "source" | "placeholder" | "home" | "device" | "untracked" | "group";

export interface Block {
  id: string;
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Statistic of a device, source or the parent of an untracked block. */
  stat?: string;
  role?: SourceRole | "battery";
  source?: SourceRow;
  node?: TreeNode;
  /** Set on group blocks, collapsed or the header of an expanded group. */
  group?: Group;
}

export type EdgeKind = "source" | "device" | "untracked" | "group";

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Power flowing along the edge in W, or null if unknown. */
  power: number | null;
}

/** The frame around an expanded group: its header and everything below it. */
export interface Frame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  group: Group;
}

export interface Layout {
  blocks: Block[];
  edges: Edge[];
  /** Frames of expanded groups, outer ones before the groups inside them. */
  frames: Frame[];
  width: number;
  height: number;
}

/** Roles shown as placeholders when no source fills them (electricity tab). */
export const PLACEHOLDER_ROLES = ["import", "production", "battery", "export"] as const;
/** The same for the water tab. */
export const WATER_PLACEHOLDER_ROLES = ["water"] as const;
/** The same for the gas tab. */
export const GAS_PLACEHOLDER_ROLES = ["gas"] as const;
/** The electricity roles with the home meter (HA 2026.11 and newer). */
export const HOME_PLACEHOLDER_ROLES = [...PLACEHOLDER_ROLES, "home"] as const;

type PlaceholderRole = SourceRole | "battery";

const INTO_HOME: SourceRole[] = ["import", "production", "discharge", "gas", "water", "consumption", "home"];

export function untrackedId(stat: string): string {
  return `untracked:${stat}`;
}

interface Item {
  id: string;
  kind: "device" | "untracked" | "group";
  /** Statistic of a device, or of the parent of an untracked block. */
  stat?: string;
  node?: TreeNode;
  group?: Group;
  /** Where the value of a group comes from. */
  display?: DisplayNode;
  children: Item[];
}

function items(nodes: DisplayNode[], collapsed: Set<string>, showUntracked: boolean): Item[] {
  return nodes.map((node): Item => {
    if (node.type === "group") {
      const id = groupBlockId(node.group.id);
      const children = collapsed.has(id) ? [] : items(node.children, collapsed, showUntracked);
      return { id, kind: "group", group: node.group, display: node, children };
    }
    const stat = node.node.stat;
    const children =
      node.children.length === 0 || collapsed.has(stat)
        ? []
        : [
            ...items(node.children, collapsed, showUntracked),
            ...(showUntracked ? [{ id: untrackedId(stat), kind: "untracked" as const, stat, children: [] }] : []),
          ];
    return { id: stat, kind: "device", stat, node: node.node, display: node, children };
  });
}

/** Wrap a plain tree as device nodes, for callers that have no groups. */
function wrap(nodes: TreeNode[]): DisplayNode[] {
  return nodes.map((node) => ({ type: "device", node, children: wrap(node.children) }));
}

/** An expanded group: its children sit in a frame. */
function framed(item: Item): boolean {
  return item.kind === "group" && item.children.length > 0;
}

/** Room of an item and its children across the flow, for blocks of size `box`. */
function span(item: Item, box: number, space: number): number {
  if (item.children.length === 0) {
    return box;
  }
  const children = item.children.reduce((sum, child) => sum + span(child, box, space), 0);
  return Math.max(box, children + space * (item.children.length - 1)) + (framed(item) ? 2 * FRAME_PAD : 0);
}

/**
 * Lay out the diagram. `power` maps device statistics to their value (power
 * or flow), `untracked` the untracked value of each device with children.
 * `placeholders` are the source roles offered when no source fills them;
 * without `showUntracked` the blocks for untracked consumption are left out.
 * Levels are rows when horizontal and columns when vertical. `homeUntracked`
 * adds what no top-level device covers below Home (`untracked` of HOME_ID).
 */
export function layout(
  roots: DisplayNode[] | TreeNode[],
  sources: SourceRow[],
  power: Map<string, number | null>,
  untracked: Map<string, number | null>,
  collapsed: Set<string> = new Set(),
  placeholders: readonly PlaceholderRole[] = PLACEHOLDER_ROLES,
  showUntracked = true,
  orientation: Orientation = "horizontal",
  homeUntracked = false,
): Layout {
  const blocks: Block[] = [];
  const edges: Edge[] = [];
  const frames: Frame[] = [];

  // Sizes along the flow and across it, and a position from those two.
  const vertical = orientation === "vertical";
  const boxAlong = vertical ? BOX_W : BOX_H;
  const boxAcross = vertical ? BOX_H : BOX_W;
  const sourceAlong = vertical ? SOURCE_W : BOX_H;
  const sourceAcross = vertical ? BOX_H : SOURCE_W;
  const gap = vertical ? COLUMN_GAP : V_GAP;
  const space = vertical ? ROW_GAP : H_GAP;
  const at = (along: number, across: number) => (vertical ? { x: along, y: across } : { x: across, y: along });

  // Source row: configured sources first, then placeholders for missing roles.
  const roles = new Set(sources.map((s) => (s.type === "battery" ? "battery" : s.role)));
  const sourceBlocks: Block[] = sources.map((source, index) => ({
    id: `source:${index}`,
    kind: "source",
    x: 0,
    y: 0,
    w: SOURCE_W,
    h: BOX_H,
    stat: source.stat,
    role: source.role,
    source,
  }));
  for (const role of placeholders) {
    if (!roles.has(role)) {
      sourceBlocks.push({
        id: `placeholder:${role}`,
        kind: "placeholder",
        x: 0,
        y: 0,
        w: SOURCE_W,
        h: BOX_H,
        role,
      });
    }
  }
  const sourcesAcross = sourceBlocks.length * sourceAcross + (sourceBlocks.length - 1) * space;

  // Device tree after Home.
  const tree = items(
    roots.length > 0 && "type" in roots[0] ? (roots as DisplayNode[]) : wrap(roots as TreeNode[]),
    collapsed,
    showUntracked,
  );
  if (showUntracked && homeUntracked) {
    tree.push({ id: untrackedId(HOME_ID), kind: "untracked", stat: HOME_ID, children: [] });
  }
  const treeAcross = tree.length
    ? tree.reduce((sum, item) => sum + span(item, boxAcross, space), 0) + space * (tree.length - 1)
    : boxAcross;
  const content = Math.max(sourcesAcross, treeAcross, boxAcross);
  const center = MARGIN + content / 2;

  let across = center - sourcesAcross / 2;
  for (const block of sourceBlocks) {
    Object.assign(block, at(MARGIN, across));
    across += sourceAcross + space;
    blocks.push(block);
  }

  const homeAlong = MARGIN + sourceAlong + gap;
  blocks.push({ id: HOME_ID, kind: "home", ...at(homeAlong, center - boxAcross / 2), w: BOX_W, h: BOX_H });
  for (const block of sourceBlocks) {
    if (block.kind !== "source") {
      continue;
    }
    const into = INTO_HOME.includes(block.role as SourceRole);
    edges.push({
      from: into ? block.id : HOME_ID,
      to: into ? HOME_ID : block.id,
      kind: "source",
      power: null,
    });
  }

  let end = homeAlong + boxAlong;
  // Places an item and its children; returns the end along the flow of the
  // item and everything below it, including the frames of groups.
  const place = (item: Item, start: number, depth: number, parent: string): number => {
    const size = span(item, boxAcross, space);
    const along = homeAlong + (depth + 1) * (boxAlong + gap);
    const own = along + boxAlong;
    end = Math.max(end, own);
    const stat = item.stat ?? "";
    let flow: number | null;
    if (item.kind === "untracked") {
      flow = untracked.get(stat) ?? null;
    } else if (item.kind === "group") {
      flow = groupValue(item.display!, power);
    } else {
      flow = power.get(stat) ?? null;
    }
    blocks.push({
      id: item.id,
      kind: item.kind,
      ...at(along, start + (size - boxAcross) / 2),
      w: BOX_W,
      h: BOX_H,
      stat: item.stat,
      node: item.node,
      group: item.group,
    });
    edges.push({ from: parent, to: item.id, kind: item.kind, power: flow });
    const frame: Frame | null = framed(item)
      ? { id: item.id, ...at(along - FRAME_PAD, start), ...(vertical ? { w: 0, h: size } : { w: size, h: 0 }), group: item.group! }
      : null;
    if (frame) {
      frames.push(frame);
    }
    const children = item.children.reduce((sum, child) => sum + span(child, boxAcross, space), 0);
    let childStart = start + (size - (children + space * (item.children.length - 1))) / 2;
    let below = own;
    for (const child of item.children) {
      below = Math.max(below, place(child, childStart, depth + 1, item.id));
      childStart += span(child, boxAcross, space) + space;
    }
    if (frame) {
      below += FRAME_PAD;
      end = Math.max(end, below);
      const length = below - (along - FRAME_PAD);
      if (vertical) {
        frame.w = length;
      } else {
        frame.h = length;
      }
    }
    return below;
  };
  let start = center - treeAcross / 2;
  for (const item of tree) {
    place(item, start, 0, HOME_ID);
    start += span(item, boxAcross, space) + space;
  }

  const breadth = content + 2 * MARGIN;
  const length = end + MARGIN;
  return { blocks, edges, frames, width: vertical ? length : breadth, height: vertical ? breadth : length };
}

/** Stroke width for an edge: 2 to 8 px relative to the largest power. */
export function strokeWidth(power: number | null, maxPower: number): number {
  if (power === null || maxPower <= 0) {
    return 2;
  }
  return 2 + 6 * Math.min(1, Math.max(0, power) / maxPower);
}

/**
 * A smooth connector between facing edges of two blocks: bottom to top when
 * it points down, top to bottom when it points up (Home to grid export), and
 * sideways the same way in a vertical diagram. `inset` stops the line before
 * the target, where the arrowhead begins.
 */
export function edgePath(from: Block, to: Block, inset = 0, orientation: Orientation = "horizontal"): string {
  if (orientation === "vertical") {
    const right = from.x <= to.x;
    const x1 = right ? from.x + from.w : from.x;
    const y1 = from.y + from.h / 2;
    const x2 = right ? to.x - inset : to.x + to.w + inset;
    const y2 = to.y + to.h / 2;
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }
  const down = from.y <= to.y;
  const x1 = from.x + from.w / 2;
  const y1 = down ? from.y + from.h : from.y;
  const x2 = to.x + to.w / 2;
  const y2 = down ? to.y - inset : to.y + to.h + inset;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

/** Arrowhead size for a line width: always clearly wider than the line. */
export function arrowSize(lineWidth: number): { half: number; length: number } {
  const half = Math.max(5, lineWidth * 0.9 + 2.5);
  return { half, length: half * 1.3 };
}

/** Arrowhead triangle at the end of an edge, pointing along it. */
export function arrowHead(
  from: Block,
  to: Block,
  half = 6,
  length = half * 1.4,
  orientation: Orientation = "horizontal",
): string {
  if (orientation === "vertical") {
    const right = from.x <= to.x;
    const x = right ? to.x : to.x + to.w;
    const y = to.y + to.h / 2;
    const back = right ? x - length : x + length;
    return `${back},${y - half} ${back},${y + half} ${x},${y}`;
  }
  const down = from.y <= to.y;
  const x = to.x + to.w / 2;
  const y = down ? to.y : to.y + to.h;
  const back = down ? y - length : y + length;
  return `${x - half},${back} ${x + half},${back} ${x},${y}`;
}

/** Dashes that stay proportionate on thick lines. */
export function dashPattern(lineWidth: number): string {
  const dash = Math.max(4, lineWidth * 2);
  const gap = Math.max(4, lineWidth * 1.25);
  return `${dash} ${gap}`;
}
