// The diagram as a picture: a standalone SVG drawn from the layout (no
// HTML-in-SVG, so every browser can turn it into a PNG), and the PNG itself.
// Everything happens in the browser; nothing is sent anywhere.

import type { Block, Layout } from "./layout";

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
  theme: { background: string; text: string; secondary: string; card: string; divider: string };
  footer: string;
}

/** Height of the footer line below the diagram. */
export const FOOTER_H = 40;
/** Largest canvas side browsers reliably draw. */
export const MAX_CANVAS = 16384;

const FONT = "Roboto, Noto, system-ui, sans-serif";

/** Escape text for SVG content and attributes. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function blockSvg(item: ExportBlock, index: number, options: ExportOptions): string {
  const { x, y, w, h } = item.block;
  const { theme } = options;
  const sub = [item.sub, item.area].filter(Boolean).join(" · ");
  const dashed = item.block.kind === "untracked" || item.block.kind === "placeholder";
  return [
    `<clipPath id="c${index}"><rect x="${x + 10}" y="${y}" width="${w - 20}" height="${h}"/></clipPath>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${theme.card}" stroke="${
      item.warn ? "#ffa600" : theme.divider
    }" stroke-width="${item.warn ? 2 : 1}"${dashed ? ' stroke-dasharray="6 4"' : ""}/>`,
    `<rect x="${x}" y="${y + 8}" width="4" height="${h - 16}" rx="2" fill="${item.color}"/>`,
    `<g clip-path="url(#c${index})">`,
    `<text x="${x + 14}" y="${y + (sub ? h / 2 - 4 : h / 2 + 5)}" font-family="${FONT}" font-size="14" font-weight="500" fill="${
      theme.text
    }">${escapeXml(item.title)}</text>`,
    sub
      ? `<text x="${x + 14}" y="${y + h / 2 + 16}" font-family="${FONT}" font-size="12" fill="${theme.secondary}">${escapeXml(sub)}</text>`
      : "",
    `</g>`,
    item.warn
      ? `<circle cx="${x + w - 14}" cy="${y + 14}" r="8" fill="#ffa600"/><text x="${x + w - 14}" y="${
          y + 18
        }" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="#ffffff">!</text>`
      : "",
  ].join("");
}

function edgeSvg(edge: ExportEdge): string {
  const dash = edge.dashed ? ` stroke-dasharray="${edge.width * 2} ${edge.width * 1.5}"` : "";
  return (
    `<path d="${escapeXml(edge.d)}" fill="none" stroke="${edge.color}" stroke-width="${edge.width}"${dash}/>` +
    (edge.head ? `<polygon points="${escapeXml(edge.head)}" fill="${edge.color}"/>` : "")
  );
}

/** The whole diagram as a standalone SVG, with the footer line below it. */
export function diagramSvg(layout: Layout, blocks: ExportBlock[], edges: ExportEdge[], options: ExportOptions): string {
  const width = layout.width;
  const height = layout.height + FOOTER_H;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${options.theme.background}"/>`,
    ...edges.map(edgeSvg),
    ...blocks.map((block, index) => blockSvg(block, index, options)),
    `<text x="24" y="${layout.height + FOOTER_H / 2 + 4}" font-family="${FONT}" font-size="12" fill="${
      options.theme.secondary
    }">${escapeXml(options.footer)}</text>`,
    `</svg>`,
  ].join("");
}

/**
 * Hide everything private: devices become "Device 1, 2, …" in diagram order
 * (top to bottom, then left to right) without their area, and sources keep
 * only their role, not the sensor's name.
 */
export function anonymize(blocks: ExportBlock[], deviceLabel: (n: number) => string): ExportBlock[] {
  const devices = blocks
    .filter((b) => b.block.kind === "device")
    .sort((a, b) => a.block.y - b.block.y || a.block.x - b.block.x);
  const numbers = new Map(devices.map((b, index) => [b, index + 1]));
  return blocks.map((b) => {
    const n = numbers.get(b);
    if (n !== undefined) {
      return { ...b, title: deviceLabel(n), area: null };
    }
    if (b.block.kind === "source" || b.named) {
      return { ...b, sub: null, area: null };
    }
    return { ...b, area: null };
  });
}

/** The scale of the PNG: 2× for sharpness, less where the canvas would be too big. */
export function exportScale(width: number, height: number, scale = 2): number {
  return Math.min(scale, MAX_CANVAS / Math.max(width, 1), MAX_CANVAS / Math.max(height, 1));
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
