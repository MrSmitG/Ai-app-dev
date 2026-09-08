import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { dataDir } from "./paths.js";
import { getSettings } from "./settings.js";
import { retrieve } from "./rag.js";
import { listMcp, requestToolCall } from "./mcp.js";
import { remember } from "./agentMemory.js";
import { cacheGet, cacheSet, withRetry, waitForRate, fireWebhook, appendMetric } from "./agentOrchestrator.js";

const WRITE_TOOLS = new Set(["write"]);
const NETWORK_TOOLS = new Set(["search"]);
const pending = [];
const always = new Set();

export const TOOL_SCHEMAS = [
  {
    name: "list",
    description: "List files in a workspace-relative folder",
    args: { path: { type: "string", optional: true } },
    lane: "files",
  },
  {
    name: "read",
    description: "Read a workspace file (capped)",
    args: { path: { type: "string" } },
    lane: "files",
  },
  {
    name: "write",
    description: "Write a workspace file (HITL when agentHitlWrites)",
    args: { path: { type: "string" }, content: { type: "string", optional: true } },
    lane: "files",
    hitl: true,
  },
  {
    name: "note",
    description: "Record a scoped memory note",
    args: { text: { type: "string", optional: true }, content: { type: "string", optional: true }, key: { type: "string", optional: true } },
    lane: "memory",
  },
  {
    name: "retrieve",
    description: "Query the RAG collection (vector memory)",
    args: { query: { type: "string", optional: true }, collectionId: { type: "string", optional: true } },
    lane: "data",
  },
  {
    name: "search",
    description: "Web search via the tool gateway (blocked in airplane mode)",
    args: { query: { type: "string" } },
    lane: "network",
  },
  {
    name: "mcp_call",
    description: "Call a connected MCP tool (HITL via MCP permissions)",
    args: { serverId: { type: "string" }, name: { type: "string" }, args: { type: "object", optional: true } },
    lane: "apis",
  },
  {
    name: "run_code",
    description: "Sandboxed JS expression runner (no require, timeout)",
    args: { code: { type: "string" } },
    lane: "runner",
  },
  {
    name: "message",
    description: "Queue a workflow/webhook message",
    args: { text: { type: "string" }, event: { type: "string", optional: true } },
    lane: "messaging",
  },
  {
    name: "finish",
    description: "Stop the loop with a summary",
    args: { summary: { type: "string", optional: true } },
    lane: "control",
  },
];

export function allowedToolNames() {
  return TOOL_SCHEMAS.map((t) => t.name);
}

export function toolCatalog() {
  const s = getSettings();
  const mcp = listMcp();
  return {
    gateway: "tool-bus",
    airplane: !!s.airplane,
    allowNetwork: s.agentAllowNetwork !== false && !s.airplane,
    hitlWrites: s.agentHitlWrites !== false,
    collectionId: s.agentCollectionId || "",
    mcpServers: mcp,
    tools: TOOL_SCHEMAS.map((t) => ({
      ...t,
      enabled: toolEnabled(t.name, s),
    })),
    map: {
      above: ["browser/search", "apis", "databases", "vector memory"],
      bus: "Tool Bus / MCP / Tool Gateway",
      agent: "Localmod agent",
      below: ["code runner", "files/docs", "messaging/workflow", "human approval"],
    },
  };
}

function toolEnabled(name, s = getSettings()) {
  if (NETWORK_TOOLS.has(name)) return !s.airplane && s.agentAllowNetwork !== false;
  if (name === "retrieve") return Boolean(s.agentCollectionId);
  if (name === "mcp_call") return listMcp().some((m) => m.status === "ready");
  return true;
}

export function sandboxRoot(cwd) {
  const fallback = path.join(dataDir(), "agent-workspace");
  const root = path.resolve(String(cwd || getSettings().cursorCwd || fallback).trim() || fallback);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  return root;
}

export function safeJoin(root, rel) {
  const target = path.resolve(root, String(rel || ".").replace(/^[/\\]+/, ""));
  if (!target.startsWith(root)) throw new Error("Path escapes workspace");
  return target;
}

export function validateAction(action) {
  const name = String(action?.name || "").trim();
  if (!name) return { ok: false, error: "Missing action.name", action: null };
  const schema = TOOL_SCHEMAS.find((t) => t.name === name);
  if (!schema) {
    return {
      ok: false,
      error: `Unknown tool "${name}". Allowed: ${allowedToolNames().join(", ")}`,
      action: null,
      hallucinated: true,
    };
  }
  const args = action.args && typeof action.args === "object" ? { ...action.args } : {};
  for (const [key, spec] of Object.entries(schema.args || {})) {
    if (!spec.optional && (args[key] === undefined || args[key] === null || args[key] === "")) {
      return { ok: false, error: `Tool ${name} requires args.${key}`, action: { name, args } };
    }
    if (args[key] !== undefined && spec.type === "string" && typeof args[key] !== "string") {
      args[key] = String(args[key]);
    }
  }
  return { ok: true, action: { name, args }, schema };
}

