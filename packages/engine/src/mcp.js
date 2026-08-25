import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import { mcpAuditPath } from "./paths.js";
import { getSettings } from "./settings.js";

/** @type {Map<string, any>} */
const sessions = new Map();
const pending = [];
const always = new Set();

export function listMcp() {
  return [...sessions.values()].map((s) => ({
    id: s.id,
    cmd: s.cmd,
    tools: s.tools,
    status: s.status,
  }));
}

export function pendingPermissions() {
  return pending;
}

export async function connectMcp({ id, command, args = [] }) {
  const s = getSettings();
  if (s.airplane && !isLocalCmd(command)) {
    throw new Error("Airplane mode blocks remote MCP servers");
  }
  const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const session = { id, cmd: [command, ...args].join(" "), child, tools: [], status: "starting", nextId: 1 };
  sessions.set(id, session);
  const rl = readline.createInterface({ input: child.stdout });
  session.pendingRpc = new Map();
  rl.on("line", (line) => {
    try {
      const msg = JSON.parse(line);
      if (msg.id && session.pendingRpc.has(msg.id)) {
        session.pendingRpc.get(msg.id)(msg);
        session.pendingRpc.delete(msg.id);
      }
    } catch {
      /* ignore */
    }
  });
  child.on("exit", () => {
    session.status = "stopped";
  });
  const init = await rpc(session, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "localmod", version: "0.1.0" },
  });
  session.status = "ready";
  try {
    const tools = await rpc(session, "tools/list", {});
    session.tools = tools?.result?.tools || [];
  } catch {
    session.tools = [];
  }
  return { id, tools: session.tools, initialize: init?.result };
}

function rpc(session, method, params) {
  const id = session.nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`MCP timeout ${method}`)), 15000);
    session.pendingRpc.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    session.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

export function requestToolCall({ serverId, name, args }) {
  return new Promise((resolve, reject) => {
    const key = `${serverId}:${name}`;
    if (always.has(key)) {
      runTool(serverId, name, args).then(resolve, reject);
      return;
    }
    pending.push({
      id: `${Date.now()}-${Math.random()}`,
      serverId,
      name,
      args,
      resolve,
      reject,
    });
  });
}

export async function resolvePermission({ id, decision }) {
  const i = pending.findIndex((p) => p.id === id);
  if (i < 0) throw new Error("No such permission");
  const p = pending.splice(i, 1)[0];
  if (decision === "deny") {
    p.reject(new Error("User denied MCP tool"));
    audit({ serverId: p.serverId, name: p.name, decision });
    return { ok: false };
  }
  if (decision === "always") always.add(`${p.serverId}:${p.name}`);
  try {
    const result = await runTool(p.serverId, p.name, p.args);
    p.resolve(result);
    audit({ serverId: p.serverId, name: p.name, decision, ok: true });
    return { ok: true, result };
  } catch (err) {
    p.reject(err);
    audit({ serverId: p.serverId, name: p.name, decision, error: String(err) });
    throw err;
  }
}

async function runTool(serverId, name, args) {
  const session = sessions.get(serverId);
  if (!session) throw new Error("MCP server not connected");
  const msg = await rpc(session, "tools/call", { name, arguments: args || {} });
  return msg.result;
}

function audit(row) {
  fs.appendFileSync(mcpAuditPath(), JSON.stringify({ t: Date.now(), ...row }) + "\n");
}

export function mcpAudit(limit = 80) {
  if (!fs.existsSync(mcpAuditPath())) return [];
  return fs
    .readFileSync(mcpAuditPath(), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((l) => JSON.parse(l));
}

function isLocalCmd(command) {
  return !command.startsWith("http");
}
