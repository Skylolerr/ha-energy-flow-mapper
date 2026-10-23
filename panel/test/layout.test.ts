import { describe, expect, it } from "vitest";

import { buildTree, sourceRows } from "../src/draft";
import {
  arrowHead,
  BOX_H,
  BOX_W,
  edgePath,
  H_GAP,
  HOME_ID,
  layout,
  MARGIN,
  strokeWidth,
  untrackedId,
  V_GAP,
} from "../src/layout";
import type { Device } from "../src/types";

function device(stat: string, parent?: string): Device {
  return parent ? { stat_consumption: stat, included_in_stat: parent } : { stat_consumption: stat };
}

const DEVICES = [device("server"), device("sonos", "server"), device("tv")];

function byId(result: ReturnType<typeof layout>) {
  return Object.fromEntries(result.blocks.map((b) => [b.id, b]));
}

describe("layout", () => {
  it("places sources, Home and the device tree top-down", () => {
    const result = layout(
      buildTree(DEVICES),
      [],
      new Map([
        ["server", 160],
        ["sonos", 0],
        ["tv", 3],
      ]),
      new Map([["server", 160]]),
    );
    const blocks = byId(result);
    // Without sources there are four placeholders.
    expect(result.blocks.filter((b) => b.kind === "placeholder").map((b) => b.role)).toEqual([
      "import",
      "production",
      "battery",
      "export",
    ]);
    const home = blocks[HOME_ID];
    expect(home.y).toBe(MARGIN + BOX_H + V_GAP);
    const level1 = home.y + BOX_H + V_GAP;
    expect(blocks.server.y).toBe(level1);
    expect(blocks.tv.y).toBe(level1);
    expect(blocks.sonos.y).toBe(level1 + BOX_H + V_GAP);
    expect(blocks[untrackedId("server")].y).toBe(blocks.sonos.y);
    // A parent is centred above its children; siblings do not overlap.
    const children = [blocks.sonos, blocks[untrackedId("server")]];
    const childCenter = (children[0].x + children[1].x + BOX_W) / 2;
    expect(blocks.server.x + BOX_W / 2).toBeCloseTo(childCenter);
    expect(children[1].x - children[0].x).toBe(BOX_W + H_GAP);
    expect(blocks.tv.x).toBeGreaterThanOrEqual(children[1].x + BOX_W + H_GAP);
    // Everything fits inside the reported size.
    for (const block of result.blocks) {
      expect(block.x).toBeGreaterThanOrEqual(MARGIN - 0.001);
      expect(block.x + block.w).toBeLessThanOrEqual(result.width - MARGIN + 0.001);
      expect(block.y + block.h).toBeLessThanOrEqual(result.height);
    }
    expect(result.edges).toEqual([
      { from: HOME_ID, to: "server", kind: "device", power: 160 },
      { from: "server", to: "sonos", kind: "device", power: 0 },
      { from: "server", to: untrackedId("server"), kind: "untracked", power: 160 },
      { from: HOME_ID, to: "tv", kind: "device", power: 3 },
    ]);
  });

  it("connects sources in the direction energy flows", () => {
    const sources = sourceRows([
      { type: "grid", stat_energy_from: "imp", stat_energy_to: "exp" },
      { type: "battery", stat_energy_from: "out", stat_energy_to: "in" },
    ]);
    const result = layout([], sources, new Map(), new Map());
    expect(result.blocks.filter((b) => b.kind === "placeholder").map((b) => b.role)).toEqual([
      "production",
    ]);
    expect(result.edges).toEqual([
      { from: "source:0", to: HOME_ID, kind: "source", power: null },
      { from: HOME_ID, to: "source:1", kind: "source", power: null },
      { from: "source:2", to: HOME_ID, kind: "source", power: null },
      { from: HOME_ID, to: "source:3", kind: "source", power: null },
    ]);
    // Home is centred below the source row.
    const blocks = byId(result);
    const row = result.blocks.filter((b) => b.kind !== "home");
    const rowCenter = (row[0].x + row.at(-1)!.x + row.at(-1)!.w) / 2;
    expect(blocks[HOME_ID].x + BOX_W / 2).toBeCloseTo(rowCenter);
  });

  it("hides the children of collapsed devices", () => {
    const result = layout(buildTree(DEVICES), [], new Map(), new Map(), new Set(["server"]));
    expect(result.blocks.map((b) => b.id)).not.toContain("sonos");
    expect(result.blocks.map((b) => b.id)).not.toContain(untrackedId("server"));
  });

  it("is wide enough for deep and wide trees", () => {
    const devices = [
      device("a"),
      ...["b", "c", "d", "e"].map((s) => device(s, "a")),
      device("f", "b"),
      device("g", "f"),
    ];
    const result = layout(buildTree(devices), [], new Map(), new Map());
    const devicesOnly = result.blocks.filter((b) => b.kind === "device" || b.kind === "untracked");
    for (const a of devicesOnly) {
      for (const b of devicesOnly) {
        if (a !== b && a.y === b.y) {
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(BOX_W + H_GAP - 0.001);
        }
      }
    }
    expect(Math.max(...result.blocks.map((b) => b.y))).toBe(
      MARGIN + 5 * (BOX_H + V_GAP), // sources, Home, a, b, f, g
    );
  });
});

describe("drawing helpers", () => {
  it("scales strokes by power", () => {
    expect(strokeWidth(null, 100)).toBe(1.5);
    expect(strokeWidth(50, 0)).toBe(1.5);
    expect(strokeWidth(0, 100)).toBe(1.5);
    expect(strokeWidth(100, 100)).toBe(8);
    expect(strokeWidth(-5, 100)).toBe(1.5);
    expect(strokeWidth(200, 100)).toBe(8);
  });

  it("connects facing edges", () => {
    const top = { id: "a", kind: "home" as const, x: 0, y: 0, w: 100, h: 60 };
    const bottom = { id: "b", kind: "device" as const, x: 200, y: 200, w: 100, h: 60 };
    expect(edgePath(top, bottom)).toBe("M 50 60 C 50 130, 250 130, 250 200");
    expect(edgePath(bottom, top)).toBe("M 250 200 C 250 130, 50 130, 50 60");
  });
});

describe("arrowHead", () => {
  it("points at the target block", () => {
    const top = { id: "a", kind: "home" as const, x: 0, y: 0, w: 100, h: 60 };
    const bottom = { id: "b", kind: "device" as const, x: 200, y: 200, w: 100, h: 60 };
    expect(arrowHead(top, bottom)).toBe("244,191.6 256,191.6 250,200");
    expect(arrowHead(bottom, top)).toBe("44,68.4 56,68.4 50,60");
  });
});
