import { useEffect, useState } from "react";
import { AppShell } from "@suite/shell";
import { api } from "@suite/api";
import { useEngine } from "@suite/useEngine";

export default function App() {
  const { settings, patch, err } = useEngine();
  const [cwd, setCwd] = useState("");
  const [goal, setGoal] = useState("Find the engine HTTP routes and add a one-line comment on GET /health.");
  const [query, setQuery] = useState('pathname === "/health"');
  const [tree, setTree] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    setCwd(settings.cursorCwd || cwd);
  }, [settings.cursorCwd]);

  async function pick() {
    const r = await api<{ cancelled?: boolean; path?: string }>("/forge/pick-cwd", { method: "POST" });
    if (!r.cancelled && r.path) {
      setCwd(r.path);
      await patch({ cursorCwd: r.path });
    }
  }

  async function indexTree() {
    setLocalErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setTree(await api<any>(`/codebase/tree?cwd=${encodeURIComponent(cwd)}`));
    } catch (e: any) {
      setLocalErr(e.message);
    }
  }

  async function run(apply: boolean) {
    setBusy(true);
    setLocalErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setResult(await api<any>("/nightweaver/run", { method: "POST", body: JSON.stringify({ cwd, goal, query, apply }) }));
    } catch (e: any) {
      setLocalErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell appId="nightweaver" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">Nightweaver · agentic coding only</div>
          <h2 className="owner-name">Unseen. Spinning webs of code.</h2>
          <p className="muted">This React app indexes, searches, and edits files. Chat, keys, and CLI are other apps.</p>
        </div>
        {localErr && <div className="banner">{localErr}</div>}
        <div className="panel">
          <label>
            Workspace
            <div className="row">
              <input className="grow" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Project folder" />
              <button className="btn" type="button" onClick={pick}>Browse</button>
              <button className="btn" type="button" onClick={indexTree}>Index</button>
            </div>
          </label>
          <label>
            Search (optional)
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Symbol or string" />
          </label>
          <label>
            Goal
            <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <div className="row wrap">
            <button className="btn primary" disabled={busy} type="button" onClick={() => run(false)}>Plan edits</button>
            <button className="btn" disabled={busy} type="button" onClick={() => run(true)}>Apply edits</button>
          </div>
          {tree && (
            <div className="muted tiny pad-sm">
              {tree.root} · {tree.files?.length || 0} paths {tree.truncated ? "(truncated)" : ""}
            </div>
          )}
        </div>
        {result && (
          <div className="panel">
            <div className="section-label">Web</div>
            <p>{result.thought}</p>
            {(result.edits || []).length === 0 && <div className="muted">No file edits proposed.</div>}
            {(result.edits || []).map((e: any) => (
              <div key={e.path} className="event-row">
                <span className="event-type">{e.path}</span>
                <span className="muted">
                  {e.reason} · {e.bytes} bytes {result.applied?.some((a: any) => a.path === e.path) ? "· applied" : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
