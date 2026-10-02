import { TEXT_STYLE, type RenderJob } from "./renderer.ts";
import { parseRichText } from "./richText.ts";
import { TEXT_ORIGIN } from "./scene.ts";

// The same text as plain HTML, so the browser lays it out itself. Used by the Browser and Both views.
export function addBrowserText(svg: SVGSVGElement, job: RenderJob): void {
  const fixed = job.mode === "fixed";
  const text = document.createElement("div");
  text.className = "browser-text";
  text.style.cssText =
    `font:400 ${TEXT_STYLE.sizePx}px/${TEXT_STYLE.lineHeightPx}px "${TEXT_STYLE.family}";` +
    `width:${fixed ? `${job.width}px` : "max-content"};white-space:${fixed ? "normal" : "nowrap"};overflow-wrap:break-word;`;
  for (const paragraph of parseRichText(job.text)) {
    const block = text.appendChild(document.createElement("div"));
    for (const run of paragraph) {
      const span = block.appendChild(document.createElement("span"));
      span.textContent = run.text;
      if (run.bold) span.style.fontWeight = "700";
      if (run.italic) span.style.fontStyle = "italic";
    }
    if (block.textContent?.trim() === "") block.append(document.createElement("br"));
  }

  const view = svg.viewBox.baseVal;
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  layer.setAttribute("x", String(TEXT_ORIGIN.x));
  layer.setAttribute("y", String(TEXT_ORIGIN.y));
  layer.setAttribute("width", String(view.width - TEXT_ORIGIN.x));
  layer.setAttribute("height", String(view.height - TEXT_ORIGIN.y));
  layer.append(text);
  svg.append(layer);
}
