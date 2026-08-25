import { getSettings } from "./settings.js";

export async function ollamaTags() {
  const url = `${getSettings().ollamaUrl.replace(/\/$/, "")}/api/tags`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ollama not reachable at ${url}`);
  const data = await res.json();
  return (data.models || []).map((m) => ({ name: m.name, size: m.size, digest: m.digest }));
}

export async function ollamaChat({ model, messages, stream, params }) {
  const url = `${getSettings().ollamaUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: Boolean(stream),
      options: {
        temperature: params?.temperature,
        top_p: params?.topP,
        top_k: params?.topK,
        num_ctx: params?.contextLength,
        repeat_penalty: params?.repeatPenalty,
      },
    }),
  });
  if (!res.ok) throw new Error(`Ollama chat failed (${res.status})`);
  return res;
}
