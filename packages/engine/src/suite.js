/** Localmod suite — named apps by usage (not competitor brands). */
import { getSettings } from "./settings.js";
import { inferenceStatus } from "./inference.js";
import { ollamaTags } from "./ollama.js";
import { apiStatus } from "./apiServer.js";
import { listProviders } from "./providers.js";

export const SUITE_APPS = [
  {
    id: "studio",
    name: "Studio",
    usage: "Chat & studio",
    tagline: "Local chat, models, RAG, voice, and bundles.",
    blurb: "The original Localmod surface: load a GGUF or Ollama tag, talk, pin context, and keep chats on this machine.",
    route: "/chat",
    group: "studio",
  },
  {
    id: "current",
    name: "Current",
    usage: "Agentic coding",
    tagline: "Deep repo context. Multi-file edits. Work beside you.",
    blurb: "Indexes the workspace, searches the tree, then proposes and applies coordinated edits across files. Built for agentic, multi-step coding — not single-line autocomplete.",
    route: "/current",
    group: "ide",
  },
  {
    id: "keyring",
    name: "Keyring",
    usage: "Bring your own keys",
    tagline: "Any provider. Your keys. No subscription lock-in.",
    blurb: "Point Localmod at llama-server, Ollama, OpenAI, Anthropic, OpenRouter, or a custom OpenAI-compatible base URL. Keys stay in ~/.localmod. Airplane mode still blocks the cloud.",
    route: "/keyring",
    group: "ide",
  },
  {
    id: "pulse",
    name: "Pulse",
    usage: "Speed",
    tagline: "Fast local path, optional cloud. Pick the lowest latency.",
    blurb: "Ping every connected backend, race the same prompt, and optionally auto-route to the quickest one. Local models stay first-class.",
    route: "/pulse",
    group: "ide",
  },
  {
    id: "keep",
    name: "Keep",
    usage: "Stay in your IDE",
    tagline: "Chat + inline edit from VS Code. Talk to the local engine.",
    blurb: "Install the Keep extension in the editor you already use. It uses Localmod’s OpenAI-style API on 127.0.0.1 so you can chat, inline-edit, and hit Ollama without leaving VS Code.",
    route: "/keep",
    group: "extension",
  },
  {
    id: "hands",
    name: "Hands",
    usage: "Autonomous engineer",
    tagline: "Read/write files, run allowlisted CLI, finish multi-step jobs.",
    blurb: "A sidebar engineer: list and edit the workspace, run git/npm/node/python in a sandbox, and keep going until the task is done or the step budget hits.",
    route: "/hands",
    group: "extension",
  },
];

export async function suiteStatus() {
  const s = getSettings();
  const inf = inferenceStatus();
  let ollama = [];
  try {
    ollama = await ollamaTags();
  } catch {
    ollama = [];
  }
  const providers = listProviders();
  const api = apiStatus();
  return {
    name: "Localmod Suite",
    blurb: "A local-first suite of AI systems — named by how you use them.",
    apps: SUITE_APPS,
    live: {
      llama: Boolean(inf.running),
      ollamaTags: Array.isArray(ollama) ? ollama.length : 0,
      api,
      provider: s.provider || "llama",
      airplane: !!s.airplane,
      workspace: s.cursorCwd || "",
      keys: providers.filter((p) => p.configured).map((p) => p.id),
    },
    providers,
  };
}
