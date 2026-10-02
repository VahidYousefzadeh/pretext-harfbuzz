import { prepare, setLocale } from "@chenglou/pretext";
import { formatCssFont, parseCssFont, type CssFont } from "./cssFont.ts";
import type { FontBook } from "./fontBook.ts";

// pretext only uses two things from its canvas context: the font setter and measureText().width.
class HarfBuzzMeasureContext {
  private readonly book: FontBook;
  private readonly parsedFonts = new Map<string, CssFont>();
  private current = "";
  private parsed: CssFont | null = null;

  constructor(book: FontBook) {
    this.book = book;
  }

  get font(): string {
    return this.current;
  }

  set font(value: string) {
    let parsed = this.parsedFonts.get(value);
    if (parsed === undefined) {
      parsed = parseCssFont(value);
      this.parsedFonts.set(value, parsed);
    }
    this.current = value;
    this.parsed = parsed;
  }

  measureText(text: string): { width: number } {
    if (this.parsed === null) throw new Error("pretext measured text before it set a font.");
    return { width: this.book.measure(text, this.parsed) };
  }
}

// pretext tweaks its line breaking for each browser engine, based on the user agent.
// Our widths don't come from a browser, so we always tell it it's running in Chromium.
const PINNED_ENGINE = {
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  vendor: "Google Inc.",
};

export type InstallOptions = {
  /** Locale for word breaking. Set it, or Node and each browser use their own default. */
  readonly locale?: string;
};

/**
 * Makes pretext measure text with HarfBuzz, in Node and in the browser.
 *
 * pretext has no option for this: it creates its canvas once, on the first measurement,
 * with `new OffscreenCanvas(1, 1)`. So we swap in our own OffscreenCanvas for that one
 * call and restore the original right after. Node has no OffscreenCanvas at all, which
 * is why pretext needs this there.
 *
 * Call it once, after adding your fonts and before anything else uses pretext.
 */
export function installHarfBuzzMeasurer(book: FontBook, options: InstallOptions = {}): void {
  const [face] = book.faces;
  if (face === undefined) throw new Error("Add at least one face to the book before installing.");

  const context = new HarfBuzzMeasureContext(book);
  let handedOver = false;
  class HarfBuzzOffscreenCanvas {
    getContext(kind: string): HarfBuzzMeasureContext | null {
      if (kind !== "2d") return null;
      handedOver = true;
      return context;
    }
  }

  withGlobal("OffscreenCanvas", HarfBuzzOffscreenCanvas, () =>
    withGlobal("navigator", PINNED_ENGINE, () => {
      setLocale(options.locale);
      prepare("pretext", formatCssFont({ ...face.key, sizePx: 16 }));
    }),
  );
  if (!handedOver) {
    throw new Error("pretext already made its own canvas. Call installHarfBuzzMeasurer before any other pretext call.");
  }
}

function withGlobal(name: string, value: unknown, run: () => void): void {
  const saved = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  try {
    run();
  } finally {
    if (saved === undefined) Reflect.deleteProperty(globalThis, name);
    else Object.defineProperty(globalThis, name, saved);
  }
}
