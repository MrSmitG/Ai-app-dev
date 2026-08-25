export const ENGINE = "/engine";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export function streamChat(body: unknown, onChunk: (s: string) => void, signal?: AbortSignal) {
  return fetch(`${ENGINE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }).then(async (res) => {
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    let meta: unknown = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const parts = carry.split("\n\n");
      carry = parts.pop() || "";
      for (const block of parts) {
        const ev = /event: (\w+)/.exec(block)?.[1];
        const data = block.split("data: ").slice(1).join("data: ");
        if (ev === "meta") meta = JSON.parse(data);
        else if (ev === "token") onChunk(JSON.parse(data));
      }
    }
    return meta;
  });
}
