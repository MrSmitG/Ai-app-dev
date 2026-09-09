export const APPS = [
  { id: "blackwhale", name: "Blackwhale", port: 1421, usage: "Chat" },
  { id: "nightweaver", name: "Nightweaver", port: 1422, usage: "Agentic coding" },
  { id: "obsidian", name: "Obsidian", port: 1423, usage: "API keys" },
  { id: "mako", name: "Mako", port: 1424, usage: "Speed" },
  { id: "trench", name: "The Trench", port: 1425, usage: "Editor" },
  { id: "ironmantis", name: "Ironmantis", port: 1426, usage: "Autonomous" },
] as const;

export type AppId = (typeof APPS)[number]["id"];

export const TASKS: Record<
  AppId,
  { does: string[]; not: { id: AppId; task: string }[] }
> = {
  blackwhale: {
    does: [
      "Chat with the loaded local or cloud model",
      "Keep the conversation on this machine",
      "Send the next message in this thread",
    ],
    not: [
      { id: "nightweaver", task: "multi-file code edits" },
      { id: "obsidian", task: "API keys and providers" },
      { id: "mako", task: "latency races" },
      { id: "trench", task: "inline file edit" },
      { id: "ironmantis", task: "CLI / autonomous loops" },
    ],
  },
  nightweaver: {
    does: [
      "Index a project folder",
      "Search the tree for symbols",
      "Plan and apply multi-file edits",
    ],
    not: [
      { id: "blackwhale", task: "open-ended chat" },
      { id: "obsidian", task: "storing API keys" },
      { id: "trench", task: "single-file inline edit" },
      { id: "ironmantis", task: "allowlisted shell commands" },
    ],
  },
  obsidian: {
    does: [
      "Store API keys (OpenAI, Anthropic, OpenRouter, custom)",
      "Pick llama-server or Ollama (no key)",
      "Test a provider without chatting",
    ],
    not: [
      { id: "blackwhale", task: "chat completions" },
      { id: "mako", task: "racing backends" },
      { id: "nightweaver", task: "writing code" },
    ],
  },
  mako: {
    does: [
      "Ping every configured backend",
      "Race the same prompt",
      "Show the lowest latency",
    ],
    not: [
      { id: "obsidian", task: "entering API keys" },
      { id: "blackwhale", task: "a full chat thread" },
      { id: "ironmantis", task: "running CLI" },
    ],
  },
  trench: {
    does: [
      "Inline-edit one file in a workspace",
      "Preview then apply the rewrite",
      "Start the local OpenAI-style API for VS Code",
    ],
    not: [
      { id: "nightweaver", task: "coordinated multi-file plans" },
      { id: "ironmantis", task: "multi-step autonomous CLI" },
      { id: "blackwhale", task: "general chat" },
    ],
  },
  ironmantis: {
    does: [
      "Run a multi-step autonomous task",
      "Read and write files in the folder you pick",
      "Run allowlisted CLI (git, npm, node, python)",
    ],
    not: [
      { id: "trench", task: "focused single-file inline edit" },
      { id: "nightweaver", task: "search-then-plan without CLI" },
      { id: "blackwhale", task: "chat without touching the disk" },
    ],
  },
};
