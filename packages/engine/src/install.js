import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { pickFolder } from "./pickFolder.js";
import { SUITE_APPS } from "./suite.js";

const SKIP = new Set(["node_modules", ".git", "dist", "release", "build", "squashfs-root", "coverage"]);

export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

const TREE = [
  "package.json",
  "package-lock.json",
  "README.md",
  "AGENTS.md",
  "LICENSE",
  "Start Localmod.bat",
  "Start Localmod.command",
  "Start Localmod.sh",
  "scripts",
  "apps/desktop/package.json",
  "apps/desktop/package-lock.json",
  "apps/desktop/app",
  "apps/desktop/src",
  "apps/desktop/electron",
  "apps/desktop/electron-builder.yml",
  "apps/desktop/react-router.config.ts",
  "apps/desktop/vite.config.ts",
  "apps/desktop/tsconfig.json",
  "apps/blackwhale",
  "apps/nightweaver",
  "apps/obsidian",
  "apps/mako",
  "apps/trench",
  "apps/ironmantis",
  "apps/keep",
  "apps/hands",
  "apps/cli",
  "packages/engine/src",
  "packages/engine/package.json",
];

export function installManifest() {
  return {
    product: "Localmod",
    platforms: ["windows", "mac"],
    apps: SUITE_APPS.map((a) => ({ id: a.id, name: a.name, folder: a.folder, route: a.route })),
    files: TREE,
    downloads: {
      windows: "https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.exe",
      mac: "https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.dmg",
      linux: "https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.AppImage",
    },
  };
}

export async function pickInstallDir() {
  const selected = await pickFolder("Choose where to install Localmod (Mac or Windows folder)");
  if (!selected) return { cancelled: true, path: "" };
  return { cancelled: false, path: selected };
}

function assertDest(dest) {
  const resolved = path.resolve(String(dest || "").trim());
  if (!resolved || resolved === "/" || resolved === path.parse(resolved).root) {
    throw new Error("Pick a real folder, not a drive root.");
  }
  const home = os.homedir();
  const tmp = os.tmpdir();
  if (!resolved.startsWith(home) && !resolved.startsWith(tmp) && !resolved.startsWith(repoRoot())) {
    /* allow user-picked project disks on Windows (D:\Apps) */
    if (!/^[A-Za-z]:\\/.test(resolved) && !resolved.startsWith("/Users/") && !resolved.startsWith("/home/")) {
      throw new Error("Install path must be a folder you own (home, project disk, or this repo).");
    }
  }
  return resolved;
}

function copyFiltered(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (SKIP.has(name) || name.endsWith(".asar")) continue;
      copyFiltered(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function copyFiles(dest) {
  const root = repoRoot();
  const target = path.join(assertDest(dest), "Localmod");
  fs.mkdirSync(target, { recursive: true });
  const copied = [];
  for (const rel of TREE) {
    const from = path.join(root, rel);
    if (!fs.existsSync(from)) continue;
    copyFiltered(from, path.join(target, rel));
    copied.push(rel);
  }
  const readme = `Localmod — React suite (Windows + macOS)
Installed: ${new Date().toISOString()}
Folder: ${target}

Run:
  Windows: double-click "Start Localmod.bat"
  macOS:   double-click "Start Localmod.command"

Apps (open after start):
${SUITE_APPS.map((a) => `  ${a.name}  →  ${a.route}`).join("\n")}

Or download the ready-to-run binary into this folder from GitHub Releases
(Localmod.exe on Windows, Localmod.dmg on Mac).
`;
  fs.writeFileSync(path.join(target, "INSTALLED.txt"), readme);
  copied.push("INSTALLED.txt");
  return { dest: target, copied, count: copied.length };
}

export async function downloadBinary(dest, platform) {
  const target = assertDest(dest);
  fs.mkdirSync(target, { recursive: true });
  const files = {
    windows: { name: "Localmod.exe", url: installManifest().downloads.windows },
    mac: { name: "Localmod.dmg", url: installManifest().downloads.mac },
    linux: { name: "Localmod.AppImage", url: installManifest().downloads.linux },
  };
  const spec = files[platform] || files.windows;
  const out = path.join(target, spec.name);
  const res = await fetch(spec.url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${spec.name}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  if (platform !== "windows") {
    try {
      fs.chmodSync(out, 0o755);
    } catch {
      /* ignore */
    }
  }
  return { dest: target, file: out, bytes: buf.length, name: spec.name };
}

export async function install({ dest, mode = "files", platform }) {
  if (mode === "windows" || platform === "windows") return downloadBinary(dest, "windows");
  if (mode === "mac" || platform === "mac") return downloadBinary(dest, "mac");
  if (mode === "linux" || platform === "linux") return downloadBinary(dest, "linux");
  return copyFiles(dest);
}
