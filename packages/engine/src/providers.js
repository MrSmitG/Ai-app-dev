import { getSettings } from "./settings.js";
import { inferenceStatus } from "./inference.js";
import { ollamaTags } from "./ollama.js";

export const PROVIDER_CATALOG = [
  {
    id: "llama",
    name: "llama-server",
    kind: "local",
    blurb: "Local GGUF via llama.cpp. Fast on this GPU. No key.",
  },
  {
    id: "ollama",
    name: "Ollama",
    kind: "local",
    blurb: "Local tags at 127.0.0.1:11434. Zero API cost.",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "cloud",
    blurb: "Bring your OpenAI key. Not a Localmod subscription.",
    keyField: "openaiApiKey",
    modelField: "openaiModel",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "cloud",
    blurb: "Bring your Anthropic key for Claude.",
    keyField: "anthropicApiKey",
    modelField: "anthropicModel",
    defaultModel: "claude-sonnet-4-20250514",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "cloud",
    blurb: "One key, many models. You pay OpenRouter, not us.",
    keyField: "openrouterApiKey",
    modelField: "openrouterModel",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    kind: "cloud",
    blurb: "Any /v1/chat/completions base URL (Together, Groq, LM Studio, …).",
    keyField: "customApiKey",
    modelField: "customApiModel",
    baseField: "customApiBase",
  },
];

export function listProviders() {
  const s = getSettings();
  const inf = inferenceStatus();
  return PROVIDER_CATALOG.map((p) => {
    let configured = false;
    if (p.id === "llama") configured = Boolean(inf.running || s.loadedModel);
    else if (p.id === "ollama") configured = Boolean(s.ollamaUrl);
    else if (p.keyField) configured = Boolean(String(s[p.keyField] || "").trim());
    if (p.id === "custom") configured = Boolean(String(s.customApiBase || "").trim());
    return {
      ...p,
      configured,
      active: s.provider === p.id,
      model: p.modelField ? s[p.modelField] || p.defaultModel || "" : s.loadedModel || "",
      base: p.baseField ? s[p.baseField] || "" : "",
      airplaneBlocked: p.kind === "cloud" && !!s.airplane,
    };
  });
}

export async function pingProvider(id) {
  const s = getSettings();
  const started = Date.now();
  try {
    if (id === "llama") {
      const host = s.llamaHost || "127.0.0.1";
      const port = s.llamaPort || 8080;
      const r = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(2500) });
      return { id, ok: r.ok, ms: Date.now() - started, status: r.status };
    }
    if (id === "ollama") {
      const r = await fetch(`${String(s.ollamaUrl || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/tags`, {
        signal: AbortSignal.timeout(2500),
      });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      const n = Array.isArray(j.models) ? j.models.length : 0;
      return { id, ok: r.ok, ms: Date.now() - started, status: r.status, detail: `${n} tags` };
    }
    if (s.airplane) return { id, ok: false, ms: Date.now() - started, error: "Airplane mode" };
    if (id === "openai") {
      if (!s.openaiApiKey) return { id, ok: false, ms: Date.now() - started, error: "No key" };
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${s.openaiApiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return { id, ok: r.ok, ms: Date.now() - started, status: r.status };
    }
    if (id === "anthropic") {
      if (!s.anthropicApiKey) return { id, ok: false, ms: Date.now() - started, error: "No key" };
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": s.anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: s.anthropicModel || "claude-sonnet-4-20250514",
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(6000),
      });
      return { id, ok: r.ok, ms: Date.now() - started, status: r.status };
    }
    if (id === "openrouter") {
      if (!s.openrouterApiKey) return { id, ok: false, ms: Date.now() - started, error: "No key" };
      const r = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${s.openrouterApiKey}` },
        signal: AbortSignal.timeout(4000),
      });
      return { id, ok: r.ok, ms: Date.now() - started, status: r.status };
    }
    if (id === "custom") {
      const base = String(s.customApiBase || "").replace(/\/$/, "");
      if (!base) return { id, ok: false, ms: Date.now() - started, error: "No base URL" };
      const r = await fetch(`${base}/models`, {
        headers: s.customApiKey ? { Authorization: `Bearer ${s.customApiKey}` } : {},
        signal: AbortSignal.timeout(4000),
      });
      return { id, ok: r.ok || r.status === 404, ms: Date.now() - started, status: r.status };
    }
    return { id, ok: false, error: "Unknown provider" };
  } catch (err) {
    return { id, ok: false, ms: Date.now() - started, error: String(err.message || err) };
  }
}

export async function pulseBackends() {
  const ids = PROVIDER_CATALOG.map((p) => p.id);
  const results = await Promise.all(ids.map((id) => pingProvider(id)));
  const ok = results.filter((r) => r.ok).sort((a, b) => a.ms - b.ms);
  return {
    results,
    fastest: ok[0] || null,
    ollama: await ollamaTags().catch(() => []),
  };
}