function publicPending(p) {
  return {
    id: p.id,
    tool: p.tool,
    args: p.args,
    runId: p.runId,
    cwd: p.cwd,
    createdAt: p.createdAt,
    status: p.status || "pending",
  };
}

export function pendingApprovals() {
  return pending.filter((p) => p.status === "pending").map(publicPending);
}

export function listApprovals() {
  return pending.map(publicPending);
}

function applyWrite(root, args) {
  const file = safeJoin(root, args.path);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, String(args.content || ""), "utf8");
  return `Wrote ${file} (${String(args.content || "").length} chars)`;
}

export async function resolveApproval({ id, decision }) {
  const p = pending.find((x) => x.id === id);
  if (!p) throw new Error("No such approval");
  if (p.status !== "pending") return { ok: false, error: "Already resolved", approval: publicPending(p) };
  if (decision === "deny") {
    p.status = "denied";
    p.resolvedAt = Date.now();
    p.reject?.(new Error("User denied write"));
    appendMetric({ kind: "approval", id, decision: "deny", tool: p.tool });
    return { ok: false, approval: publicPending(p) };
  }
  if (decision === "always") always.add("write");
  try {
    const result = applyWrite(p.root, p.args);
    p.status = "approved";
    p.resolvedAt = Date.now();
    p.resolve?.(result);
    appendMetric({ kind: "approval", id, decision: decision || "allow", tool: p.tool });
    return { ok: true, result, approval: publicPending(p) };
  } catch (err) {
    p.status = "error";
    p.reject?.(err);
    throw err;
  }
}

function requestWrite({ root, args, runId, cwd }) {
  if (always.has("write")) {
    return Promise.resolve(applyWrite(root, args));
  }
  return new Promise((resolve, reject) => {
    const row = {
      id: randomUUID(),
      tool: "write",
      args,
      root,
      runId,
      cwd,
      createdAt: Date.now(),
      status: "pending",
      resolve,
      reject,
    };
    pending.push(row);
    const timeout = Math.max(5000, Number(getSettings().agentHitlTimeoutMs ?? 120000));
    const timer = setTimeout(() => {
      if (row.status !== "pending") return;
      row.status = "timeout";
      reject(new Error("HITL write timed out waiting for approval"));
    }, timeout);
    const origResolve = resolve;
    const origReject = reject;
    row.resolve = (v) => {
      clearTimeout(timer);
      origResolve(v);
    };
    row.reject = (e) => {
      clearTimeout(timer);
      origReject(e);
    };
  });
}

function listDir(root, rel) {
  const dir = safeJoin(root, rel || ".");
  const names = fs.readdirSync(dir).slice(0, 80);
  if (!names.length) return "(empty folder)";
  return names
    .map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return `${st.isDirectory() ? "dir" : "file"} ${n}`;
    })
    .join("\n");
}

function readFileSafe(root, rel) {
  const file = safeJoin(root, rel);
  const st = fs.statSync(file);
  if (st.size > 120000) return `File too large (${st.size} bytes). Read a smaller file.`;
  return fs.readFileSync(file, "utf8").slice(0, 8000);
}

