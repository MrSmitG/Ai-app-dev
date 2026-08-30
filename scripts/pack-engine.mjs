#!/usr/bin/env node
/**
 * Copy the engine + production deps into build/engine-pack for electron-builder.
 * Installers then ship a self-contained sidecar (no system Node or npm required).
 */
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "build", "engine-pack");
const src = path.join(root, "packages", "engine", "src");

rmSync(dest, { recursive: true, force: true });
mkdirSync(path.join(dest, "src"), { recursive: true });
cpSync(src, path.join(dest, "src"), { recursive: true });

const enginePkg = JSON.parse(readFileSync(path.join(root, "packages", "engine", "package.json"), "utf8"));
const rootPkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const packed = {
  name: "@localmod/engine",
  version: enginePkg.version || rootPkg.version,
  type: "module",
  main: "src/index.js",
  dependencies: {
    ...(enginePkg.dependencies || {}),
    "@cursor/sdk": rootPkg.dependencies?.["@cursor/sdk"] || "^1.0.28",
  },
};
writeFileSync(path.join(dest, "package.json"), JSON.stringify(packed, null, 2));

console.log("Installing engine production dependencies into build/engine-pack …");
execSync("npm install --omit=dev --no-fund --no-audit", {
  cwd: dest,
  stdio: "inherit",
  env: { ...process.env, npm_config_update_notifier: "false" },
});

if (!existsSync(path.join(dest, "src", "index.js"))) {
  throw new Error("Engine pack is missing src/index.js");
}
console.log("Engine pack ready:", dest);
