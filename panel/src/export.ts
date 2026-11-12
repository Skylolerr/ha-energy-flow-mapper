// The diagram as a picture: a standalone SVG drawn from the layout (no
// HTML-in-SVG, so every browser can turn it into a PNG), and the PNG itself.
// Everything happens in the browser; nothing is sent anywhere.

import type { Block, Frame, Layout } from "./layout";

/** One block as the picture shows it. */
export interface ExportBlock {
  block: Block;
  title: string;
  /** Value or sensor name below the title. */
  sub: string | null;
  /** Area of a device, shown after the value. */
  area: string | null;
  color: string;
  warn: boolean;
  /** The sub names a sensor (a late home meter); hidden with the names. */
  named?: boolean;
  /** Child devices hidden because the device is collapsed. */
  hidden?: number;
}

export interface ExportEdge {
  d: string;
  color: string;
  width: number;
  dashed: boolean;
  /** Points of the arrowhead polygon. */
  head?: string;
}

export interface ExportOptions {
  /** `group` colours the dashed frames of expanded groups (default: secondary). */
  theme: { background: string; text: string; secondary: string; card: string; divider: string; group?: string };
  footer: string;
}

/** Height of the footer line below the diagram. */
export const FOOTER_H = 40;
/** Largest canvas side browsers reliably draw. */
export const MAX_CANVAS = 16384;
/** Largest canvas area iOS (Safari, the Companion app) draws, in pixels. */
export const MAX_AREA = 16_777_216;

const FONT = "Roboto, Noto, system-ui, sans-serif";

/** Escape text for SVG content and attributes; drop what XML does not allow. */
export function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function blockSvg(item: ExportBlock, index: number, options: ExportOptions): string {
  const { x, y, w, h } = item.block;
  const { theme } = options;
  // Each sub line on its own line, like in the diagram; the area after the
  // first one (the value).
  const lines = (item.sub ?? "").split("\n").filter(Boolean);
  if (item.area) {
    lines[0] = lines.length ? `${lines[0]} · ${item.area}` : item.area;
  }
  const titleY = y + h / 2 + 5 - 10 * lines.length;
  const dashed = item.block.kind === "untracked" || item.block.kind === "placeholder" || item.block.kind === "group";
  return [
    `<clipPath id="c${index}"><rect x="${x + 10}" y="${y}" width="${w - 20}" height="${h}"/></clipPath>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${theme.card}" stroke="${
      item.warn ? "#ffa600" : theme.divider
    }" stroke-width="${item.warn ? 2 : 1}"${dashed ? ' stroke-dasharray="6 4"' : ""}/>`,
    `<rect x="${x}" y="${y + 8}" width="4" height="${h - 16}" rx="2" fill="${item.color}"/>`,
    `<g clip-path="url(#c${index})">`,
    `<text x="${x + 14}" y="${titleY}" font-family="${FONT}" font-size="14" font-weight="500" fill="${
      theme.text
    }">${escapeXml(item.title)}</text>`,
    ...lines.map(
      (line, n) =>
        `<text x="${x + 14}" y="${titleY + 19 + 15 * n}" font-family="${FONT}" font-size="12" fill="${
          theme.secondary
        }">${escapeXml(line)}</text>`,
    ),
    `</g>`,
    item.hidden
      ? `<text x="${x + w - 10}" y="${y + h - 8}" text-anchor="end" font-family="${FONT}" font-size="11" fill="${
          theme.secondary
        }">▸ +${item.hidden}</text>`
      : "",
    item.warn
      ? `<circle cx="${x + w - 14}" cy="${y + 14}" r="8" fill="#ffa600"/><text x="${x + w - 14}" y="${
          y + 18
        }" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="#ffffff">!</text>`
      : "",
  ].join("");
}

/** The dashed frame around an expanded group; drawn first, below everything else. */
function frameSvg(frame: Frame, options: ExportOptions): string {
  const color = options.theme.group ?? options.theme.secondary;
  return `<rect class="frame" x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="14" fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-width="1.5" stroke-dasharray="6 4"/>`;
}

function edgeSvg(edge: ExportEdge): string {
  const dash = edge.dashed ? ` stroke-dasharray="${edge.width * 2} ${edge.width * 1.5}"` : "";
  return (
    `<path d="${escapeXml(edge.d)}" fill="none" stroke="${edge.color}" stroke-width="${edge.width}"${dash}/>` +
    (edge.head ? `<polygon points="${escapeXml(edge.head)}" fill="${edge.color}"/>` : "")
  );
}

/**
 * The size of the picture: the diagram with the footer line below it. A small
 * diagram (one water device) is wider than its blocks so the footer fits;
 * about 7 px per character at 12 px.
 */
export function diagramSize(layout: Layout, footer: string): { width: number; height: number } {
  return {
    width: Math.max(layout.width, Math.ceil(48 + footer.length * 7)),
    height: layout.height + FOOTER_H,
  };
}

/** The whole diagram as a standalone SVG, with the footer line below it. */
export function diagramSvg(layout: Layout, blocks: ExportBlock[], edges: ExportEdge[], options: ExportOptions): string {
  const { width, height } = diagramSize(layout, options.footer);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${options.theme.background}"/>`,
    ...layout.frames.map((frame) => frameSvg(frame, options)),
    ...edges.map(edgeSvg),
    ...blocks.map((block, index) => blockSvg(block, index, options)),
    `<text x="24" y="${layout.height + FOOTER_H / 2 + 4}" font-family="${FONT}" font-size="12" fill="${
      options.theme.secondary
    }">${escapeXml(options.footer)}</text>`,
    `</svg>`,
  ].join("");
}

/** The blocks of one kind numbered in diagram order: top to bottom, then left to right. */
function numbered(blocks: ExportBlock[], kind: Block["kind"]): Map<ExportBlock, number> {
  const found = blocks
    .filter((b) => b.block.kind === kind)
    .sort((a, b) => a.block.y - b.block.y || a.block.x - b.block.x);
  return new Map(found.map((b, index) => [b, index + 1]));
}

/**
 * Hide everything private: devices become "Device 1, 2, …" and groups
 * "Group 1, 2, …" in diagram order without their area, and sources keep only
 * their role, not the sensor's name.
 */
export function anonymize(
  blocks: ExportBlock[],
  deviceLabel: (n: number) => string,
  groupLabel: (n: number) => string = deviceLabel,
): ExportBlock[] {
  const devices = numbered(blocks, "device");
  const groups = numbered(blocks, "group");
  return blocks.map((b) => {
    const n = devices.get(b);
    if (n !== undefined) {
      return { ...b, title: deviceLabel(n), area: null };
    }
    const g = groups.get(b);
    if (g !== undefined) {
      return { ...b, title: groupLabel(g), area: null };
    }
    if (b.block.kind === "source" || b.named) {
      return { ...b, sub: null, area: null };
    }
    return { ...b, area: null };
  });
}

/** The scale of the PNG: 2× for sharpness, less where the canvas would be too big. */
export function exportScale(width: number, height: number, scale = 2): number {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  return Math.min(scale, MAX_CANVAS / w, MAX_CANVAS / h, Math.sqrt(MAX_AREA / (w * h)) * 0.999);
}

/** Turn the SVG into a PNG in the browser. */
export async function svgToPng(svgText: string, width: number, height: number, scale = 2): Promise<Blob> {
  const factor = exportScale(width, height, scale);
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The diagram could not be drawn"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * factor);
    canvas.height = Math.round(height * factor);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The diagram could not be drawn");
    }
    context.scale(factor, factor);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The diagram could not be drawn"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
