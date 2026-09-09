#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUITE_APPS } from "../packages/engine/src/suite.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const app of SUITE_APPS) {
  const dir = path.join(repo, app.folder);
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: `@localmod/${app.id}`,
        private: true,
        version: "0.2.2",
        type: "module",
        description: `${app.name} — ${app.tagline}`,
        scripts: {
          start: "vite --host 127.0.0.1 --strictPort",
          dev: "vite --host 127.0.0.1 --strictPort",
        },
      },
      null,
      2
    ) + "\n"
  );
  fs.writeFileSync(
    path.join(dir, "vite.config.ts"),
    `import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const desktop = path.join(repo, "apps/desktop/src");

export default defineConfig({
  plugins: [react()],
  root: here,
  resolve: {
    alias: {
      "@": desktop,
      react: path.join(repo, "node_modules/react"),
      "react-dom": path.join(repo, "node_modules/react-dom"),
    },
  },
  server: {
    port: ${app.port},
    strictPort: true,
    host: "127.0.0.1",
    open: false,
    fs: { allow: [repo] },
    proxy: {
      "^/engine(/|$)": {
        target: "http://127.0.0.1:4781",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\\/engine/, "") || "/",
      },
    },
  },
});
`
  );
  fs.writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${app.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  );
  fs.writeFileSync(
    path.join(dir, "src/main.tsx"),
    `import { createRoot } from "react-dom/client";
import { StandaloneRoot } from "../../desktop/src/standalone/StandaloneRoot";
import "../../desktop/src/styles.css";

createRoot(document.getElementById("root")!).render(<StandaloneRoot appId="${app.id}" />);
`
  );
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM", "DOM.Iterable"],
          module: "ESNext",
          skipLibCheck: true,
          moduleResolution: "bundler",
          allowImportingTsExtensions: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx",
          strict: true,
          types: ["vite/client"],
        },
        include: ["src", "vite.config.ts"],
      },
      null,
      2
    ) + "\n"
  );
  fs.writeFileSync(
    path.join(dir, "Start-Windows.bat"),
    `@echo off\r
cd /d "%~dp0\\..\\.."\r
node scripts/start-suite-app.mjs ${app.id}\r
`
  );
  fs.writeFileSync(
    path.join(dir, "Start-macOS.command"),
    `#!/bin/bash
cd "$(dirname "$0")/../.."
node scripts/start-suite-app.mjs ${app.id}
`
  );
  fs.chmodSync(path.join(dir, "Start-macOS.command"), 0o755);
  fs.writeFileSync(
    path.join(dir, "README.md"),
    `# ${app.name}

${app.tagline}

${app.blurb}

This is a **standalone React app**. Start it by itself — then start the next one when you want.

## Start this app

From the repo root:

\`\`\`bash
${app.start}
\`\`\`

- Windows: double-click \`Start-Windows.bat\`
- macOS: double-click \`Start-macOS.command\`

Opens \`http://127.0.0.1:${app.port}\`. The shared engine stays on \`127.0.0.1:4781\`.

Then start another:

${SUITE_APPS.filter((a) => a.id !== app.id)
  .map((a) => `- \`${a.start}\` → ${a.name} (\`:${a.port}\`)`)
  .join("\n")}
`
  );
  console.log("wrote", app.folder);
}
