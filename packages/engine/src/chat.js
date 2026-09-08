import { getSettings } from "./settings.js";
import { autotune } from "./autotune.js";
import { llamaBase } from "./inference.js";
import { ollamaChat } from "./ollama.js";
import { retrieve } from "./rag.js";
import { appendIntegrity } from "./integrity.js";
import { skillSystemPrompt } from "./skills.js";
import { contentToText, packMessages, toOllamaMessages } from "./context.js";

export async function completeChat({ messages, collectionId, provider, model, signal, vision, stream }) {
  const s = getSettings();
  const systemPrompt = skillSystemPrompt(s.systemPrompt);
  let params = {
    temperature: s.temperature,
    topP: s.topP,
    topK: s.topK,
    minP: s.minP,
    typicalP: s.typicalP,
    repeatPenalty: s.repeatPenalty,
    presencePenalty: s.presencePenalty,
    frequencyPenalty: s.frequencyPenalty,
    mirostat: s.mirostat,
    mirostatTau: s.mirostatTau,
    mirostatEta: s.mirostatEta,
    contextLength: s.contextLength,
    seed: s.seed,
    maxTokens: s.maxTokens,
    stop: String(s.stopSequences || "")
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean),
  };
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === "user");
  const lastUserText = contentToText(lastUser?.content) || "";
  let tune = null;
  if (s.autotune) {
    tune = autotune(lastUserText);
    params = { ...params, ...tune };
  }
  let working = Array.isArray(messages) ? [...messages] : [];
  let citations = [];
  if (collectionId) {
    const rag = await retrieve(collectionId, lastUserText, 6);
    citations = rag.citations;
    const ctx = rag.citations
      .map((c, i) => `[${i + 1}] ${c.filename} p.${c.page}\n${c.snippet}`)
      .join("\n\n");
    working = [
      {
        role: "system",
        content: `${systemPrompt}\n\nUse only the sources below. Cite them as [n].\n\n${ctx}`,
      },
      ...working.filter((m) => m.role !== "system"),
    ];
  } else if (systemPrompt && !working.some((m) => m.role === "system")) {
    working = [{ role: "system", content: systemPrompt }, ...working];
  }

  const packed = packMessages(working, {
    contextLength: params.contextLength,
    reserveTokens: s.contextReserveTokens ?? Math.min(2048, Math.floor((params.contextLength || 4096) * 0.25)),
    keepRecent: s.contextKeepRecent ?? 24,
    compact: s.contextCompact !== false,
    imageTokenCost: s.imageTokenCost ?? 768,
    vision: vision !== false && s.visionEnabled !== false,
  });
  const finalMessages = packed.messages;

  const streamChat = stream !== undefined ? Boolean(stream) : s.streamChat !== false;
  const useOllama = provider === "ollama" || s.provider === "ollama";
  const started = Date.now();
  const route = provider || s.provider || "llama";
  if (["openai", "anthropic", "openrouter", "custom"].includes(route)) {
    if (s.airplane) throw new Error("Airplane mode blocks cloud providers. Use llama or Ollama, or turn airplane off.");
    return completeCloud({ route, s, finalMessages, streamChat, citations, tune, packed, started, model, signal });
  }
  if (useOllama) {
    const res = await ollamaChat({
      model: model || s.loadedModel || "llama3.2",
      messages: toOllamaMessages(finalMessages),
      stream: streamChat,
      params,
    });
    return { stream: res.body, citations, tune, provider: "ollama", started, context: packed.usage };
  }

  const body = {
    model: model || "local",
    messages: finalMessages,
    stream: streamChat,
    temperature: params.temperature,
    top_p: params.topP,
    top_k: params.topK,
    min_p: params.minP,
    typical_p: params.typicalP,
    repeat_penalty: params.repeatPenalty,
    presence_penalty: params.presencePenalty,
    frequency_penalty: params.frequencyPenalty,
    seed: params.seed >= 0 ? params.seed : undefined,
    max_tokens: params.maxTokens > 0 ? params.maxTokens : undefined,
    stop: params.stop?.length ? params.stop : undefined,
  };
  if (params.mirostat > 0) {
    body.mirostat = params.mirostat;
    body.mirostat_tau = params.mirostatTau;
    body.mirostat_eta = params.mirostatEta;
  }

  const res = await fetch(`${llamaBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Inference failed (${res.status})`);
  }
  return { stream: res.body, citations, tune, provider: "llama", started, context: packed.usage };
}

