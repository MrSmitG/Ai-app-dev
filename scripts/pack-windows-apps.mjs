#!/usr/bin/env node
/** After a Windows electron-builder run, emit one Setup.exe per React app. */
import { cpSync, existsSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpacked = path.join(root, "release", "win-unpacked");

const APPS = [
  { id: "blackwhale", name: "Blackwhale", product: "Blackwhale" },
  { id: "nightweaver", name: "Nightweaver", product: "Nightweaver" },
  { id: "obsidian", name: "Obsidian", product: "Obsidian" },
  { id: "mako", name: "Mako", product: "Mako" },
  { id: "trench", name: "The Trench", product: "Trench" },
  { id: "ironmantis", name: "Ironmantis", product: "Ironmantis" },
];

if (process.platform !== "win32") {
  console.log("Skipping per-app Windows setups (not Windows).");
  process.exit(0);
}

if (!existsSync(unpacked)) {
  console.error("release/win-unpacked is missing. Run npm run build:win first.");
  process.exit(1);
}

const localmodExe = existsSync(path.join(unpacked, "Localmod.exe"))
  ? "Localmod.exe"
  : readdirSync(unpacked).find((n) => n.endsWith(".exe"));
if (!localmodExe) {
  console.error("No .exe in release/win-unpacked.");
  process.exit(1);
}

const builderJs = [
  path.join(root, "node_modules", "electron-builder", "cli.js"),
  path.join(root, "node_modules", "electron-builder", "out", "cli", "cli.js"),
].find((p) => existsSync(p));
if (!builderJs) {
  console.error("electron-builder CLI not found. Run npm install.");
  process.exit(1);
}

for (const app of APPS) {
  const dir = path.join(root, "release", `win-${app.id}`);
  console.log(`\nPacking ${app.product}-Setup.exe …`);
  rmSync(dir, { recursive: true, force: true });
  cpSync(unpacked, dir, { recursive: true });
  writeFileSync(path.join(dir, "resources", "suite-app.txt"), `${app.id}\n`);
  const fromExe = path.join(dir, localmodExe);
  const toExe = path.join(dir, `${app.product}.exe`);
  if (fromExe !== toExe && existsSync(fromExe)) renameSync(fromExe, toExe);

  const cfgPath = path.join(root, "release", `electron-builder-${app.id}.json`);
  writeFileSync(
    cfgPath,
    JSON.stringify(
      {
        appId: `com.localmod.${app.id}`,
        productName: app.product,
        executableName: app.product,
        copyright: "Copyright © Localmod",
        directories: { output: "release", buildResources: "apps/desktop/build" },
        nsis: {
          oneClick: true,
          createDesktopShortcut: true,
          createStartMenuShortcut: true,
          shortcutName: app.name,
          uninstallDisplayName: app.name,
          artifactName: `${app.product}-Setup.exe`,
        },
        win: { target: ["nsis"] },
      },
      null,
      2
    )
  );

  const r = spawnSync(process.execPath, [builderJs, "--prepackaged", dir, "--win", "nsis", "--config", cfgPath, "--publish", "never"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) process.exit(r.status || 1);
  console.log("Wrote", path.join("release", `${app.product}-Setup.exe`));
}

console.log("\nPer-app Windows setups:");
for (const app of APPS) console.log(`  release/${app.product}-Setup.exe`);
