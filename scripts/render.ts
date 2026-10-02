// The demo in plain Node, with no browser, no DOM and no canvas.
//
//   node scripts/render.ts "Some **rich** text" 240 > box.svg   wrap at 240px
//   node scripts/render.ts "Grows sideways" > box.svg           auto width
//   node scripts/render.ts --json < jobs.json                    used by the dev server
//   node scripts/render.ts --answers public/node-results.json    used by the static build
import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_JOB, DemoRenderer, FONT_FILES, jobKey, type RenderJob } from "../demo/renderer.ts";
import { parseRichText } from "../demo/richText.ts";

const fonts = new URL("../public/fonts/", import.meta.url);
const renderer = await DemoRenderer.create((file) => readFile(new URL(file, fonts)));

const [command, argument] = process.argv.slice(2);
if (command === "--json") {
  const jobs = JSON.parse(await readStdin()) as RenderJob[];
  process.stdout.write(JSON.stringify(jobs.map((job) => renderer.render(job))));
} else if (command === "--answers") {
  if (argument === undefined) throw new Error("Usage: node scripts/render.ts --answers <output.json>");
  await writeFile(argument, JSON.stringify({ [jobKey(DEFAULT_JOB)]: renderer.render(DEFAULT_JOB) }));
  console.log(`Wrote Node's answer for the starting text to ${argument}`);
} else {
  const text = command ?? "Hello from Node: no browser, no canvas.";
  const job: RenderJob = argument === undefined ? { text, mode: "auto", width: 0 } : { text, mode: "fixed", width: Number(argument) };
  process.stdout.write(`${await withEmbeddedFonts(renderer.render(job).svg, job)}\n`);
}

// Embed the fonts the text uses, so the SVG looks right in any viewer.
async function withEmbeddedFonts(svg: string, job: RenderJob): Promise<string> {
  const styles = new Set(parseRichText(job.text).flat().map((run) => `${run.bold ? 700 : 400} ${run.italic ? "italic" : "normal"}`));
  const used = FONT_FILES.filter(({ face }) => styles.has(`${face.weight ?? 400} ${face.style ?? "normal"}`));
  const rules = await Promise.all(
    used.map(async ({ file, face }) => {
      const base64 = (await readFile(new URL(file, fonts))).toString("base64");
      return `@font-face{font-family:"${face.family}";font-weight:${face.weight ?? 400};font-style:${face.style ?? "normal"};src:url(data:font/ttf;base64,${base64})}`;
    }),
  );
  return svg.replace("<style>", `<style>${rules.join("")}`);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}
