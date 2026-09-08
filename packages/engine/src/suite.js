/** Localmod suite — clear names, React apps, install to a folder on Mac and Windows. */
import { getSettings } from "./settings.js";
import { inferenceStatus } from "./inference.js";
import { ollamaTags } from "./ollama.js";
import { apiStatus } from "./apiServer.js";
import { listProviders } from "./providers.js";

export const SUITE_APPS = [
  {
    id: "studio",
    name: "Studio",
    usage: "Chat",
    tagline: "Talk to a local model.",
    blurb: "Chat, models, RAG, voice, and bundles — the home studio.",
    route: "/chat",
    folder: "apps/desktop",
    group: "studio",
  },
  {
    id: "code",
    name: "Code",
    usage: "Agentic coding",
    tagline: "Whole-repo context and multi-file edits.",
    blurb: "Index a project folder, search it, then plan and apply edits across files.",
    route: "/code",
    folder: "apps/code",
    group: "ide",
    aliases: ["current"],
  },
  {
    id: "keys",
    name: "Keys",
    usage: "Your API keys",
    tagline: "Local or cloud. You bring the key.",
    blurb: "llama-server, Ollama, OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible URL. No lock-in.",
    route: "/keys",
    folder: "apps/keys",
    group: "ide",
    aliases: ["keyring"],
  },
  {
    id: "fast",
    name: "Fast",
    usage: "Speed",
    tagline: "Ping backends. Race. Use the quickest one.",
    blurb: "Built for round-trip time: local GGUF and Ollama first, cloud if you want it.",
    route: "/fast",
    folder: "apps/fast",
    group: "ide",
    aliases: ["pulse"],
  },
  {
    id: "editor",
    name: "Editor",
    usage: "Stay in your editor",
    tagline: "Inline edit and chat from VS Code or this React app.",
    blurb: "Files live in apps/editor. Install the extension, or run inline edits here. Mac and Windows.",
    route: "/editor",
    folder: "apps/editor",
    group: "extension",
    aliases: ["keep"],
  },
  {
    id: "engineer",
    name: "Engineer",
    usage: "Autonomous engineer",
    tagline: "Read, write, run commands, finish the task.",
    blurb: "Files live in apps/engineer. Allowlisted CLI (git, npm, node, python) inside the folder you pick.",
    route: "/engineer",
    folder: "apps/engineer",
    group: "extension",
    aliases: ["hands"],
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
    blurb: "React apps you install to a folder on Mac or Windows. Named by what they do.",
    apps: SUITE_APPS,
    live: {
      llama: Boolean(inf.running),
      ollamaTags: Array.isArray(ollama) ? ollama.length : 0,
      api,
      provider: s.provider || "llama",
      airplane: !!s.airplane,
      workspace: s.cursorCwd || "",
      keys: providers.filter((p) => p.configured).map((p) => p.id),
      platform: process.platform,
    },
    providers,
  };
}
