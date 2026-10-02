import type { TextLayout } from "./layoutText.ts";

/** "auto": the box grows with the text. "fixed": the text wraps at `width`. */
export type SceneOptions = {
  readonly mode: "auto" | "fixed";
  readonly width: number;
};

type Point = { readonly x: number; readonly y: number };
type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Source = { readonly x: number; readonly y: number; readonly r: number; readonly edge: "right" | "bottom" };

const BOX_AT: Point = { x: 60, y: 80 };
const PADDING = 16;
// Top-left corner of the text inside the box. The box grows right and down from here.
export const TEXT_ORIGIN: Point = { x: BOX_AT.x + PADDING, y: BOX_AT.y + PADDING };
const MIN_BOX = 48;
const ARROW_GAP = 10;
const MIN_ARROW = 76;
// The right arrow lands on the box's right edge, so it follows the measured width.
// The bottom arrow lands on the bottom edge, so it follows the measured height.
const SOURCES: readonly Source[] = [
  { x: 820, y: 150, r: 28, edge: "right" },
  { x: 300, y: 440, r: 28, edge: "bottom" },
];
const MIN_VIEW = { w: 880, h: 500 };
const MARGIN = 40;

const STYLE =
  ".phb-box,.phb-node{fill:#fff;stroke:#1d1d1d;stroke-width:2}.phb-ink,.phb-head{fill:#1d1d1d}" +
  ".phb-arrow{fill:none;stroke:#1d1d1d;stroke-width:2;stroke-linecap:round}.phb-size{fill:#6a6f76}" +
  "@media (prefers-color-scheme:dark){.phb-box,.phb-node{fill:#1b1f24;stroke:#e6e8eb}.phb-ink,.phb-head{fill:#e6e8eb}" +
  ".phb-arrow{stroke:#e6e8eb}.phb-size{fill:#9aa1aa}}";

// Builds the whole scene as one SVG string. The text is written as <text>/<tspan> at the
// positions from the layout, and the browser paints the letters. Node and the browser
// produce the exact same string.
export function renderSceneSvg(layout: TextLayout, options: SceneOptions): string {
  const textWidth = options.mode === "fixed" ? options.width : layout.width;
  const box: Rect = {
    x: BOX_AT.x,
    y: BOX_AT.y,
    w: Math.max(MIN_BOX, textWidth + 2 * PADDING),
    h: Math.max(MIN_BOX, layout.height + 2 * PADDING),
  };
  const sources = SOURCES.map((source) => keepClear(source, box));
  const view = {
    w: Math.max(MIN_VIEW.w, box.x + box.w + MARGIN, ...sources.map((s) => s.x + s.r + MARGIN)),
    h: Math.max(MIN_VIEW.h, box.y + box.h + MARGIN, ...sources.map((s) => s.y + s.r + MARGIN)),
  };

  const lines: string[] = [];
  for (const line of layout.lines) {
    if (line.runs.length === 0) continue;
    const runs = line.runs.map(
      (run) =>
        `<tspan x="${num(TEXT_ORIGIN.x + run.x)}"${run.bold ? ' font-weight="700"' : ""}${run.italic ? ' font-style="italic"' : ""}>` +
        `${escapeXml(run.text)}</tspan>`,
    );
    lines.push(`<text y="${num(TEXT_ORIGIN.y + line.baseline)}">${runs.join("")}</text>`);
  }

  const { family, sizePx } = layout.style;
  const arrows = sources.map((source) => arrow(source, box));
  const nodes = sources.map((s) => `<circle class="phb-node" cx="${s.x}" cy="${s.y}" r="${s.r}"/>`);
  const count = layout.lines.length;
  const size = `measured: ${count} line${count === 1 ? "" : "s"}, widest ${Math.round(layout.width * 10) / 10} px`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(view.w)}" height="${num(view.h)}" viewBox="0 0 ${num(view.w)} ${num(view.h)}">` +
    `<style>${STYLE}</style>${nodes.join("")}${arrows.join("")}` +
    `<rect class="phb-box" x="${box.x}" y="${box.y}" width="${num(box.w)}" height="${num(box.h)}" rx="10"/>` +
    `<text class="phb-size" x="${box.x}" y="${box.y - 12}" font-family="${escapeXml(family)}" font-size="13">${size}</text>` +
    `<g class="phb-ink" font-family="${escapeXml(family)}" font-size="${sizePx}">${lines.join("")}</g></svg>`
  );
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// When the box grows close to a circle, the circle moves away, so its arrow never gets too short.
function keepClear(source: Source, box: Rect): Source {
  const reach = ARROW_GAP + MIN_ARROW + source.r;
  return source.edge === "right"
    ? { ...source, x: Math.max(source.x, box.x + box.w + reach) }
    : { ...source, y: Math.max(source.y, box.y + box.h + reach) };
}

// A straight arrow from the circle to the middle of its edge of the box.
function arrow(source: Source, box: Rect): string {
  const tip =
    source.edge === "right"
      ? { x: box.x + box.w + ARROW_GAP, y: box.y + box.h / 2 }
      : { x: box.x + box.w / 2, y: box.y + box.h + ARROW_GAP };
  const length = Math.hypot(tip.x - source.x, tip.y - source.y);
  const dir = { x: (tip.x - source.x) / length, y: (tip.y - source.y) / length };
  const start = { x: source.x + dir.x * (source.r + 8), y: source.y + dir.y * (source.r + 8) };
  const head = 12;
  const half = 6;
  const base = { x: tip.x - dir.x * head, y: tip.y - dir.y * head };
  const left = { x: base.x - dir.y * half, y: base.y + dir.x * half };
  const right = { x: base.x + dir.y * half, y: base.y - dir.x * half };
  return (
    `<path class="phb-arrow" d="M${pt(start)}L${pt(base)}"/>` +
    `<path class="phb-head" d="M${pt(tip)}L${pt(left)}L${pt(right)}Z"/>`
  );
}

function pt(p: Point): string {
  return `${num(p.x)} ${num(p.y)}`;
}

// Two decimals is plenty, and it prints the same in every JS engine.
function num(value: number): string {
  return String(Math.round(value * 100) / 100);
}
