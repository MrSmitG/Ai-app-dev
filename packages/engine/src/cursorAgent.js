import { getSettings, patchSettings } from "./settings.js";
import { dataDir } from "./paths.js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** @type {Map<string, any>} */
const sessions = new Map();
/** @type {Map<string, any>} */
const agents = new Map();

function apiKey() {
  return String(getSettings().cursorApiKey || process.env.CURSOR_API_KEY || "").trim();
}

function requireKey() {
  const key = apiKey();
  if (!key) throw new Error("Add an Agent API key in Options → Agent (or set CURSOR_API_KEY).");
  return key;
}

export function cursorStatus() {
  const s = getSettings();
  const active = [...sessions.values()].filter((x) => x.status === "running").length;
  return {
    configured: Boolean(apiKey()),
    model: s.cursorModel || "composer-2.5",
    cwd: s.cursorCwd || process.cwd(),
    runtime: s.cursorRuntime || "local",
    cloudRepo: s.cursorCloudRepo || "",
    activeRuns: active,
    sessions: [...sessions.values()].map(publicSession),
  };
}

function publicSession(s) {
  return {
    id: s.id,
    agentId: s.agentId,
    runId: s.runId,
    status: s.status,
    model: s.model,
    runtime: s.runtime,
    cwd: s.cwd,
    prompt: s.prompt,
    text: s.text,
    events: s.events.slice(-200),
    error: s.error || "",
    startedAt: s.startedAt,
    finishedAt: s.finishedAt || null,
    context: s.context || null,
    attachments: s.attachments || [],
  };
}

export async function listCursorModels() {
  const { Cursor } = await import("@cursor/sdk");
  const models = await Cursor.models.list({ apiKey: requireKey() });
  return Array.isArray(models) ? models : models?.models || models || [];
}

export async function listCursorAgents() {
  const { Agent } = await import("@cursor/sdk");
  const s = getSettings();
  const cwd = s.cursorCwd || process.cwd();
  try {
    const list = await Agent.list({
      apiKey: requireKey(),
      runtime: "local",
      cwd,
    });
    return list?.items || list?.agents || list || [];
  } catch (err) {
    return { error: String(err.message || err), items: [] };
  }
}

function extractText(event) {
  const parts = [];
  if (event?.type === "assistant" && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === "text" && block.text) parts.push(block.text);
    }
  }
  if (event?.type === "thinking" && event.text) parts.push(event.text);
  if (typeof event?.text === "string") parts.push(event.text);
  return parts.join("");
}

function summarizeEvent(event) {
  const type = event?.type || "event";
  if (type === "assistant") {
    const text = extractText(event);
    return { type, preview: text.slice(0, 240), ts: Date.now() };
  }
  if (type === "tool_call" || type === "tool-use" || type === "tool_use") {
    return {
      type: "tool",
      name: event.name || event.toolName || event.tool_name || "tool",
      preview: JSON.stringify(event.args || event.input || {}).slice(0, 180),
      ts: Date.now(),
    };
  }
  if (type === "status") {
    return { type: "status", preview: event.status || event.message || "status", ts: Date.now() };
  }
  return { type, preview: JSON.stringify(event).slice(0, 160), ts: Date.now() };
}

function buildAgentPrompt(body, cwd) {
  const parts = [];
  const voice = String(body.voiceTranscript || body.voice || "").trim();
  const prompt = String(body.prompt || "").trim();
  const pinned = Array.isArray(body.pinnedNotes) ? body.pinnedNotes.filter(Boolean) : [];
  const chatContext = Array.isArray(body.chatContext) ? body.chatContext : [];

  if (voice) {
    parts.push(`## Voice transcript\n${voice}`);
  }
  if (pinned.length) {
    parts.push(`## Pinned context\n${pinned.map((p, i) => `${i + 1}. ${String(p).slice(0, 2000)}`).join("\n")}`);
  }
  if (chatContext.length) {
    const lines = chatContext.slice(-12).map((m) => {
      const role = m.role || "user";
      const text = String(m.content || "").replace(/\s+/g, " ").slice(0, 400);
      return `${role}: ${text}`;
    });
    parts.push(`## Recent chat context (compact)\n${lines.join("\n")}`);
  }

  const saved = [];
  const images = Array.isArray(body.images) ? body.images : Array.isArray(body.attachments) ? body.attachments.filter((a) => a?.kind === "image") : [];
  if (images.length && runtimeIsLocal(body, cwd)) {
    const inbox = path.join(cwd, ".localmod", "agent-inbox");
    fs.mkdirSync(inbox, { recursive: true });
    for (const img of images.slice(0, 8)) {
      try {
        const dataUrl = String(img.dataUrl || img.url || "");
        const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        if (!b64) continue;
        const mime = img.mime || (dataUrl.match(/^data:([^;]+)/)?.[1]) || "image/png";
        const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "png";
        const safe = String(img.name || `shot-${Date.now()}`).replace(/[^\w.\-]+/g, "_").slice(0, 80);
        const file = path.join(inbox, `${Date.now()}-${safe}.${ext}`);
        fs.writeFileSync(file, Buffer.from(b64, "base64"));
        saved.push({ name: img.name || path.basename(file), path: file });
      } catch {
        /* skip bad image */
      }
    }
  }
  if (saved.length) {
    parts.push(
      `## Attached images (on disk — inspect with tools)\n${saved.map((f) => `- ${f.name}: ${f.path}`).join("\n")}\nRead these files when visual context matters.`
    );
  } else if (images.length) {
    parts.push(`## Attached images\n${images.length} image(s) provided in the request. Describe or reason about them from the filenames/context if paths are unavailable.`);
  }

  if (prompt) parts.push(`## Task\n${prompt}`);
  const full = parts.join("\n\n").trim();
  return { prompt: full, attachments: saved, voiceChars: voice.length, imageCount: images.length };
}

