import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, readJson, writeJson } from "./paths.js";
import { getSettings } from "./settings.js";

export function memoryDir() {
  const dir = path.join(dataDir(), "agent-memory");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function storePath() {
  return path.join(memoryDir(), "notes.json");
}

function loadNotes() {
  const rows = readJson(storePath(), []);
  return Array.isArray(rows) ? rows : [];
}

function saveNotes(rows) {
  writeJson(storePath(), rows);
}

export function memoryTtlMs(hours) {
  const h = Number(hours ?? getSettings().agentMemoryTtlHours ?? 72);
  return Math.max(1, h) * 3600 * 1000;
}

export function pruneMemory({ now = Date.now(), ttlHours } = {}) {
  const ttl = memoryTtlMs(ttlHours);
  const rows = loadNotes();
  const kept = rows.filter((n) => n.pinned || now - (n.updatedAt || n.createdAt || 0) < ttl);
  if (kept.length !== rows.length) saveNotes(kept);
  return { before: rows.length, after: kept.length, pruned: rows.length - kept.length, ttlMs: ttl };
}

function scopeKey(scope) {
  return String(scope || "global").slice(0, 160);
}

export function summarizeLog(log, limit = 8) {
  if (!Array.isArray(log) || !log.length) return "";
  return log
    .slice(-limit)
    .map((e) => `[${e.phase || e.loop || "step"}#${e.step ?? ""}] ${e.where || ""} ${e.thought || ""} → ${e.action?.name || ""} ${e.result ? String(e.result).slice(0, 200) : ""}`)
    .join("\n");
}

export function appendTrace(row) {
  const file = path.join(memoryDir(), "trace.jsonl");
  fs.appendFileSync(file, JSON.stringify({ t: Date.now(), ...row }) + "\n");
  return row;
}

export function remember(input = {}) {
  pruneMemory();
  const rows = loadNotes();
  const key = input.key || input.kind || "note";
  const k = String(key).slice(0, 80);
  const scope = input.scope || input.runId || "global";
  const sc = scopeKey(scope);
  const text = String(input.text || "");
  const existing = rows.find((n) => n.scope === sc && n.key === k);
  const row = existing || {
    id: randomUUID(),
    scope: sc,
    key: k,
    createdAt: Date.now(),
  };
  row.text = String(text || "").slice(0, 4000);
  row.runId = input.runId || row.runId || "";
  row.pinned = Boolean(input.pinned);
  row.tags = input.tags || row.tags || [];
  row.updatedAt = Date.now();
  row.expiresAt = row.pinned ? null : Date.now() + memoryTtlMs();
  const next = existing ? rows.map((n) => (n.id === row.id ? row : n)) : [row, ...rows].slice(0, 400);
  saveNotes(next);
  return row;
}

export function recall({ scope, query, limit = 8 }) {
  pruneMemory();
  const sc = scopeKey(scope);
  const q = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const rows = loadNotes().filter((n) => n.scope === sc || n.scope === "global");
  const scored = rows
    .map((n) => {
      const hay = `${n.key} ${n.text}`.toLowerCase();
      const hits = q.length ? q.filter((w) => hay.includes(w)).length : 1;
      return { ...n, score: hits };
    })
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, limit);
  return scored;
}

export function forget({ id, scope }) {
  const rows = loadNotes();
  const next = id ? rows.filter((n) => n.id !== id) : scope ? rows.filter((n) => n.scope !== scopeKey(scope)) : rows;
  saveNotes(next);
  return { ok: true, remaining: next.length };
}

export function memoryStatus() {
  const prune = pruneMemory();
  const rows = loadNotes();
  const scopes = [...new Set(rows.map((n) => n.scope))];
  return {
    dir: memoryDir(),
    notes: rows.length,
    scopes,
    ttlHours: getSettings().agentMemoryTtlHours ?? 72,
    lastPrune: prune,
  };
}

export function memorySnapshot(scope, query) {
  return {
    status: memoryStatus(),
    notes: recall({ scope, query, limit: 8 }),
  };
}
