import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getSettings, patchSettings } from "./settings.js";
import { dataDir } from "./paths.js";
import { hardwareSnapshot, fitEstimate } from "./hardware.js";

let child = null;
let lastArgs = [];
let startedAt = null;

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

function detectQuant(name) {
  const m = String(name || "")
    .toUpperCase()
    .match(/Q[2-8]_[K0-9M]+|IQ\d_\w+|F16|F32|BF16/);
  return m ? m[0] : "unknown";
}

export function modelInfo(filePath) {
  const p = filePath || getSettings().loadedModel;
  if (!p || !fs.existsSync(p)) {
    return { path: p || "", exists: false };
  }
  const st = fs.statSync(p);
  return {
    path: p,
    exists: true,
    name: path.basename(p),
    size: st.size,
    sizeMb: Math.round(st.size / 1024 / 1024),
    mtime: st.mtimeMs,
    quant: detectQuant(path.basename(p)),
  };
}

export async function loadEstimate(modelPath) {
  const s = getSettings();
  const info = modelInfo(modelPath || s.loadedModel);
  const hw = await hardwareSnapshot();
  if (!info.exists) return { info, hw, fit: null };
  const fit = fitEstimate({
    fileSizeBytes: info.size,
    ramTotalMb: hw.ramTotalMb,
    vramTotalMb: hw.vramTotalMb,
    gpuLayers: s.gpuLayers,
  });
  const suggestedNgl =
    hw.vramTotalMb >= 16000 ? 99 : hw.vramTotalMb >= 8000 ? 35 : hw.vramTotalMb >= 4000 ? 20 : 0;
  return { info, hw, fit, suggestedNgl };
}

export function inferenceStatus() {
  const s = getSettings();
  return {
    running: Boolean(child && !child.killed),
    pid: child?.pid || null,
    args: lastArgs,
    host: s.llamaHost,
    port: s.llamaPort,
    model: s.loadedModel,
    gpuLayers: s.gpuLayers,
    contextLength: s.contextLength,
    provider: s.provider || "llama",
    flashAttention: !!s.flashAttention,
    startedAt,
    uptimeMs: startedAt ? Date.now() - startedAt : 0,
    backend: process.platform === "darwin" ? "metal" : "cuda-or-vulkan-or-cpu",
    modelMeta: modelInfo(s.loadedModel),
  };
}

export async function startInference({ modelPath } = {}) {
  const s = getSettings();
  const model = modelPath || s.loadedModel;
  if (!model) throw new Error("No model selected");
  if (!fs.existsSync(model)) throw new Error(`Model not found: ${model}`);
  if (modelPath) patchSettings({ loadedModel: modelPath });
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
    "-b",
    String(s.batchSize || 512),
    "-ub",
    String(s.ubatchSize || 512),
    "-np",
    String(s.parallelSlots || 1),
    "--jinja",
  ];
  if (s.threads) args.push("-t", String(s.threads));
  if (s.threadsBatch) args.push("-tb", String(s.threadsBatch));
  if (s.mainGpu != null && s.mainGpu !== "") args.push("--main-gpu", String(s.mainGpu));
  if (s.tensorSplit) args.push("--tensor-split", String(s.tensorSplit));
  if (s.flashAttention) args.push("-fa", "on");
  if (s.mlock) args.push("--mlock");
  if (s.noMmap) args.push("--no-mmap");
  if (s.contBatching) args.push("--cont-batching");
  if (s.cacheTypeK && s.cacheTypeK !== "f16") args.push("-ctk", String(s.cacheTypeK));
  if (s.cacheTypeV && s.cacheTypeV !== "f16") args.push("-ctv", String(s.cacheTypeV));
  if (s.ropeFreqBase > 0) args.push("--rope-freq-base", String(s.ropeFreqBase));
  if (s.ropeFreqScale > 0) args.push("--rope-freq-scale", String(s.ropeFreqScale));

  lastArgs = [bin, ...args];
  child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  startedAt = Date.now();
  const log = path.join(dataDir(), "logs", "llama-server.log");
  fs.mkdirSync(path.dirname(log), { recursive: true });
  const out = fs.createWriteStream(log, { flags: "a" });
  child.stdout?.pipe(out);
  child.stderr?.pipe(out);
  child.on("exit", () => {
    child = null;
    startedAt = null;
  });
  await waitForServer(`http://${s.llamaHost}:${s.llamaPort}/health`, 45000);
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
    "llama-server did not become ready. Install llama.cpp llama-server, set its path in LLM settings, or use Ollama as provider."
  );
}

export async function stopInference() {
  if (!child) return inferenceStatus();
  child.kill();
  child = null;
  startedAt = null;
  return inferenceStatus();
}

export async function reloadInference() {
  const s = getSettings();
  if (!s.loadedModel) throw new Error("No model loaded");
  return startInference({ modelPath: s.loadedModel });
}

export function llamaBase() {
  const s = getSettings();
  return `http://${s.llamaHost}:${s.llamaPort}`;
}
