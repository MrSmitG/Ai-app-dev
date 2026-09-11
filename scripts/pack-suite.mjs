#!/usr/bin/env node
/** Production-build the six React apps into build/suite-pack for the desktop installer. */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "build", "suite-pack");
const APPS = ["blackwhale", "nightweaver", "obsidian", "mako", "trench", "ironmantis"];

const check = spawnSync(process.execPath, [path.join(root, "scripts", "check-suite-setup.mjs"), "--build"], {
  cwd: root,
  stdio: "inherit",
});
if (check.status !== 0) process.exit(check.status || 1);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const id of APPS) {
  const dist = path.join(root, "apps", id, "dist");
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error(`Missing ${id} dist/index.html`);
  }
  cpSync(dist, path.join(dest, id), { recursive: true });
  console.log("packed", id);
}
console.log("Suite pack ready:", dest);
