import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getSettings } from "./settings.js";
import { dataDir } from "./paths.js";

let child = null;
let lastArgs = [];

function resolveLlamaBinary() {
  const settings = getSettings();
  const candidates = [
    settings.llamaServerPath,
    process.env.LOCALMOD_LLAMA,
    "llama-server",
    "llama-server.exe",
    path.join(dataDir(), "bin", process.platform === "win32" ? "llama-server.exe" : "llama-server"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (c === "llama-server" || c === "llama-server.exe") return c;
    if (fs.existsSync(c)) return c;
  }
  return "llama-server";
}

export function inferenceStatus() {
  return {
    running: Boolean(child && !child.killed),
    pid: child?.pid || null,
    args: lastArgs,
    host: getSettings().llamaHost,
    port: getSettings().llamaPort,
    model: getSettings().loadedModel,
    gpuLayers: getSettings().gpuLayers,
    backend: process.platform === "darwin" ? "metal" : "cuda-or-vulkan-or-cpu",
  };
}

export async function startInference({ modelPath } = {}) {
  const s = getSettings();
  const model = modelPath || s.loadedModel;
  if (!model) throw new Error("No model selected");
  if (!fs.existsSync(model)) throw new Error(`Model not found: ${model}`);
  await stopInference();
  const bin = resolveLlamaBinary();
  const args = [
    "--host",
    s.llamaHost,
    "--port",
    String(s.llamaPort),
    "-m",
    model,
    "-c",
    String(s.contextLength),
    "-ngl",
    String(s.gpuLayers),
    "--jinja",
  ];
  if (s.threads) args.push("-t", String(s.threads));
  lastArgs = [bin, ...args];
  child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  const log = path.join(dataDir(), "logs", "llama-server.log");
  const out = fs.createWriteStream(log, { flags: "a" });
  child.stdout?.pipe(out);
  child.stderr?.pipe(out);
  child.on("exit", () => {
    child = null;
  });
  await waitForServer(`http://${s.llamaHost}:${s.llamaPort}/health`, 20000);
  return inferenceStatus();
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status === 503) return;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(
    "llama-server did not become ready. Install llama.cpp llama-server, set its path in Settings, or use the Ollama sidecar."
  );
}

export async function stopInference() {
  if (!child) return inferenceStatus();
  child.kill();
  child = null;
  return inferenceStatus();
}

export function llamaBase() {
  const s = getSettings();
  return `http://${s.llamaHost}:${s.llamaPort}`;
}
