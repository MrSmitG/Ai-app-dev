import path from "node:path";
import { getSettings, patchSettings } from "./settings.js";
import { hardwareSnapshot, fitEstimate } from "./hardware.js";
import { listLibrary, startDownload, downloadStatus } from "./hf.js";
import { activateSkill } from "./skills.js";
import { startApiServer, stopApiServer, apiStatus } from "./apiServer.js";
import { listCollections, createCollection } from "./rag.js";

/** Curated packs a user can turn on. Chat-model packs are exclusive. */
export const BUNDLE_CATALOG = [
  {
    id: "starter-3b",
    name: "Starter chat",
    tagline: "Fits laptops. Fast replies, modest quality.",
    blurb: "Llama 3.2 3B Instruct Q4 — the first model to load if you just want Chat to work.",
    category: "chat",
    exclusiveGroup: "chat-model",
    ramHintGb: 8,
    recommendedMaxRamGb: 16,
    settings: { provider: "llama", gpuLayers: 20, contextLength: 4096, preset: "balanced", visionEnabled: false },
    download: {
      repo: "bartowski/Llama-3.2-3B-Instruct-GGUF",
      file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
      sizeBytes: 2.0 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "everyday-7b",
    name: "Everyday 7B",
    tagline: "Daily driver for writing, code, and Q&A.",
    blurb: "Qwen 2.5 7B Instruct Q4. Needs ~8 GB RAM. Best default if your machine has 16 GB.",
    category: "chat",
    exclusiveGroup: "chat-model",
    ramHintGb: 16,
    recommendedMaxRamGb: 64,
    settings: { provider: "llama", gpuLayers: 35, contextLength: 8192, preset: "balanced", visionEnabled: false },
    download: {
      repo: "Qwen/Qwen2.5-7B-Instruct-GGUF",
      file: "qwen2.5-7b-instruct-q4_k_m.gguf",
      sizeBytes: 4.7 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "reasoning",
    name: "Reasoning",
    tagline: "Think-then-answer distill for harder problems.",
    blurb: "DeepSeek R1 distill 7B. Slower, better at stepwise reasoning and math.",
    category: "chat",
    exclusiveGroup: "chat-model",
    ramHintGb: 16,
    settings: { provider: "llama", gpuLayers: 35, contextLength: 8192, temperature: 0.6, preset: "quality" },
    skillId: "researcher",
    download: {
      repo: "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF",
      file: "DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf",
      sizeBytes: 4.7 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "vision",
    name: "Vision",
    tagline: "Chat with screenshots and photos.",
    blurb: "Qwen 2 VL 7B Instruct. Enables image attach in Chat. Needs a vision-capable GGUF.",
    category: "chat",
    exclusiveGroup: "chat-model",
    ramHintGb: 16,
    settings: { provider: "llama", visionEnabled: true, imageTokenCost: 768, gpuLayers: 28, contextLength: 4096 },
    download: {
      repo: "bartowski/Qwen2-VL-7B-Instruct-GGUF",
      file: "Qwen2-VL-7B-Instruct-Q4_K_M.gguf",
      sizeBytes: 5.2 * 1024 * 1024 * 1024,
    },
  },
  {
    id: "voice",
    name: "Voice",
    tagline: "Talk instead of type.",
    blurb: "Uses the browser speech engine by default. Point Whisper CLI in Options for fully offline transcription.",
    category: "voice",
    ramHintGb: 4,
    settings: { voiceTranscribeMode: "webspeech", voiceOutputMode: "fill", voiceLang: "en-US" },
  },
  {
    id: "rag",
    name: "Documents (RAG)",
    tagline: "Ground Chat in your files.",
    blurb: "Creates a collection if none exists and turns on Researcher skill so answers cite local docs.",
    category: "data",
    ramHintGb: 8,
    settings: { contextCompact: true },
    skillId: "researcher",
    ensureCollection: true,
  },
  {
    id: "agent",
    name: "Coding agent",
    tagline: "Workspace edits with the Forge agent.",
    blurb: "Enables the Agent tab workflow. Add an API key under Options → Agent if you have not already.",
    category: "agent",
    ramHintGb: 8,
    settings: { cursorRuntime: "local", cursorModel: "composer-2.5" },
    skillId: "craftsman",
  },
  {
    id: "privacy",
    name: "Privacy",
    tagline: "Stay on this machine.",
    blurb: "Airplane mode blocks Hugging Face. API stays on 127.0.0.1. Set a vault passphrase under Options → Privacy.",
    category: "privacy",
    ramHintGb: 0,
    settings: { airplane: true, apiBindLan: false },
  },
  {
    id: "local-api",
    name: "Local API",
    tagline: "OpenAI-style server for other apps.",
    blurb: "Starts the loopback API on the configured port (default 4782) so Continue, Cline, or curl can talk to Localmod.",
    category: "tools",
    ramHintGb: 4,
    settings: { apiBindLan: false, apiPort: 4782 },
    startApi: true,
  },
  {
    id: "ollama",
    name: "Ollama sidecar",
    tagline: "Use models already in Ollama.",
    blurb: "Switches Chat to the Ollama provider at 127.0.0.1:11434. Install Ollama separately, then Race in Tools.",
    category: "chat",
    exclusiveGroup: "chat-model",
    ramHintGb: 8,
    settings: { provider: "ollama", ollamaUrl: "http://127.0.0.1:11434" },
  },
];

function selectedIds() {
  const ids = getSettings().selectedBundleIds;
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
}

function findBundle(id) {
  const row = BUNDLE_CATALOG.find((b) => b.id === id);
  if (!row) throw new Error(`Unknown bundle: ${id}`);
  return row;
}

function libraryMatch(download) {
  if (!download) return null;
  const file = String(download.file || "").toLowerCase();
  const stem = path.basename(file, ".gguf").toLowerCase();
  return (
    listLibrary().find((m) => m.name.toLowerCase() === file) ||
    listLibrary().find((m) => m.name.toLowerCase().includes(stem.slice(0, 24))) ||
    null
  );
}

function downloadId(download) {
  return `${download.repo}:${download.file}`;
}

export async function listBundles() {
  const hw = await hardwareSnapshot();
  const selected = new Set(selectedIds());
  const dls = downloadStatus();
  const ramGb = (hw.ramTotalMb || 0) / 1024;
  return BUNDLE_CATALOG.map((b) => {
    const local = libraryMatch(b.download);
    const dl = b.download ? dls.find((d) => d.id === downloadId(b.download)) : null;
    const fit = b.download
      ? fitEstimate({
          fileSizeBytes: b.download.sizeBytes || 0,
          ramTotalMb: hw.ramTotalMb,
          vramTotalMb: hw.vramTotalMb,
          gpuLayers: b.settings?.gpuLayers ?? getSettings().gpuLayers,
        })
      : { fits: true, note: "No extra model download" };
    const recommended =
      ramGb + 0.01 >= (b.ramHintGb || 0) &&
      (!b.recommendedMaxRamGb || ramGb <= b.recommendedMaxRamGb);
    return {
      id: b.id,
      name: b.name,
      tagline: b.tagline,
      blurb: b.blurb,
      category: b.category,
      exclusiveGroup: b.exclusiveGroup || null,
      ramHintGb: b.ramHintGb,
      download: b.download
        ? { repo: b.download.repo, file: b.download.file, sizeBytes: b.download.sizeBytes }
        : null,
      selected: selected.has(b.id),
      recommended,
      fit,
      localModel: local ? { path: local.path, name: local.name, size: local.size, quant: local.quant } : null,
      downloadStatus: dl
        ? { id: dl.id, status: dl.status, received: dl.received, total: dl.total }
        : null,
      startApi: !!b.startApi,
      skillId: b.skillId || null,
    };
  });
}

export async function useBundle(id, { download = true } = {}) {
  const bundle = findBundle(id);
  let ids = selectedIds();
  if (bundle.exclusiveGroup) {
    const drop = new Set(
      BUNDLE_CATALOG.filter((b) => b.exclusiveGroup === bundle.exclusiveGroup && b.id !== bundle.id).map((b) => b.id)
    );
    ids = ids.filter((x) => !drop.has(x));
  }
  if (!ids.includes(bundle.id)) ids.push(bundle.id);

  const patch = { ...(bundle.settings || {}), selectedBundleIds: ids };
  const local = libraryMatch(bundle.download);
  if (local && bundle.category === "chat" && bundle.id !== "ollama") {
    patch.loadedModel = local.path;
  }
  patchSettings(patch);

  let skill = null;
  if (bundle.skillId) skill = activateSkill(bundle.skillId);

  let collection = null;
  if (bundle.ensureCollection) {
    const cols = listCollections();
    collection = cols[0] || createCollection("Bundle docs");
  }

  let api = null;
  if (bundle.startApi) api = startApiServer();

  let queued = null;
  if (download && bundle.download && !local && !getSettings().airplane) {
    try {
      queued = await startDownload({ repoId: bundle.download.repo, file: bundle.download.file });
    } catch (err) {
      queued = { error: String(err.message || err) };
    }
  }

  return {
    ok: true,
    bundle: bundle.id,
    selectedBundleIds: ids,
    settings: getSettings(),
    skill,
    collection,
    api,
    download: queued,
    localModel: local,
    airplaneBlockedDownload: Boolean(bundle.download && !local && getSettings().airplane),
  };
}

export function stopUsingBundle(id) {
  const bundle = findBundle(id);
  const ids = selectedIds().filter((x) => x !== id);
  const patch = { selectedBundleIds: ids };
  if (bundle.id === "privacy") patch.airplane = false;
  if (bundle.startApi) stopApiServer();
  patchSettings(patch);
  return { ok: true, selectedBundleIds: ids, api: apiStatus(), settings: getSettings() };
}

export async function setBundleEnabled(id, enabled, opts = {}) {
  return enabled ? useBundle(id, opts) : stopUsingBundle(id);
}
