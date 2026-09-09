import { useCallback, useEffect, useState } from "react";
import { api } from "./engine";

export default function App() {
  const [settings, setSettings] = useState<any>({});
  const [rows, setRows] = useState<any[]>([]);
  const [ping, setPing] = useState<any>(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    try {
      const s = await api<any>("/settings");
      setSettings(s);
      const r = await api<any>("/providers");
      setRows(r.providers || []);
      setErr("");
    } catch (e: any) {
      setErr(e.message || "vault unreachable");
    }
  }, []);

  useEffect(() => {
    document.title = "Obsidian";
    refresh();
  }, [refresh]);

  async function patch(partial: Record<string, unknown>) {
    const next = await api<any>("/settings", { method: "POST", body: JSON.stringify(partial) });
    setSettings(next);
    const r = await api<any>("/providers");
    setRows(r.providers || []);
    return next;
  }

  return (
    <div className="ob">
      <header className="ob-seal">
        <h1>Obsidian</h1>
        <p>The vault</p>
        <div className="ob-live">{err || "Keys never leave this chamber."}</div>
      </header>
      <div className="ob-grid">
        {rows.map((p) => (
          <article key={p.id} className={`tablet ${p.active ? "on" : ""}`}>
            <div className="kind">{p.kind}</div>
            <h2>{p.name}</h2>
            <p>{p.blurb}</p>
            {p.keyField && (
              <label>
                Token
                <input
                  type="password"
                  value={settings[p.keyField] || ""}
                  onChange={(e) => patch({ [p.keyField]: e.target.value })}
                  placeholder="sk-…"
                />
              </label>
            )}
            {p.modelField && (
              <label>
                Model
                <input
                  value={settings[p.modelField] || p.defaultModel || ""}
                  onChange={(e) => patch({ [p.modelField]: e.target.value })}
                />
              </label>
            )}
            {p.baseField && (
              <label>
                Gate
                <input
                  value={settings[p.baseField] || ""}
                  onChange={(e) => patch({ [p.baseField]: e.target.value })}
                  placeholder="https://api.together.xyz/v1"
                />
              </label>
            )}
            <div className="ob-row">
              <button className="solid" type="button" onClick={() => patch({ provider: p.id })} disabled={p.airplaneBlocked}>
                {p.active ? "Sealed in" : "Use"}
              </button>
              <button type="button" onClick={async () => setPing(await api<any>("/providers/ping", { method: "POST", body: JSON.stringify({ id: p.id }) }))}>
                Test
              </button>
            </div>
            {p.airplaneBlocked && <p>Blocked in airplane mode.</p>}
          </article>
        ))}
      </div>
      {ping && (
        <div className="ob-ping">
          {ping.id}: {ping.ok ? `holds · ${ping.ms}ms` : ping.error || `HTTP ${ping.status}`}
        </div>
      )}
    </div>
  );
}
