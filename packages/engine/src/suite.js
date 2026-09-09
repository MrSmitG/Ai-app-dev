/** Localmod suite — enigmatic React apps. Start any one; the others wait. */
import { getSettings } from "./settings.js";
import { inferenceStatus } from "./inference.js";
import { ollamaTags } from "./ollama.js";
import { apiStatus } from "./apiServer.js";
import { listProviders } from "./providers.js";

export const SUITE_APPS = [
  {
    id: "blackwhale",
    name: "Blackwhale",
    usage: "Chat",
    tagline: "A massive, deep-sea communication hub where everything centralizes.",
    blurb: "Talk to a local model. Chat, models, RAG, and voice gather in one dark basin.",
    route: "/blackwhale",
    folder: "apps/blackwhale",
    port: 1421,
    start: "npm run blackwhale",
    group: "studio",
    aliases: ["studio", "chat"],
  },
  {
    id: "nightweaver",
    name: "Nightweaver",
    usage: "Agentic coding",
    tagline: "An unseen entity spinning complex webs of code in the background.",
    blurb: "Index a project folder, search it, then plan and apply edits across files.",
    route: "/nightweaver",
    folder: "apps/nightweaver",
    port: 1422,
    start: "npm run nightweaver",
    group: "ide",
    aliases: ["code", "current"],
  },
  {
    id: "obsidian",
    name: "Obsidian",
    usage: "API keys",
    tagline: "Dark, unbreakable, and highly secure. The vault for your tokens.",
    blurb: "llama-server, Ollama, OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible URL.",
    route: "/obsidian",
    folder: "apps/obsidian",
    port: 1423,
    start: "npm run obsidian",
    group: "ide",
    aliases: ["keys", "keyring"],
  },
  {
    id: "mako",
    name: "Mako",
    usage: "Speed",
    tagline: "The fastest shark in the ocean. Built for high-speed execution and racing.",
    blurb: "Ping every backend. Race the same prompt. Local GGUF and Ollama first.",
    route: "/mako",
    folder: "apps/mako",
    port: 1424,
    start: "npm run mako",
    group: "ide",
    aliases: ["fast", "pulse"],
  },
  {
    id: "trench",
    name: "The Trench",
    usage: "Editor",
    tagline: "Deep work. Dive in and do not leave until the job is done.",
    blurb: "Inline edit in this React app, or install the VS Code extension. High-pressure focus.",
    route: "/trench",
    folder: "apps/trench",
    port: 1425,
    start: "npm run trench",
    group: "extension",
    aliases: ["editor", "keep"],
  },
  {
    id: "ironmantis",
    name: "Ironmantis",
    usage: "Autonomous",
    tagline: "A hyper-efficient builder that operates with ruthless precision.",
    blurb: "Read, write, run allowlisted CLI (git, npm, node, python), finish multi-step jobs.",
    route: "/ironmantis",
    folder: "apps/ironmantis",
    port: 1426,
    start: "npm run ironmantis",
    group: "extension",
    aliases: ["engineer", "hands"],
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
    name: "Localmod",
    blurb: "Six React apps. Start one. Then another. Apex names, local-only engine.",
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
