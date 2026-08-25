import { readJson, writeJson, settingsPath } from "./paths.js";

const DEFAULTS = {
  airplane: false,
  llamaServerPath: "",
  llamaHost: "127.0.0.1",
  llamaPort: 8080,
  gpuLayers: 20,
  threads: 0,
  contextLength: 4096,
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  minP: 0.05,
  repeatPenalty: 1.1,
  seed: -1,
  systemPrompt: "You are a local assistant running on the user's machine. Be precise.",
  loadedModel: "",
  libraryPath: "",
  apiPort: 4782,
  apiBindLan: false,
  apiKey: "",
  ollamaUrl: "http://127.0.0.1:11434",
  hfToken: "",
  preset: "balanced",
  autotune: false,
};

export function getSettings() {
  return { ...DEFAULTS, ...readJson(settingsPath(), {}) };
}

export function patchSettings(partial) {
  const next = { ...getSettings(), ...partial };
  writeJson(settingsPath(), next);
  return next;
}

export const PRESETS = {
  quality: { temperature: 0.4, topP: 0.9, topK: 40, gpuLayers: 99, contextLength: 8192 },
  balanced: { temperature: 0.7, topP: 0.9, topK: 40, gpuLayers: 20, contextLength: 4096 },
  cpu: { temperature: 0.7, topP: 0.9, topK: 30, gpuLayers: 0, contextLength: 2048 },
  longctx: { temperature: 0.5, topP: 0.95, topK: 40, gpuLayers: 40, contextLength: 32768 },
};

export function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) throw new Error("Unknown preset");
  return patchSettings({ ...p, preset: name });
}
