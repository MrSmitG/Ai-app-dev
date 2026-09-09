export function engineBase() {
  if (typeof window !== "undefined" && (window as { localmodDesktop?: { isDesktop?: boolean } }).localmodDesktop?.isDesktop) {
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
