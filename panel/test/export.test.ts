import { describe, expect, it } from "vitest";

import { anonymize, diagramSvg, escapeXml, exportScale, FOOTER_H, MAX_CANVAS, type ExportBlock } from "../src/export";
import type { Block, Layout } from "../src/layout";

const theme = {
  background: "#ffffff",
  text: "#212121",
  secondary: "#727272",
  card: "#fafafa",
  divider: "#e0e0e0",
};

function block(id: string, kind: Block["kind"], x: number, y: number, stat?: string): Block {
  return { id, kind, x, y, w: 220, h: 72, stat };
}

const LAYOUT: Layout = {
  frames: [],
  blocks: [
    block("src:import", "source", 24, 24, "sensor.grid_import"),
    block("home", "home", 300, 24),
    block("sensor.kids_room", "device", 600, 24, "sensor.kids_room"),
    block("sensor.lamp", "device", 600, 120, "sensor.lamp"),
  ],
  edges: [],
  width: 844,
  height: 216,
};

function blocks(): ExportBlock[] {
  return [
    { block: LAYOUT.blocks[0], title: "Grid import", sub: "Main meter", area: null, color: "#488fc2", warn: false },
    { block: LAYOUT.blocks[1], title: "Home", sub: "20 kWh measured", area: null, color: "#727272", warn: false },
    // A name with markup, its area and its entity ID.
    { block: LAYOUT.blocks[2], title: "Anna's <room>", sub: "2 kWh", area: "Kids room Anna", color: "#03a9f4", warn: true },
    { block: LAYOUT.blocks[3], title: "sensor.lamp", sub: "1 kWh", area: "Hall", color: "#03a9f4", warn: false },
  ];
}

const options = { theme, footer: "Energy Flow Mapper · Electricity · 7 days · 06.11.2026 18:30" };

describe("diagramSvg", () => {
  it("draws every block with its texts and the footer below the diagram", () => {
    const svg = diagramSvg(LAYOUT, blocks(), [], options);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`width="844" height="${216 + FOOTER_H}"`);
    expect(svg).toContain("Grid import");
    expect(svg).toContain("20 kWh measured");
    expect(svg).toContain("2 kWh · Kids room Anna");
    expect(svg).toContain("Energy Flow Mapper · Electricity · 7 days · 06.11.2026 18:30");
    expect(svg).not.toContain("foreignObject");
  });

  it("escapes markup in names", () => {
    const svg = diagramSvg(LAYOUT, blocks(), [], options);
    expect(svg).toContain("Anna&apos;s &lt;room&gt;");
    expect(svg).not.toContain("<room>");
  });

  it("draws edges with their arrowheads, dashed where asked", () => {
    const svg = diagramSvg(
      LAYOUT,
      blocks(),
      [{ d: "M 1 2 L 3 4", color: "#488fc2", width: 3, dashed: true, head: "1,2 3,4 5,6" }],
      options,
    );
    expect(svg).toContain('d="M 1 2 L 3 4"');
    expect(svg).toContain('stroke-dasharray="');
    expect(svg).toContain('points="1,2 3,4 5,6"');
  });
});

describe("anonymize", () => {
  it("numbers devices in diagram order and drops their areas", () => {
    const result = anonymize(blocks(), (n) => `Device ${n}`);
    expect(result.map((b) => b.title)).toEqual(["Grid import", "Home", "Device 1", "Device 2"]);
    expect(result[2].sub).toBe("2 kWh");
    expect(result[2].area).toBeNull();
    expect(result[3].area).toBeNull();
    // Sources keep their role but not the sensor's name.
    expect(result[0].sub).toBeNull();
  });

  it("leaves no name, area, statistic or entity ID in the image", () => {
    const svg = diagramSvg(LAYOUT, anonymize(blocks(), (n) => `Device ${n}`), [], options);
    for (const secret of ["Anna", "room", "Kids", "Hall", "sensor.", "Main meter"]) {
      expect(svg).not.toContain(secret);
    }
  });
});

describe("exportScale", () => {
  it("keeps 2x for normal diagrams and shrinks huge ones below the canvas limit", () => {
    expect(exportScale(1000, 800)).toBe(2);
    const scale = exportScale(30000, 1000);
    expect(30000 * scale).toBeLessThanOrEqual(MAX_CANVAS);
    expect(scale).toBeGreaterThan(0);
  });
});

describe("anonymize texts that name a sensor", () => {
  it("drops a sub marked as naming a sensor", () => {
    const home: ExportBlock = { block: LAYOUT.blocks[1], title: "Home", sub: "Main meter: data not recent enough", area: null, color: "#727272", warn: false, named: true };
    expect(anonymize([home], (n) => `Device ${n}`)[0].sub).toBeNull();
  });
});

describe("canvas area limit", () => {
  it("keeps the PNG below the canvas area iOS can draw", async () => {
    const { MAX_AREA } = await import("../src/export");
    const scale = exportScale(7300, 640);
    expect(7300 * scale * 640 * scale).toBeLessThanOrEqual(MAX_AREA);
    expect(exportScale(1000, 800)).toBe(2);
  });
});

describe("lines and markers in the picture", () => {
  it("draws each sub line of a block on its own line", () => {
    const home = { ...blocks()[1], sub: "20 kWh measured\n65% covered by devices" };
    const svg = diagramSvg(LAYOUT, [home], [], options);
    expect(svg).toContain(">20 kWh measured</text>");
    expect(svg).toContain(">65% covered by devices</text>");
  });

  it("marks a collapsed device with the number of hidden child devices", () => {
    const device = { ...blocks()[2], hidden: 3 };
    expect(diagramSvg(LAYOUT, [device], [], options)).toContain("▸ +3");
  });

  it("makes the picture wide enough for the footer", () => {
    const narrow = { ...LAYOUT, width: 268 };
    const svg = diagramSvg(narrow, [], [], options);
    const width = Number(/width="(\d+)"/.exec(svg)![1]);
    expect(width).toBeGreaterThanOrEqual(24 + options.footer.length * 7);
  });

  it("leaves out characters XML does not allow", () => {
    expect(escapeXml("TV\u000bcorner\u0000")).toBe("TVcorner");
  });
});
