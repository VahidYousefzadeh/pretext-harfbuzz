import * as hb from "harfbuzzjs";
import type { CssFont } from "./cssFont.ts";

export type FaceKey = {
  readonly family: string;
  readonly weight: number;
  readonly style: "normal" | "italic";
};

/** Weight defaults to 400 and style to "normal". */
export type FaceDescription = {
  readonly family: string;
  readonly weight?: number;
  readonly style?: "normal" | "italic";
};

const buffer = new hb.Buffer();

/** TTF or OTF data loaded into HarfBuzz. All values are in font units. */
export class Face {
  readonly key: FaceKey;
  readonly upem: number;
  readonly ascender: number;
  /** Negative, as fonts store it. */
  readonly descender: number;
  private readonly font: hb.Font;

  constructor(key: FaceKey, bytes: ArrayBuffer | Uint8Array) {
    const face = new hb.Face(new hb.Blob(bytes));
    // HarfBuzz does not reject data it cannot read. It gives back an empty face, and every width is then wrong.
    if (face.collectUnicodes().length === 0) throw new Error(`HarfBuzz cannot read the font data for "${key.family}".`);
    this.key = key;
    this.font = new hb.Font(face);
    this.upem = face.upem;
    const extents = this.font.hExtents();
    this.ascender = extents.ascender;
    this.descender = extents.descender;
  }

  /** Width of the shaped text, kerning and ligatures included. */
  advance(text: string): number {
    buffer.reset();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    hb.shape(this.font, buffer);
    return buffer.getGlyphPositions().reduce((pen, position) => pen + position.xAdvance, 0);
  }
}

export class FontBook {
  private readonly list: Face[] = [];

  get faces(): readonly Face[] {
    return this.list;
  }

  /** Adds a TTF, OTF or WOFF2 file. */
  async add(description: FaceDescription, bytes: ArrayBuffer | Uint8Array): Promise<Face> {
    const key: FaceKey = { family: description.family, weight: description.weight ?? 400, style: description.style ?? "normal" };
    const face = new Face(key, await unpack(bytes));
    this.list.push(face);
    return face;
  }

  // A simple version of CSS font matching: same family, same style if there is one, closest weight.
  resolve(font: CssFont): Face {
    const family = font.family.toLowerCase();
    const sameFamily = this.list.filter((f) => f.key.family.toLowerCase() === family);
    if (sameFamily.length === 0) throw new Error(`No face is registered for the family "${font.family}".`);
    const sameStyle = sameFamily.filter((f) => f.key.style === font.style);
    const pool = sameStyle.length > 0 ? sameStyle : sameFamily;
    const distance = (f: Face) => Math.abs(f.key.weight - font.weight);
    return pool.reduce((best, f) => (distance(f) < distance(best) ? f : best));
  }

  /** Width in px, like canvas `measureText(text).width`. */
  measure(text: string, font: CssFont): number {
    const face = this.resolve(font);
    return (face.advance(text) * font.sizePx) / face.upem;
  }
}

// HarfBuzz reads TTF and OTF data only. A WOFF2 file holds the same data compressed, so we unpack it first.
// The decoder loads only when a WOFF2 file arrives, so a page that uses TTF fonts never downloads it.
async function unpack(bytes: ArrayBuffer | Uint8Array): Promise<ArrayBuffer | Uint8Array> {
  const signature = String.fromCharCode(...new Uint8Array(bytes.slice(0, 4)));
  if (signature !== "wOF2") return bytes;
  const { default: decompress } = await import("woff2-encoder/decompress");
  return decompress(bytes);
}
