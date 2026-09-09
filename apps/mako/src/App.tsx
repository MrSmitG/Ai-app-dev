import { useEffect, useState } from "react";
import { AppShell } from "@suite/shell";
import { api } from "@suite/api";
import { useEngine } from "@suite/useEngine";

export default function App() {
  const { err } = useEngine();
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState("Reply with one word: pong");
  const [race, setRace] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function ping() {
    setData(await api<any>("/mako"));
  }

  useEffect(() => {
    ping();
  }, []);

  async function runRace() {
    setBusy(true);
    try {
      const runners = (data?.results || [])
        .filter((r: any) => r.ok)
        .slice(0, 3)
        .map((r: any) => ({ provider: r.id, model: "" }));
      if (!runners.length) runners.push({ provider: "ollama", model: "" }, { provider: "llama", model: "" });
      const out = await api<any>("/race", { method: "POST", body: JSON.stringify({ prompt, runners }) });
      setRace(Array.isArray(out) ? out : out.results || []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell appId="mako" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">Mako · speed only</div>
          <h2 className="owner-name">Fastest in the water.</h2>
          <p className="muted">This React app only pings and races. Put keys in Obsidian. Chat in Blackwhale.</p>
        </div>
        <div className="panel">
          <div className="row wrap">
            <button className="btn primary" type="button" onClick={ping}>Ping backends</button>
          </div>
          {data?.fastest && (
            <p className="muted">
              Fastest right now: <strong>{data.fastest.id}</strong> ({data.fastest.ms}ms)
            </p>
          )}
          <div className="suite-grid pad-sm">
            {(data?.results || []).map((r: any) => (
              <div key={r.id} className={`suite-card ${r.ok ? "on" : ""}`}>
                <div className="suite-name">{r.id}</div>
                <div className="muted tiny">{r.ok ? `${r.ms}ms ${r.detail || ""}` : r.error || `HTTP ${r.status}`}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <label>
            Race prompt
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <button className="btn" disabled={busy} type="button" onClick={runRace}>Race live backends</button>
          {race &&
            race.map((r: any, i: number) => (
              <div key={i} className="event-row">
                <span className="event-type">
                  {r.provider} {r.ms}ms
                </span>
                <span className="muted">{r.ok ? String(r.text || "").slice(0, 160) : r.error}</span>
              </div>
            ))}
        </div>
      </section>
    </AppShell>
  );
}
