import { FontBook, installHarfBuzzMeasurer, type FaceDescription } from "../src/index.ts";
import { layOutText, type TextLayout, type TextStyle } from "./layoutText.ts";
import { parseRichText } from "./richText.ts";
import { renderSceneSvg, type SceneOptions } from "./scene.ts";

export const FONT_FILES: readonly { readonly file: string; readonly face: FaceDescription }[] = [
  { file: "Inter-Regular.ttf", face: { family: "Inter" } },
  { file: "Inter-Bold.ttf", face: { family: "Inter", weight: 700 } },
  { file: "Inter-Italic.ttf", face: { family: "Inter", style: "italic" } },
];

export const TEXT_STYLE: TextStyle = { family: "Inter", sizePx: 18, lineHeightPx: 26 };

export type RenderJob = SceneOptions & { readonly text: string };

export const DEFAULT_JOB: RenderJob = {
  text: "The quick brown fox jumps over the lazy dog.",
  mode: "fixed",
  width: 300,
};

export type RenderResult = {
  readonly svg: string;
  /** All layout numbers at full precision, so the page can compare with Node exactly. */
  readonly numbers: string;
};

/** fetch() in the browser, readFile() in Node. */
export type FontReader = (file: string) => Promise<ArrayBuffer | Uint8Array>;

// The same code runs in Node and in the browser.
export class DemoRenderer {
  readonly book: FontBook;

  private constructor(book: FontBook) {
    this.book = book;
  }

  static async create(readFont: FontReader): Promise<DemoRenderer> {
    const book = new FontBook();
    for (const { file, face } of FONT_FILES) book.add(face, await readFont(file));
    installHarfBuzzMeasurer(book, { locale: "en" });
    return new DemoRenderer(book);
  }

  layout(job: RenderJob): TextLayout {
    const maxWidth = job.mode === "fixed" ? job.width : Number.POSITIVE_INFINITY;
    return layOutText(this.book, parseRichText(job.text), TEXT_STYLE, maxWidth);
  }

  render(job: RenderJob): RenderResult {
    const layout = this.layout(job);
    return {
      svg: renderSceneSvg(layout, job),
      numbers: JSON.stringify(layout.lines.map((line) => [line.width, line.baseline, ...line.runs.flatMap((run) => [run.x, run.width])])),
    };
  }
}

export function jobKey(job: RenderJob): string {
  return JSON.stringify([job.text, job.mode, job.width]);
}
