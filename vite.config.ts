import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const renderScript = fileURLToPath(new URL("./scripts/render.ts", import.meta.url));

// POST /api/render lays out the jobs in a fresh Node process, so the page can compare its result with Node's.
function nodeRenderEndpoint(): Plugin {
  return {
    name: "node-render-endpoint",
    configureServer(server) {
      server.middlewares.use("/api/render", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => (body += chunk));
        req.on("end", () => {
          renderInNode(body).then(
            (results) => {
              res.setHeader("content-type", "application/json");
              res.end(results);
            },
            (error: unknown) => {
              res.statusCode = 500;
              res.end(String(error));
            },
          );
        });
      });
    },
  };
}

function renderInNode(jobs: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [renderScript, "--json"]);
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (out += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || `node exited with ${code}`))));
    child.stdin.end(jobs);
  });
}

export default defineConfig({
  // Relative paths, so the built site works from any folder (like GitHub Pages).
  base: "./",
  plugins: [nodeRenderEndpoint()],
  // harfbuzzjs loads its .wasm file from next to itself, and pre-bundling breaks that.
  optimizeDeps: { exclude: ["harfbuzzjs"] },
  // dist/ is taken by the library build. Safari 15 (iPhone 7's last iOS) cannot parse class static blocks.
  build: { target: ["chrome87", "edge88", "firefox78", "safari15"], outDir: "site" },
  server: { port: 5207, strictPort: true },
});