async function webSearch(query) {
  const s = getSettings();
  if (s.airplane || s.agentAllowNetwork === false) {
    throw new Error("Search blocked: airplane mode or agentAllowNetwork is off");
  }
  const cached = cacheGet("search", query);
  if (cached) return cached;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Localmod/0.2 (local agent search)" },
  });
  const html = await res.text();
  const hits = [];
  const re = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && hits.length < 5) {
    hits.push({
      url: m[1].replace(/&amp;/g, "&"),
      title: m[2].replace(/<[^>]+>/g, "").trim(),
    });
  }
  const text = hits.length
    ? hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}`).join("\n")
    : `No parseable results for: ${query}`;
  cacheSet("search", query, text);
  return text;
}

function runSandboxed(code) {
  const src = String(code || "").slice(0, 4000);
  const boxed = { result: undefined, console: { log: (...a) => a.join(" ") } };
  vm.runInNewContext(
    `result = (function(){ "use strict"; ${src}\n})()`,
    boxed,
    { timeout: 800, filename: "agent-runner.js" }
  );
  return String(boxed.result ?? "undefined").slice(0, 4000);
}

export async function executeTool(action, ctx = {}) {
  const checked = validateAction(action);
  if (!checked.ok) {
    return { ok: false, rejected: true, hallucinated: !!checked.hallucinated, result: checked.error, action: checked.action };
  }
  const { name, args } = checked.action;
  const s = getSettings();
  const root = sandboxRoot(ctx.cwd);
  await waitForRate();

  const run = async () => {
    if (name === "list") return listDir(root, args.path);
    if (name === "read") return readFileSafe(root, args.path);
    if (name === "write") {
      if (s.agentHitlWrites !== false) {
        return requestWrite({ root, args, runId: ctx.runId, cwd: root });
      }
      return applyWrite(root, args);
    }
    if (name === "note") {
      const text = String(args.text || args.content || "noted");
      remember({ scope: ctx.scope || root, key: args.key || "note", text, runId: ctx.runId });
      return text;
    }
    if (name === "retrieve") {
      const collectionId = args.collectionId || s.agentCollectionId;
      if (!collectionId) return "No RAG collection configured (set agentCollectionId).";
      const query = args.query || ctx.goal || "";
      const cached = cacheGet("retrieve", { collectionId, query });
      if (cached) return cached;
      const rag = await retrieve(collectionId, query, 6);
      const text =
        rag.citations
          ?.map((c, i) => `[${i + 1}] ${c.filename} p.${c.page} (${c.score})\n${c.snippet}`)
          .join("\n\n") || "(no citations)";
      cacheSet("retrieve", { collectionId, query }, text);
      return text;
    }
    if (name === "search") return webSearch(args.query);
    if (name === "mcp_call") {
      return requestToolCall({ serverId: args.serverId, name: args.name, args: args.args || {} });
    }
    if (name === "run_code") return runSandboxed(args.code);
    if (name === "message") {
      const text = String(args.text || "");
      const event = args.event || "agent.message";
      const hook = await fireWebhook(event, { data: { text, runId: ctx.runId } });
      remember({ scope: ctx.scope || root, key: "message", text, runId: ctx.runId });
      return `Queued message (${event}). Webhook: ${hook.skipped ? "skipped" : hook.ok ? "ok" : hook.error || hook.status}`;
    }
    if (name === "finish") return String(args.summary || "done");
    throw new Error(`Unhandled tool ${name}`);
  };

  try {
    const result = await withRetry(run, { label: name, timeoutMs: s.agentTimeoutMs });
    appendMetric({ kind: "tool", name, ok: true, runId: ctx.runId });
    return { ok: true, action: checked.action, result: typeof result === "string" ? result : JSON.stringify(result).slice(0, 4000) };
  } catch (err) {
    appendMetric({ kind: "tool", name, ok: false, error: String(err.message || err), runId: ctx.runId });
    return { ok: false, action: checked.action, result: `Action failed: ${err.message || err}` };
  }
}

export function actionFingerprint(action) {
  const name = action?.name || "";
  const args = JSON.stringify(action?.args || {});
  return `${name}:${args}`;
}

/** Signature used by startLocalAgent: (cwd, action, ctx) */
export async function callTool(cwd, action, ctx = {}) {
  return executeTool(action, { ...ctx, cwd });
}

export function listToolCatalog() {
  const catalog = toolCatalog();
  return {
    ...catalog,
    live: {
      tools: catalog.tools,
      pendingApprovals: pendingApprovals(),
      mcp: catalog.mcpServers,
    },
    inputs: [
      { id: "browser", title: "Browser / Search", blurb: "search tool — blocked in airplane mode" },
      { id: "apis", title: "APIs", blurb: "mcp_call through the gateway" },
      { id: "databases", title: "Databases", blurb: "Workspace files and Harbor collections" },
      { id: "vector", title: "Vector Memory", blurb: "retrieve() over agentCollectionId" },
    ],
    gateway: {
      id: "bus",
      title: "Tool Bus / MCP / Tool Gateway",
      blurb: "Schema-validated tools. HITL writes and airplane mode sit here.",
    },
    below: [
      { id: "runner", title: "Code Runner", blurb: "Sandboxed JS via run_code" },
      { id: "files", title: "Files / Docs", blurb: "list, read, write inside the workspace" },
      { id: "messaging", title: "Messaging / Workflow", blurb: "message tool + webhook" },
      { id: "hitl", title: "Human Approval", blurb: "GET/POST /agent/approvals" },
    ],
  };
}
