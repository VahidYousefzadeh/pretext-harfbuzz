import { jobKey, type RenderJob, type RenderResult } from "./renderer.ts";

export type NodeAnswer = {
  /** undefined when Node has no answer (the static site only has the starting text). */
  readonly results: readonly (RenderResult | undefined)[];
  /** false when the answers come from the build. */
  readonly live: boolean;
};

let buildAnswers: Promise<Record<string, RenderResult> | null> | null = null;

// In dev, a fresh Node process lays out the jobs (see vite.config.ts).
// The static site has no server, so it ships Node's answer for the starting text instead.
export async function askNode(jobs: readonly RenderJob[]): Promise<NodeAnswer> {
  if (import.meta.env.DEV) {
    const response = await fetch("api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(jobs),
    });
    if (!response.ok) throw new Error(await response.text());
    return { results: (await response.json()) as RenderResult[], live: true };
  }

  buildAnswers ??= fetch(`${import.meta.env.BASE_URL}node-results.json`).then(
    (r) => (r.ok ? (r.json() as Promise<Record<string, RenderResult>>) : null),
    () => null,
  );
  const answers = await buildAnswers;
  return { results: jobs.map((job) => answers?.[jobKey(job)]), live: false };
}
