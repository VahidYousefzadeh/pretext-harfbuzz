import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges,
} from "@chenglou/pretext/rich-inline";
import { formatCssFont, type CssFont, type FontBook } from "../src/index.ts";
import type { Paragraph, Run } from "./richText.ts";

export type TextStyle = {
  readonly family: string;
  readonly sizePx: number;
  readonly lineHeightPx: number;
};

export type PlacedRun = {
  /** Trailing space removed. */
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  /** From the left edge of the text block. */
  readonly x: number;
  readonly width: number;
};

export type TextLine = {
  readonly width: number;
  /** From the top of the text block. */
  readonly baseline: number;
  readonly runs: readonly PlacedRun[];
};

export type TextLayout = {
  readonly style: TextStyle;
  readonly lines: readonly TextLine[];
  readonly width: number;
  readonly height: number;
};

// pretext breaks the lines (measuring every word with HarfBuzz) and tells us where each run starts.
// maxWidth can be Infinity for a box that grows sideways.
export function layOutText(book: FontBook, paragraphs: readonly Paragraph[], style: TextStyle, maxWidth: number): TextLayout {
  const strut = book.resolve(fontOf(style, { text: "", bold: false, italic: false }));
  const unit = style.sizePx / strut.upem;
  // Chrome rounds the font's ascent and descent to whole pixels and rounds the top half of the
  // leading down. Doing the same puts our baselines exactly where Chrome puts them.
  const ascent = Math.round(strut.ascender * unit);
  const descent = Math.round(-strut.descender * unit);
  const baselineInLine = Math.floor((style.lineHeightPx - (ascent + descent)) / 2) + ascent;

  const lines: TextLine[] = [];
  for (const paragraph of paragraphs) {
    const fonts = paragraph.map((run) => fontOf(style, run));
    const firstLine = lines.length;
    const baseline = () => lines.length * style.lineHeightPx + baselineInLine;
    if (paragraph.some((run) => run.text.trim() !== "")) {
      const prepared = prepareRichInline(paragraph.map((run, i) => ({ text: run.text, font: formatCssFont(fonts[i]) })));
      walkRichInlineLineRanges(prepared, maxWidth, (range) => {
        const line = materializeRichInlineLineRange(prepared, range);
        const runs: PlacedRun[] = [];
        let x = 0;
        for (const fragment of line.fragments) {
          x += fragment.gapBefore;
          const text = fragment.text.trimEnd();
          const { bold, italic } = paragraph[fragment.itemIndex];
          runs.push({ text, bold, italic, x, width: fragment.occupiedWidth });
          x += fragment.occupiedWidth;
        }
        lines.push({ width: line.width, baseline: baseline(), runs });
      });
    }
    // An empty paragraph still takes up a line, like an empty <p>.
    if (lines.length === firstLine) lines.push({ width: 0, baseline: baseline(), runs: [] });
  }

  const width = lines.reduce((widest, line) => Math.max(widest, line.width), 0);
  return { style, lines, width, height: lines.length * style.lineHeightPx };
}

function fontOf(style: TextStyle, run: Run): CssFont {
  return {
    family: style.family,
    sizePx: style.sizePx,
    weight: run.bold ? 700 : 400,
    style: run.italic ? "italic" : "normal",
  };
}
