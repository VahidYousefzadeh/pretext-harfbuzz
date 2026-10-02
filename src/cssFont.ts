// pretext sets canvas.font to strings like `italic 700 16px "Inter", sans-serif`, so we parse those.
export type CssFont = {
  readonly style: "normal" | "italic";
  readonly weight: number;
  readonly sizePx: number;
  /** First family in the list, without quotes. */
  readonly family: string;
};

const SIZE_AND_FAMILIES = /(\d+(?:\.\d+)?)px(?:\s*\/\s*\S+)?\s+(.+)$/;

export function parseCssFont(font: string): CssFont {
  const text = font.trim();
  const match = SIZE_AND_FAMILIES.exec(text);
  if (match === null) throw new Error(`Cannot read a px size and a family from the font "${font}".`);

  let style: CssFont["style"] = "normal";
  let weight = 400;
  for (const token of text.slice(0, match.index).toLowerCase().split(/\s+/)) {
    if (token === "italic" || token === "oblique") style = "italic";
    else if (token === "bold" || token === "bolder") weight = 700;
    else if (/^[1-9]00$/.test(token)) weight = Number(token);
  }
  const family = match[2].split(",")[0].trim().replace(/^(["'])(.*)\1$/, "$2");
  return { style, weight, sizePx: Number(match[1]), family };
}

export function formatCssFont(font: CssFont): string {
  return `${font.style === "italic" ? "italic " : ""}${font.weight} ${font.sizePx}px "${font.family}"`;
}