function openaiCompatibleBase(route, s) {
  if (route === "openai") return { base: "https://api.openai.com/v1", key: s.openaiApiKey, model: s.openaiModel || "gpt-4o-mini" };
  if (route === "openrouter") {
    return {
      base: "https://openrouter.ai/api/v1",
      key: s.openrouterApiKey,
      model: s.openrouterModel || "openai/gpt-4o-mini",
      extra: { "HTTP-Referer": "https://localmod.app", "X-Title": "Localmod" },
    };
  }
  return {
    base: String(s.customApiBase || "").replace(/\/$/, ""),
    key: s.customApiKey || "",
    model: s.customApiModel || "local",
    extra: {},
  };
}

async function completeCloud({ route, s, finalMessages, streamChat, citations, tune, packed, started, model, signal }) {
  if (route === "anthropic") {
    if (!s.anthropicApiKey) throw new Error("Add an Anthropic key in Keyring.");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": s.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || s.anthropicModel || "claude-sonnet-4-20250514",
        max_tokens: s.maxTokens > 0 ? s.maxTokens : 2048,
        stream: false,
        messages: finalMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
        system: finalMessages.find((m) => m.role === "system")?.content,
      }),
      signal,
    });
    if (!res.ok) throw new Error((await res.text()) || `Anthropic failed (${res.status})`);
    const j = await res.json();
    const text = (j.content || []).map((c) => c.text || "").join("");
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
        c.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        c.close();
      },
    });
    return { stream, citations, tune, provider: "openai", started, context: packed.usage };
  }
  const cfg = openaiCompatibleBase(route, s);
  if (!cfg.base) throw new Error("Set a custom API base URL in Keyring.");
  if (route !== "custom" && !cfg.key) throw new Error(`Add a ${route} API key in Keyring.`);
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.key ? { Authorization: `Bearer ${cfg.key}` } : {}),
      ...(cfg.extra || {}),
    },
    body: JSON.stringify({
      model: model || cfg.model,
      messages: finalMessages,
      stream: streamChat,
      temperature: s.temperature,
    }),
    signal,
  });
  if (!res.ok) throw new Error((await res.text()) || `${route} failed (${res.status})`);
  return { stream: res.body, citations, tune, provider: "openai", started, context: packed.usage };
}

/** Consume a chat completion stream into a single string (Ollama JSONL or OpenAI SSE). */
export async function collectChatText(stream, provider) {
  if (!stream) return "";
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    if (provider === "ollama") {
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const t = JSON.parse(line).message?.content || "";
          if (t) full += t;
        } catch {
          /* ignore */
        }
      }
    } else {
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const t = JSON.parse(data).choices?.[0]?.delta?.content || "";
          if (t) full += t;
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (provider === "ollama") {
    const rest = buf.trim();
    if (rest) {
      try {
        const t = JSON.parse(rest).message?.content || "";
        if (t) full += t;
      } catch {
        /* ignore */
      }
    }
  }
  return full.trim();
}

export async function completeOnce(opts) {
  const result = await completeChat({ ...opts, stream: true });
  const text = await collectChatText(result.stream, result.provider);
  return { text, provider: result.provider, citations: result.citations, context: result.context };
}

export function logTurn({ provider, model, prompt, response }) {
  appendIntegrity({ provider, model, prompt, response });
}
