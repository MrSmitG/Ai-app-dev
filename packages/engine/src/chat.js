import { getSettings } from "./settings.js";
import { autotune } from "./autotune.js";
import { llamaBase } from "./inference.js";
import { ollamaChat } from "./ollama.js";
import { retrieve } from "./rag.js";
import { appendIntegrity } from "./integrity.js";

export async function completeChat({ messages, collectionId, provider, model, signal }) {
  const s = getSettings();
  let params = {
    temperature: s.temperature,
    topP: s.topP,
    topK: s.topK,
    minP: s.minP,
    repeatPenalty: s.repeatPenalty,
    contextLength: s.contextLength,
    seed: s.seed,
  };
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  let tune = null;
  if (s.autotune) {
    tune = autotune(lastUser);
    params = { ...params, ...tune };
  }
  let finalMessages = messages;
  let citations = [];
  if (collectionId) {
    const rag = await retrieve(collectionId, lastUser, 6);
    citations = rag.citations;
    const ctx = rag.citations
      .map((c, i) => `[${i + 1}] ${c.filename} p.${c.page}\n${c.snippet}`)
      .join("\n\n");
    finalMessages = [
      {
        role: "system",
        content: `${s.systemPrompt}\n\nUse only the sources below. Cite them as [n].\n\n${ctx}`,
      },
      ...messages.filter((m) => m.role !== "system"),
    ];
  } else if (s.systemPrompt && !messages.some((m) => m.role === "system")) {
    finalMessages = [{ role: "system", content: s.systemPrompt }, ...messages];
  }

  const useOllama = provider === "ollama";
  const started = Date.now();
  if (useOllama) {
    const res = await ollamaChat({
      model: model || "llama3.2",
      messages: finalMessages,
      stream: true,
      params,
    });
    return { stream: res.body, citations, tune, provider: "ollama", started };
  }

  const res = await fetch(`${llamaBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "local",
      messages: finalMessages,
      stream: true,
      temperature: params.temperature,
      top_p: params.topP,
      top_k: params.topK,
      min_p: params.minP,
      seed: params.seed > 0 ? params.seed : undefined,
    }),
    signal,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Inference failed (${res.status})`);
  }
  return { stream: res.body, citations, tune, provider: "llama", started };
}

export function logTurn({ provider, model, prompt, response }) {
  appendIntegrity({ provider, model, prompt, response });
}
