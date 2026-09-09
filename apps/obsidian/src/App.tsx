import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@suite/shell";
import { api } from "@suite/api";
import { useEngine } from "@suite/useEngine";

export default function App() {
  const { settings, patch, err } = useEngine();
  const [rows, setRows] = useState<any[]>([]);
  const [ping, setPing] = useState<any>(null);

  const load = useCallback(async () => {
    const r = await api<any>("/providers");
    setRows(r.providers || []);
  }, []);

  useEffect(() => {
    load();
  }, [load, settings.provider, settings.openaiApiKey, settings.anthropicApiKey, settings.openrouterApiKey, settings.customApiBase]);

  async function activate(id: string) {
    await patch({ provider: id });
    load();
  }

  async function test(id: string) {
    setPing(await api<any>("/providers/ping", { method: "POST", body: JSON.stringify({ id }) }));
  }

  return (
    <AppShell appId="obsidian" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">Obsidian · keys only</div>
          <h2 className="owner-name">Dark. Unbreakable. The vault.</h2>
          <p className="muted">This React app only stores and tests providers. Chat and racing happen elsewhere.</p>
        </div>
        <div className="suite-grid">
          {rows.map((p) => (
            <div key={p.id} className={`suite-card ${p.active ? "on" : ""}`}>
              <div className="suite-usage">{p.kind}</div>
              <div className="suite-name">{p.name}</div>
              <div className="muted tiny">{p.blurb}</div>
              {p.keyField && (
                <label>
                  API key
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
                  Base URL
                  <input
                    value={settings[p.baseField] || ""}
                    onChange={(e) => patch({ [p.baseField]: e.target.value })}
                    placeholder="https://api.together.xyz/v1"
                  />
                </label>
              )}
              <div className="row wrap pad-sm">
                <button className="btn primary" type="button" onClick={() => activate(p.id)} disabled={p.airplaneBlocked}>
                  {p.active ? "Active" : "Use"}
                </button>
                <button className="btn" type="button" onClick={() => test(p.id)}>Test</button>
              </div>
              {p.airplaneBlocked && <div className="muted tiny">Blocked in airplane mode.</div>}
            </div>
          ))}
        </div>
        {ping && (
          <div className="banner">
            {ping.id}: {ping.ok ? `ok ${ping.ms}ms` : ping.error || `HTTP ${ping.status}`}
          </div>
        )}
      </section>
    </AppShell>
  );
}
