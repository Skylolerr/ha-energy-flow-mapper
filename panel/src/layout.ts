// Automatic top-down layout of the diagram: sources, then Home, then the
// device tree. Pure geometry, no DOM; positions are never stored.

import type { SourceRole, SourceRow, TreeNode } from "./draft";

export const BOX_W = 220;
export const BOX_H = 72;
export const SOURCE_W = 160;
export const H_GAP = 24;
export const V_GAP = 56;
export const MARGIN = 24;

export const HOME_ID = "home";

export type BlockKind = "source" | "placeholder" | "home" | "device" | "untracked";

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
}

export type EdgeKind = "source" | "device" | "untracked";

export interface Edge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** Power flowing along the edge in W, or null if unknown. */
  power: number | null;
}

export interface Layout {
  blocks: Block[];
  edges: Edge[];
  width: number;
  height: number;
}

/** Roles shown as placeholders when no source fills them. */
export const PLACEHOLDER_ROLES = ["import", "production", "battery", "export"] as const;

const INTO_HOME: SourceRole[] = ["import", "production", "discharge", "consumption"];

export function untrackedId(stat: string): string {
  return `untracked:${stat}`;
}

interface Item {
  id: string;
  kind: "device" | "untracked";
  stat: string;
  node?: TreeNode;
  children: Item[];
}

function items(
  nodes: TreeNode[],
  untracked: Map<string, number | null>,
  collapsed: Set<string>,
): Item[] {
  return nodes.map((node) => {
    const children =
      node.children.length === 0 || collapsed.has(node.stat)
        ? []
        : [
            ...items(node.children, untracked, collapsed),
            { id: untrackedId(node.stat), kind: "untracked" as const, stat: node.stat, children: [] },
          ];
    return { id: node.stat, kind: "device" as const, stat: node.stat, node, children };
  });
}

function width(item: Item): number {
  if (item.children.length === 0) {
    return BOX_W;
  }
  const children = item.children.reduce((sum, child) => sum + width(child), 0);
  return Math.max(BOX_W, children + H_GAP * (item.children.length - 1));
}

/**
 * Lay out the diagram. `power` maps device statistics to their power in W,
 * `untracked` the untracked power of each device with children.
 */
export function layout(
  roots: TreeNode[],
  sources: SourceRow[],
  power: Map<string, number | null>,
  untracked: Map<string, number | null>,
  collapsed: Set<string> = new Set(),
): Layout {
  const blocks: Block[] = [];
  const edges: Edge[] = [];

  // Source row: configured sources first, then placeholders for missing roles.
  const roles = new Set(sources.map((s) => (s.type === "battery" ? "battery" : s.role)));
  const sourceBlocks: Block[] = sources.map((source, index) => ({
    id: `source:${index}`,
    kind: "source",
    x: 0,
    y: MARGIN,
    w: SOURCE_W,
    h: BOX_H,
    stat: source.stat,
    role: source.role,
    source,
  }));
  for (const role of PLACEHOLDER_ROLES) {
    if (!roles.has(role)) {
      sourceBlocks.push({
        id: `placeholder:${role}`,
        kind: "placeholder",
        x: 0,
        y: MARGIN,
        w: SOURCE_W,
        h: BOX_H,
        role,
      });
    }
  }
  const sourcesWidth = sourceBlocks.length * SOURCE_W + (sourceBlocks.length - 1) * H_GAP;

  // Device tree below Home.
  const tree = items(roots, untracked, collapsed);
  const treeWidth = tree.length
    ? tree.reduce((sum, item) => sum + width(item), 0) + H_GAP * (tree.length - 1)
    : BOX_W;
  const contentWidth = Math.max(sourcesWidth, treeWidth, BOX_W);
  const center = MARGIN + contentWidth / 2;

  let x = center - sourcesWidth / 2;
  for (const block of sourceBlocks) {
    block.x = x;
    x += SOURCE_W + H_GAP;
    blocks.push(block);
  }

  const homeY = MARGIN + BOX_H + V_GAP;
  blocks.push({ id: HOME_ID, kind: "home", x: center - BOX_W / 2, y: homeY, w: BOX_W, h: BOX_H });
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

  let height = homeY + BOX_H;
  const place = (item: Item, left: number, depth: number, parent: string): void => {
    const w = width(item);
    const y = homeY + (depth + 1) * (BOX_H + V_GAP);
    height = Math.max(height, y + BOX_H);
    blocks.push({
      id: item.id,
      kind: item.kind,
      x: left + (w - BOX_W) / 2,
      y,
      w: BOX_W,
      h: BOX_H,
      stat: item.stat,
      node: item.node,
    });
    edges.push({
      from: parent,
      to: item.id,
      kind: item.kind,
      power: item.kind === "untracked" ? (untracked.get(item.stat) ?? null) : (power.get(item.stat) ?? null),
    });
    let childLeft = left + (w - (item.children.reduce((s, c) => s + width(c), 0) + H_GAP * (item.children.length - 1))) / 2;
    for (const child of item.children) {
      place(child, childLeft, depth + 1, item.id);
      childLeft += width(child) + H_GAP;
    }
  };
  let left = center - treeWidth / 2;
  for (const item of tree) {
    place(item, left, 0, HOME_ID);
    left += width(item) + H_GAP;
  }

  return { blocks, edges, width: contentWidth + 2 * MARGIN, height: height + MARGIN };
}

/** Stroke width for an edge: 1.5 to 8 px relative to the largest power. */
export function strokeWidth(power: number | null, maxPower: number): number {
  if (power === null || maxPower <= 0) {
    return 1.5;
  }
  return 1.5 + 6.5 * Math.min(1, Math.max(0, power) / maxPower);
}

/**
 * A smooth connector between facing edges of two blocks: bottom to top when
 * it points down, top to bottom when it points up (Home to grid export).
 */
export function edgePath(from: Block, to: Block): string {
  const down = from.y <= to.y;
  const x1 = from.x + from.w / 2;
  const y1 = down ? from.y + from.h : from.y;
  const x2 = to.x + to.w / 2;
  const y2 = down ? to.y : to.y + to.h;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
}

/** Arrowhead triangle at the end of an edge (points down, or up for export). */
export function arrowHead(from: Block, to: Block, size = 6): string {
  const down = from.y <= to.y;
  const x = to.x + to.w / 2;
  const y = down ? to.y : to.y + to.h;
  const back = down ? y - size * 1.4 : y + size * 1.4;
  return `${x - size},${back} ${x + size},${back} ${x},${y}`;
}
