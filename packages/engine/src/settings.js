import { readJson, writeJson, settingsPath } from "./paths.js";

const DEFAULTS = {
  airplane: false,
  provider: "llama",
  llamaServerPath: "",
  llamaHost: "127.0.0.1",
  llamaPort: 8080,
  gpuLayers: 20,
  mainGpu: 0,
  tensorSplit: "",
  threads: 0,
  threadsBatch: 0,
  batchSize: 512,
  ubatchSize: 512,
  contextLength: 4096,
  parallelSlots: 1,
  contBatching: true,
  flashAttention: true,
  mlock: false,
  noMmap: false,
  cacheTypeK: "f16",
  cacheTypeV: "f16",
  ropeFreqBase: 0,
  ropeFreqScale: 0,
  temperature: 0.7,
  topP: 0.95,
  topK: 40,
  minP: 0.05,
  typicalP: 1,
  repeatPenalty: 1.1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  mirostat: 0,
  mirostatTau: 5,
  mirostatEta: 0.1,
  seed: -1,
  maxTokens: -1,
  stopSequences: "",
  keepModelLoaded: true,
  streamChat: true,
  speculative: false,
  draftModel: "",
  systemPrompt: "You are a local assistant running on the user's machine. Be precise.",
  loadedModel: "",
  libraryPath: "",
  apiPort: 4782,
  apiBindLan: false,
  apiKey: "",
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaKeepAlive: "5m",
  hfToken: "",
  preset: "balanced",
  autotune: false,
  cursorApiKey: "",
  cursorModel: "composer-2.5",
  cursorCwd: "",
  cursorRuntime: "local",
  cursorCloudRepo: "",
  activeSkillId: "",
  voiceTranscribeMode: "webspeech",
  voiceOutputMode: "fill",
  voiceLang: "en-US",
  whisperCliPath: "",
  whisperModel: "",
  /** Smart context: keep headroom for the reply */
  contextReserveTokens: 1024,
  /** How many recent turns to prefer before compacting older ones */
  contextKeepRecent: 24,
  /** Compact older messages into a summary instead of truncating silently */
  contextCompact: true,
  /** Approximate tokens charged per attached image */
  imageTokenCost: 768,
  /** Send image parts to vision-capable backends */
  visionEnabled: true,
  /** Max images on a single user turn */
  maxImagesPerTurn: 8,
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
  quality: {
    temperature: 0.4,
    topP: 0.9,
    topK: 40,
    minP: 0.05,
    repeatPenalty: 1.08,
    gpuLayers: 99,
    contextLength: 8192,
    flashAttention: true,
    batchSize: 512,
  },
  balanced: {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    minP: 0.05,
    repeatPenalty: 1.1,
    gpuLayers: 20,
    contextLength: 4096,
    flashAttention: true,
    batchSize: 512,
  },
  creative: {
    temperature: 1.1,
    topP: 0.98,
    topK: 80,
    minP: 0.02,
    repeatPenalty: 1.05,
    gpuLayers: 40,
    contextLength: 4096,
  },
  precise: {
    temperature: 0.2,
    topP: 0.85,
    topK: 20,
    minP: 0.1,
    repeatPenalty: 1.15,
    gpuLayers: 99,
    contextLength: 8192,
  },
  cpu: {
    temperature: 0.7,
    topP: 0.9,
    topK: 30,
    gpuLayers: 0,
    contextLength: 2048,
    batchSize: 256,
    flashAttention: false,
    mlock: false,
  },
  longctx: {
    temperature: 0.5,
    topP: 0.95,
    topK: 40,
    gpuLayers: 40,
    contextLength: 32768,
    flashAttention: true,
    cacheTypeK: "q8_0",
    cacheTypeV: "q8_0",
  },
};

export function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) throw new Error("Unknown preset");
  return patchSettings({ ...p, preset: name });
}

export { DEFAULTS };
