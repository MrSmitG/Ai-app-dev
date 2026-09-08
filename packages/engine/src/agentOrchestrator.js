import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { dataDir, readJson } from "./paths.js";
import { getSettings } from "./settings.js";

const cache = new Map();
const queue = [];
let draining = false;
const rateWindow = [];
const liveIds = new Set();
const counters = { steps: 0, criticFail: 0, loopsStopped: 0, errors: 0 };

export function markLive(id) {
  if (id) liveIds.add(id);
  return liveIds.size;
}

export function markDone(id) {
  if (id) liveIds.delete(id);
  return liveIds.size;
}

export function bumpMetric(name, n = 1) {
  const key = String(name || "event");
  counters[key] = (counters[key] || 0) + n;
  appendMetric({ kind: "counter", name: key, n });
  return counters[key];
}

export function getCounters() {
  return { ...counters, live: liveIds.size };
}

export function metricsPath() {
  return path.join(dataDir(), "agent-metrics.jsonl");
}

export function appendMetric(row) {
  const line = JSON.stringify({ t: Date.now(), ...row });
  fs.mkdirSync(path.dirname(metricsPath()), { recursive: true });
  fs.appendFileSync(metricsPath(), line + "\n");
  return row;
}

export function readMetrics(limit = 80) {
  if (!fs.existsSync(metricsPath())) return [];
  const lines = fs
    .readFileSync(metricsPath(), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  return lines.slice(-limit).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return { raw: l };
    }
  });
}

export function metricSummary() {
  const rows = readMetrics(200);
  const byKind = {};
  for (const r of rows) {
    const k = r.kind || r.phase || "event";
    byKind[k] = (byKind[k] || 0) + 1;
  }
  return {
    path: metricsPath(),
    events: rows.length,
    byKind,
    last: rows[rows.length - 1] || null,
  };
}

function cacheTtlMs() {
  return Math.max(10, Number(getSettings().agentCacheTtlSec ?? 300)) * 1000;
}

export function cacheKey(kind, payload) {
  return createHash("sha1").update(`${kind}:${JSON.stringify(payload || {})}`).digest("hex");
}

export function cacheGet(kind, payload) {
  const key = cacheKey(kind, payload);
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(kind, payload, value) {
  cache.set(cacheKey(kind, payload), { value, expiresAt: Date.now() + cacheTtlMs() });
  return value;
}

export function cacheStats() {
  let live = 0;
  for (const [k, v] of cache) {
    if (Date.now() > v.expiresAt) cache.delete(k);
    else live += 1;
  }
  return { entries: live, ttlSec: getSettings().agentCacheTtlSec ?? 300 };
}

export function ratePerMin() {
  return Math.max(1, Number(getSettings().agentRatePerMin ?? 20));
}

export function rateStatus() {
  const now = Date.now();
  while (rateWindow.length && now - rateWindow[0] > 60_000) rateWindow.shift();
  return { used: rateWindow.length, limit: ratePerMin(), remaining: Math.max(0, ratePerMin() - rateWindow.length) };
}

export function consumeRate() {
  const st = rateStatus();
  if (st.remaining <= 0) {
    const err = new Error(`Rate limited: ${st.limit} tool calls per minute`);
    err.code = "RATE_LIMIT";
    throw err;
  }
  rateWindow.push(Date.now());
  return rateStatus();
}

export const takeRateSlot = consumeRate;

export async function waitForRate() {
  for (let i = 0; i < 30; i++) {
    try {
      return consumeRate();
    } catch (err) {
      if (err.code !== "RATE_LIMIT") throw err;
      await sleep(1000);
    }
  }
  consumeRate();
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withTimeout(fn, ms) {
  const limit = Math.max(500, Number(ms ?? getSettings().agentTimeoutMs ?? 15000));
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`Timed out after ${limit}ms`), { code: "TIMEOUT" })), limit);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry(fn, { retries, tries, timeoutMs, label } = {}) {
  const max = Math.max(0, Number(retries ?? tries ?? getSettings().agentRetries ?? 2));
  let lastErr;
  for (let i = 0; i <= max; i++) {
    try {
      return await withTimeout(fn, timeoutMs);
    } catch (err) {
      lastErr = err;
      appendMetric({ kind: "retry", label: label || "tool", attempt: i + 1, error: String(err.message || err) });
      if (i === max) break;
      await sleep(Math.min(8000, 400 * 2 ** i));
    }
  }
  throw lastErr;
}

export function enqueue(job) {
  const item = {
    id: randomUUID(),
    status: "queued",
    createdAt: Date.now(),
    ...job,
  };
  queue.push(item);
  drainQueue();
  return item;
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const item = queue[0];
    if (item.status !== "queued") {
      queue.shift();
      continue;
    }
    item.status = "running";
    try {
      item.result = await item.run?.();
      item.status = "done";
    } catch (err) {
      item.status = "error";
      item.error = String(err.message || err);
    } finally {
      item.finishedAt = Date.now();
      queue.shift();
    }
  }
  draining = false;
}

export function queueStatus() {
  return {
    depth: queue.length,
    draining,
    items: queue.slice(0, 20).map((q) => ({
      id: q.id,
      status: q.status,
      label: q.label || "",
      createdAt: q.createdAt,
    })),
  };
}

export async function fireWebhook(event, payload) {
  if (event && typeof event === "object" && !payload) {
    payload = event;
    event = event.event || "agent";
  }
  const url = String(payload?.url || getSettings().agentWebhookUrl || "").trim();
  if (!url) return { skipped: true, reason: "no webhook url" };
  const body = {
    event,
    source: "localmod-agent",
    t: Date.now(),
    ...(payload?.data || payload || {}),
  };
  delete body.url;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "localmod-agent" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await res.text().catch(() => "");
    appendMetric({ kind: "webhook", event, status: res.status, ok: res.ok });
    return { ok: res.ok, status: res.status, preview: text.slice(0, 240) };
  } catch (err) {
    appendMetric({ kind: "webhook", event, error: String(err.message || err) });
    return { ok: false, error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function testWebhook(url) {
  return fireWebhook("webhook-test", {
    url: url || getSettings().agentWebhookUrl,
    data: { ping: true, message: "Localmod agent webhook test" },
  });
}

export function getMetrics() {
  return {
    ...metricSummary(),
    counters: getCounters(),
    rate: rateStatus(),
    cache: cacheStats(),
    queue: queueStatus(),
    rows: readMetrics(80),
  };
}

export function orchestratorStatus() {
  return {
    queue: queueStatus(),
    rate: rateStatus(),
    cache: cacheStats(),
    metrics: { ...metricSummary(), ...getCounters() },
    webhook: Boolean(String(getSettings().agentWebhookUrl || "").trim()),
    retries: getSettings().agentRetries ?? 2,
    timeoutMs: getSettings().agentTimeoutMs ?? 15000,
  };
}

export function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

export function budgetRemaining(usedTokens) {
  const cap = Math.max(256, Number(getSettings().agentBudgetTokens ?? 8000));
  const used = Number(usedTokens || 0);
  return { cap, used, remaining: Math.max(0, cap - used), exceeded: used >= cap };
}
