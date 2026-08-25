import { getSettings } from "./settings.js";
import { autotune } from "./autotune.js";
import { llamaBase } from "./inference.js";
import { ollamaChat } from "./ollama.js";
import { retrieve } from "./rag.js";
import { appendIntegrity } from "./integrity.js";
import { skillSystemPrompt } from "./skills.js";
import { contentToText, packMessages, toOllamaMessages } from "./context.js";

export async function completeChat({ messages, collectionId, provider, model, signal, vision }) {
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

  const useOllama = provider === "ollama" || s.provider === "ollama";
  const started = Date.now();
  if (useOllama) {
    const res = await ollamaChat({
      model: model || s.loadedModel || "llama3.2",
      messages: toOllamaMessages(finalMessages),
      stream: s.streamChat !== false,
      params,
    });
    return { stream: res.body, citations, tune, provider: "ollama", started, context: packed.usage };
  }

  const body = {
    model: model || "local",
    messages: finalMessages,
    stream: s.streamChat !== false,
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

export function logTurn({ provider, model, prompt, response }) {
  appendIntegrity({ provider, model, prompt, response });
}
