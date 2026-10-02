import "./style.css";
import { addBrowserText } from "./browserText.ts";
import { askNode } from "./nodeResults.ts";
import { DEFAULT_JOB, DemoRenderer, FONT_FILES, type RenderJob, type RenderResult } from "./renderer.ts";

type View = "both" | "ours" | "browser";

const VIEW_NOTES: Record<View, string> = {
  both: "Black: placed by pretext + HarfBuzz. Red: the browser's own layout, on top.",
  ours: "SVG text: pretext + HarfBuzz place every run; the browser paints the letters.",
  browser: "Ordinary HTML text: the browser measures, wraps and draws it itself.",
};

const ui = {
  text: byId<HTMLTextAreaElement>("text"),
  width: byId<HTMLInputElement>("width"),
  widthOut: byId<HTMLOutputElement>("width-out"),
  widthField: byId<HTMLElement>("width-field"),
  modes: [...document.querySelectorAll<HTMLButtonElement>("[data-mode]")],
  views: [...document.querySelectorAll<HTMLButtonElement>("[data-view]")],
  viewNote: byId<HTMLElement>("view-note"),
  scene: byId<HTMLElement>("scene"),
  status: byId<HTMLElement>("node-check"),
};

// Fetch each font once. HarfBuzz and the browser's HTML copy use the same bytes.
const fontBytes = new Map<string, ArrayBuffer>();
for (const { file } of FONT_FILES) {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!response.ok) throw new Error(`Cannot load fonts/${file}`);
  fontBytes.set(file, await response.arrayBuffer());
}
const readFont = async (file: string): Promise<ArrayBuffer> => {
  const bytes = fontBytes.get(file);
  if (bytes === undefined) throw new Error(`Unknown font file ${file}`);
  return bytes;
};
const renderer = await DemoRenderer.create(readFont);
for (const { file, face } of FONT_FILES) {
  const fontFace = new FontFace(face.family, (await readFont(file)).slice(0), {
    weight: String(face.weight ?? 400),
    style: face.style ?? "normal",
  });
  document.fonts.add(await fontFace.load());
}

let job: RenderJob = DEFAULT_JOB;
// Debounce timer, and a counter so a slow Node answer can't overwrite a newer one.
let timer = 0;
let ticket = 0;

ui.text.value = job.text;
ui.width.value = String(job.width);
ui.text.addEventListener("input", () => update({ text: ui.text.value }));
ui.width.addEventListener("input", () => update({ width: Number(ui.width.value) }));
for (const button of ui.modes) {
  button.addEventListener("click", () => update({ mode: button.dataset.mode === "auto" ? "auto" : "fixed" }));
}
for (const button of ui.views) {
  button.addEventListener("click", () => showView(button.dataset.view as View));
}
showView("both");
update({});

function update(change: Partial<RenderJob>): void {
  job = { ...job, ...change };
  const result = renderer.render(job);
  ui.scene.innerHTML = result.svg;
  const svg = ui.scene.querySelector("svg");
  if (svg !== null) addBrowserText(svg, job);
  ui.widthOut.textContent = `${job.width} px`;
  ui.widthField.hidden = job.mode !== "fixed";
  for (const button of ui.modes) button.setAttribute("aria-checked", String(button.dataset.mode === job.mode));
  compareWithNode(job, result);
}

function showView(view: View): void {
  ui.scene.dataset.view = view;
  ui.viewNote.textContent = VIEW_NOTES[view];
  for (const button of ui.views) button.setAttribute("aria-checked", String(button.dataset.view === view));
}

// When typing pauses, ask Node for the same layout and compare.
function compareWithNode(asked: RenderJob, ours: RenderResult): void {
  const mine = ++ticket;
  window.clearTimeout(timer);
  showStatus("busy", "", "Checking against Node…");
  timer = window.setTimeout(async () => {
    try {
      const answer = await askNode([asked]);
      if (mine !== ticket) return;
      const theirs = answer.results[0];
      if (theirs === undefined) {
        showStatus("idle", "", "This page checked the starting text against Node. To check every edit live, run the demo locally.");
      } else if (theirs.svg === ours.svg && theirs.numbers === ours.numbers) {
        showStatus(
          "ok",
          "✓ Node got the identical layout",
          answer.live ? " with no browser, no DOM and no canvas." : " at build time, with no browser, no DOM and no canvas.",
        );
      } else {
        showStatus("bad", "✗ Node got a different layout.", "");
      }
    } catch (error) {
      if (mine === ticket) showStatus("bad", "✗ The Node check failed.", ` ${String(error)}`);
    }
  }, 250);
}

function showStatus(state: "busy" | "idle" | "ok" | "bad", lead: string, rest: string): void {
  const strong = document.createElement("strong");
  strong.textContent = lead;
  ui.status.dataset.state = state;
  ui.status.replaceChildren(strong, rest);
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing #${id}`);
  return element as T;
}
