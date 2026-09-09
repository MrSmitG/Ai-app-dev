import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useEngine() {
  const [settings, setSettings] = useState<any>({});
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      setSettings(await api<any>("/settings"));
      setErr("");
    } catch (e: any) {
      setErr(e.message || "Engine not running on 127.0.0.1:4781");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function patch(partial: Record<string, unknown>) {
    const next = await api<any>("/settings", { method: "POST", body: JSON.stringify(partial) });
    setSettings(next);
    return next;
  }

  return { settings, patch, err, refresh };
}
