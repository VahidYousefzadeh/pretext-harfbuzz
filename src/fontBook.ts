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

/** A font file loaded into HarfBuzz. All values are in font units. */
export class Face {
  readonly key: FaceKey;
  readonly upem: number;
  readonly ascender: number;
  /** Negative, as fonts store it. */
  readonly descender: number;
  private readonly font: hb.Font;

  constructor(key: FaceKey, bytes: ArrayBuffer | Uint8Array) {
    const face = new hb.Face(new hb.Blob(bytes));
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

  /** Adds a TTF or OTF file. */
  add(description: FaceDescription, bytes: ArrayBuffer | Uint8Array): Face {
    const key: FaceKey = { family: description.family, weight: description.weight ?? 400, style: description.style ?? "normal" };
    const face = new Face(key, bytes);
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