function runtimeIsLocal(body, cwd) {
  const s = getSettings();
  const runtime = String(body.runtime || s.cursorRuntime || "local");
  return runtime !== "cloud" && cwd && fs.existsSync(cwd);
}

export async function startCursorRun(body, onEvent) {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");
  const s = getSettings();
  const key = requireKey();
  const modelId = String(body.model || s.cursorModel || "composer-2.5");
  const runtime = String(body.runtime || s.cursorRuntime || "local");
  const cwd = String(body.cwd || s.cursorCwd || process.cwd());
  const followUpAgentId = body.agentId ? String(body.agentId) : "";
  const built = buildAgentPrompt(body, cwd);
  const prompt = built.prompt;
  if (!prompt) throw new Error("Prompt is required");

  const id = randomUUID();

  const session = {
    id,
    agentId: followUpAgentId || "",
    runId: "",
    status: "starting",
    model: modelId,
    runtime,
    cwd,
    prompt,
    text: "",
    events: [],
    error: "",
    startedAt: Date.now(),
    finishedAt: null,
    cancel: null,
    attachments: built.attachments,
    context: {
      voiceChars: built.voiceChars,
      imageCount: built.imageCount,
      promptChars: prompt.length,
      promptTokensEst: Math.ceil(prompt.length / 4),
    },
  };
  sessions.set(id, session);
  onEvent?.({ type: "session", data: publicSession(session) });

  let agent;
  try {
    if (followUpAgentId) {
      agent = await Agent.resume(followUpAgentId, { apiKey: key });
    } else if (runtime === "cloud") {
      const repo = String(body.cloudRepo || s.cursorCloudRepo || "").trim();
      if (!repo) throw new Error("Cloud runtime needs a GitHub repo URL (Options → Forge).");
      agent = await Agent.create({
        apiKey: key,
        model: { id: modelId },
        cloud: {
          repos: [{ url: repo, startingRef: body.ref || "main" }],
          autoCreatePR: Boolean(body.autoCreatePR),
        },
      });
    } else {
      if (!fs.existsSync(cwd)) throw new Error(`Workspace folder not found: ${cwd}`);
      agent = await Agent.create({
        apiKey: key,
        model: { id: modelId },
        local: { cwd },
      });
    }

    session.agentId = agent.agentId || agent.id || session.agentId;
    agents.set(session.agentId, agent);

    const run = await agent.send(prompt);
    session.runId = run.id || "";
    session.status = "running";
    session.cancel = async () => {
      if (run.supports?.("cancel")) await run.cancel();
    };
    onEvent?.({ type: "session", data: publicSession(session) });

    for await (const event of run.stream()) {
      const summary = summarizeEvent(event);
      session.events.push(summary);
      const chunk = extractText(event);
      if (chunk) {
        session.text += chunk;
        onEvent?.({ type: "token", data: chunk });
      }
      onEvent?.({ type: "event", data: summary });
    }

    const result = await run.wait();
    session.status = result?.status === "error" ? "error" : "finished";
    if (result?.status === "error") {
      session.error = result.error?.message || "Run failed";
    }
    if (result?.result && !session.text) session.text = String(result.result);
    session.finishedAt = Date.now();
    persistHistory(session);
    onEvent?.({ type: "done", data: publicSession(session) });
    return publicSession(session);
  } catch (err) {
    session.status = "error";
    session.error =
      err?.name === "CursorAgentError" || err?.constructor?.name === "CursorAgentError"
        ? `${err.message} (startup)`
        : String(err.message || err);
    session.finishedAt = Date.now();
    persistHistory(session);
    onEvent?.({ type: "error", data: publicSession(session) });
    if (err instanceof CursorAgentError || err?.name === "CursorAgentError") throw err;
    throw err;
  } finally {
    try {
      if (agent?.[Symbol.asyncDispose]) await agent[Symbol.asyncDispose]();
      else if (typeof agent?.close === "function") await agent.close();
    } catch {
      /* ignore dispose errors */
    }
  }
}

export async function cancelCursorRun(id) {
  const s = sessions.get(id);
  if (!s) throw new Error("Unknown run");
  if (s.cancel) await s.cancel();
  s.status = "cancelled";
  s.finishedAt = Date.now();
  return publicSession(s);
}

export function getCursorRun(id) {
  const s = sessions.get(id);
  if (!s) throw new Error("Unknown run");
  return publicSession(s);
}

function historyPath() {
  return path.join(dataDir(), "cursor-runs.json");
}

function persistHistory(session) {
  try {
    const file = historyPath();
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
    const row = publicSession(session);
    const next = [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 60);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
  } catch {
    /* non-fatal */
  }
}

export function cursorHistory() {
  try {
    const file = historyPath();
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

export async function pickCursorCwd() {
  const { pickFolder } = await import("./pickFolder.js");
  const selected = await pickFolder("Choose Agent workspace folder");
  if (!selected) return { cancelled: true, path: getSettings().cursorCwd || process.cwd() };
  patchSettings({ cursorCwd: selected });
  return { cancelled: false, path: selected };
}
