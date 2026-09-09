#!/usr/bin/env node
/** Start one Localmod React app (engine + this app's Vite). Start another the same way. */
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const APPS = [
  { id: "blackwhale", name: "Blackwhale", folder: "apps/blackwhale", port: 1421, aliases: ["studio", "chat"] },
  { id: "nightweaver", name: "Nightweaver", folder: "apps/nightweaver", port: 1422, aliases: ["code", "current"] },
  { id: "obsidian", name: "Obsidian", folder: "apps/obsidian", port: 1423, aliases: ["keys", "keyring"] },
  { id: "mako", name: "Mako", folder: "apps/mako", port: 1424, aliases: ["fast", "pulse"] },
  { id: "trench", name: "The Trench", folder: "apps/trench", port: 1425, aliases: ["editor", "keep"] },
  { id: "ironmantis", name: "Ironmantis", folder: "apps/ironmantis", port: 1426, aliases: ["engineer", "hands"] },
];

const id = String(process.argv[2] || "").toLowerCase();
const app = APPS.find((a) => a.id === id || a.aliases.includes(id));
if (!app) {
  console.error("Start one of:", APPS.map((a) => a.id).join(" | "));
  process.exit(1);
}

function portOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host }, () => {
      sock.end();
      resolve(true);
    });
    sock.on("error", () => resolve(false));
  });
}

async function waitPort(port, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

if (!(await portOpen(4781))) {
  console.log("Starting Localmod engine on 127.0.0.1:4781 …");
  const eng = spawn("node", ["packages/engine/src/index.js"], {
    cwd: repo,
    detached: true,
    stdio: "ignore",
  });
  eng.unref();
  if (!(await waitPort(4781))) {
    console.error("Engine did not start.");
    process.exit(1);
  }
} else {
  console.log("Engine already on 127.0.0.1:4781");
}

const dir = path.join(repo, app.folder);
console.log(`Starting ${app.name} → http://127.0.0.1:${app.port}`);
console.log(
  `Start another when you want: ${APPS.filter((a) => a.id !== app.id)
    .map((a) => `npm run ${a.id}`)
    .join(" · ")}`
);

const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(app.port), "--strictPort"], {
  cwd: dir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (await waitPort(app.port, 40000)) {
  const url = `http://127.0.0.1:${app.port}`;
  if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore" });
  else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore" });
  else spawn("xdg-open", [url], { stdio: "ignore" });
}

vite.on("exit", (code) => process.exit(code ?? 0));
