import { useEffect, useState } from "react";
import { api } from "./engine";

export default function App() {
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState("Reply with one word: pong");
  const [race, setRace] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function ping() {
    try {
      setData(await api<any>("/mako"));
      setErr("");
    } catch (e: any) {
      setErr(e.message || "no signal");
    }
  }

  useEffect(() => {
    document.title = "Mako";
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
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const results: any[] = data?.results || [];
  const maxMs = Math.max(1, ...results.filter((r) => r.ok).map((r) => r.ms || 1));

  return (
    <div className="mk">
      <header className="mk-top">
        <h1>Mako</h1>
        <p>{err || "FASTEST IN THE WATER"}</p>
      </header>
      <div className="mk-hero">
        <p className="mk-num">
          {data?.fastest?.ms ?? "—"}
          <small>{data?.fastest ? `${data.fastest.id} MS` : "PING FIRST"}</small>
        </p>
        <div className="mk-lanes">
          {results.map((r) => (
            <div key={r.id} className={`lane ${r.ok ? "" : "dead"}`}>
              <span>{r.id}</span>
              <div className="bar">
                <i style={{ width: r.ok ? `${Math.max(8, (r.ms / maxMs) * 100)}%` : "8%" }} />
              </div>
              <span>{r.ok ? `${r.ms}ms` : "DNF"}</span>
            </div>
          ))}
          {!results.length && <div className="lane">No backends yet.</div>}
        </div>
      </div>
      <button type="button" onClick={ping}>
        Ping backends
      </button>
      <div className="mk-race">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Race prompt" />
        <button className="ghost" disabled={busy} type="button" onClick={runRace}>
          {busy ? "Racing" : "Race"}
        </button>
      </div>
      {race && (
        <div className="mk-fin">
          {race.map((r, i) => (
            <div key={i}>
              <span>{r.provider}</span>
              <span>{r.ms}ms</span>
              <span>{r.ok ? String(r.text || "").slice(0, 120) : r.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
