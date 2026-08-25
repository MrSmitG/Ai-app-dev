import { getSettings } from "./settings.js";

export async function ollamaTags() {
  const url = `${getSettings().ollamaUrl.replace(/\/$/, "")}/api/tags`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ollama not reachable at ${url}`);
  const data = await res.json();
  return (data.models || []).map((m) => ({ name: m.name, size: m.size, digest: m.digest }));
}

export async function ollamaChat({ model, messages, stream, params }) {
  const s = getSettings();
  const url = `${s.ollamaUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: Boolean(stream),
      keep_alive: s.ollamaKeepAlive || "5m",
      options: {
        temperature: params?.temperature,
        top_p: params?.topP,
        top_k: params?.topK,
        min_p: params?.minP,
        typical_p: params?.typicalP,
        num_ctx: params?.contextLength,
        repeat_penalty: params?.repeatPenalty,
        presence_penalty: params?.presencePenalty,
        frequency_penalty: params?.frequencyPenalty,
        seed: params?.seed >= 0 ? params.seed : undefined,
        num_predict: params?.maxTokens > 0 ? params.maxTokens : undefined,
        mirostat: params?.mirostat || undefined,
        mirostat_tau: params?.mirostat > 0 ? params.mirostatTau : undefined,
        mirostat_eta: params?.mirostat > 0 ? params.mirostatEta : undefined,
        stop: params?.stop?.length ? params.stop : undefined,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama chat failed (${res.status})`);
  return res;
}
