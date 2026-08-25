export function engineBase() {
  if (typeof window !== "undefined" && window.localmodDesktop?.isDesktop) {
    return "http://127.0.0.1:4781";
  }
  return import.meta.env.VITE_ENGINE_URL || "/engine";
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${engineBase()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

async function streamSse(
  path: string,
  body: unknown,
  handlers: Record<string, (data: any) => void>,
  signal?: AbortSignal
) {
  const res = await fetch(`${engineBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(await res.text());
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let carry = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const parts = carry.split("\n\n");
    carry = parts.pop() || "";
    for (const block of parts) {
      const ev = /event: (\w+)/.exec(block)?.[1];
      const data = block.split("data: ").slice(1).join("data: ");
      if (!ev) continue;
      try {
        handlers[ev]?.(JSON.parse(data));
      } catch {
        handlers[ev]?.(data);
      }
    }
  }
}

export function streamChat(body: unknown, onChunk: (s: string) => void, signal?: AbortSignal) {
  let meta: unknown = null;
  return streamSse(
    "/chat",
    body,
    {
      meta: (d) => {
        meta = d;
      },
      token: onChunk,
    },
    signal
  ).then(() => meta);
}

export function streamForge(
  body: unknown,
  handlers: {
    onToken?: (s: string) => void;
    onEvent?: (e: any) => void;
    onSession?: (s: any) => void;
    onDone?: (s: any) => void;
    onError?: (e: any) => void;
  },
  signal?: AbortSignal
) {
  return streamSse(
    "/forge/run",
    body,
    {
      token: (d) => handlers.onToken?.(typeof d === "string" ? d : String(d)),
      event: (d) => handlers.onEvent?.(d),
      session: (d) => handlers.onSession?.(d),
      done: (d) => handlers.onDone?.(d),
      error: (d) => handlers.onError?.(d),
    },
    signal
  );
}

/** @deprecated use streamForge */
export const streamCursor = streamForge;

export const ENGINE = "/engine";
