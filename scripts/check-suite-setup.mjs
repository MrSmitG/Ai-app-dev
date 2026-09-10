#!/usr/bin/env node
/** Confirm the six React apps are complete, then optionally production-build them. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = process.argv.includes("--build");

const APPS = [
  { id: "blackwhale", name: "Blackwhale", folder: "apps/blackwhale", port: 1421 },
  { id: "nightweaver", name: "Nightweaver", folder: "apps/nightweaver", port: 1422 },
  { id: "obsidian", name: "Obsidian", folder: "apps/obsidian", port: 1423 },
  { id: "mako", name: "Mako", folder: "apps/mako", port: 1424 },
  { id: "trench", name: "The Trench", folder: "apps/trench", port: 1425 },
  { id: "ironmantis", name: "Ironmantis", folder: "apps/ironmantis", port: 1426 },
];

const FILES = [
  "package.json",
  "vite.config.ts",
  "index.html",
  "tsconfig.json",
  "README.md",
  "Start-Windows.bat",
  "Start-macOS.command",
  "Start-Linux.sh",
  "Install-Windows.bat",
  "Install-Android.bat",
  "src/App.tsx",
  "src/main.tsx",
  "src/styles.css",
  "src/engine.ts",
  "src/vite-env.d.ts",
];

let missing = 0;
for (const app of APPS) {
  for (const rel of FILES) {
    const p = path.join(repo, app.folder, rel);
    if (!fs.existsSync(p)) {
      console.error(`missing ${app.folder}/${rel}`);
      missing++;
    }
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, app.folder, "package.json"), "utf8"));
  if (!pkg.scripts?.start) {
    console.error(`${app.id} package.json has no start script`);
    missing++;
  }
}

const rootPkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
for (const app of APPS) {
  if (rootPkg.scripts?.[app.id] !== `node scripts/start-suite-app.mjs ${app.id}`) {
    console.error(`root package.json missing npm run ${app.id}`);
    missing++;
  }
}

const viteJs = path.join(repo, "node_modules", "vite", "bin", "vite.js");
if (build && !fs.existsSync(viteJs)) {
  console.error("Run npm install at the repo root before --build.");
  process.exit(1);
}

if (missing) {
  console.error(`setup check failed: ${missing} problem(s)`);
  process.exit(1);
}

console.log("Six React apps are complete:");
for (const app of APPS) {
  console.log(`  ${app.name.padEnd(14)}  npm run ${app.id.padEnd(12)}  http://127.0.0.1:${app.port}`);
}

if (!build) process.exit(0);

for (const app of APPS) {
  console.log(`\nbuild ${app.id}`);
  const r = spawnSync(process.execPath, [viteJs, "build"], {
    cwd: path.join(repo, app.folder),
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status || 1);
}

console.log("\nAll six apps built.");
