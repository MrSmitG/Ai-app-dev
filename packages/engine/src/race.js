import { completeChat } from "./chat.js";

async function readFull(stream, provider) {
  const decoder = new TextDecoder();
  let text = "";
  let buf = "";
  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    if (provider === "ollama") {
      for (const line of buf.split("\n")) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          text += j.message?.content || "";
        } catch {
          /* partial */
        }
      }
      buf = buf.includes("\n") ? buf.slice(buf.lastIndexOf("\n") + 1) : buf;
    } else {
      const parts = buf.split("\n");
      buf = parts.pop() || "";
      for (const line of parts) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          text += j.choices?.[0]?.delta?.content || "";
        } catch {
          /* ignore */
        }
      }
    }
  }
  return text;
}

export async function raceModels({ prompt, system, runners }) {
  const jobs = runners.map(async (r) => {
    const started = Date.now();
    try {
      const { stream, provider } = await completeChat({
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        provider: r.provider,
        model: r.model,
      });
      const text = await readFull(stream, provider);
      return { ...r, ok: true, text, ms: Date.now() - started, tokens: text.length };
    } catch (err) {
      return { ...r, ok: false, error: String(err.message || err), ms: Date.now() - started };
    }
  });
  return Promise.all(jobs);
}
