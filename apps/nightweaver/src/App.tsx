import { useEffect, useState } from "react";
import { api } from "./engine";

export default function App() {
  const [settings, setSettings] = useState<any>({});
  const [cwd, setCwd] = useState("");
  const [goal, setGoal] = useState("Find the engine HTTP routes and add a one-line comment on GET /health.");
  const [query, setQuery] = useState('pathname === "/health"');
  const [tree, setTree] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const [engineErr, setEngineErr] = useState("");

  useEffect(() => {
    document.title = "Nightweaver";
    (async () => {
      try {
        const s = await api<any>("/settings");
        setSettings(s);
        setCwd(s.cursorCwd || "");
        setEngineErr("");
      } catch (e: any) {
        setEngineErr(e.message || "engine offline");
      }
    })();
  }, []);

  async function patch(partial: Record<string, unknown>) {
    const next = await api<any>("/settings", { method: "POST", body: JSON.stringify(partial) });
    setSettings(next);
    return next;
  }

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

  const files: string[] = (tree?.files || []).slice(0, 80);

  return (
    <div className="nw">
      <header className="nw-bar">
        <div className="nw-dots" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <strong>Nightweaver</strong>
        <span>· {cwd || "no workspace"}</span>
        <span className="muted">{engineErr || settings.loadedModel || "idle"}</span>
      </header>
      <div className="nw-cols">
        <aside className="nw-files">
          <div className="nw-k">Workspace</div>
          <div className="nw-row">
            <input className="grow" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="/path/to/repo" />
          </div>
          <div className="nw-row">
            <button type="button" onClick={pick}>Browse</button>
            <button type="button" onClick={indexTree}>Index</button>
          </div>
          <div className="nw-k" style={{ marginTop: 18 }}>
            Tree {tree ? `· ${tree.files?.length || 0}` : ""}
          </div>
          {!files.length && <div className="muted" style={{ color: "#8b7aa8", fontSize: 12 }}>Index a folder to spin the web.</div>}
          {files.map((f) => (
            <div key={f} className="nw-path" title={f}>
              {f}
            </div>
          ))}
        </aside>
        <section className="nw-main">
          <div className="nw-k">Spin a web</div>
          <label>
            Search
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="symbol or string" />
          </label>
          <label>
            Goal
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <div className="nw-row">
            <button className="primary" disabled={busy} type="button" onClick={() => run(false)}>
              Plan edits
            </button>
            <button disabled={busy} type="button" onClick={() => run(true)}>
              Apply
            </button>
          </div>
          {localErr && <div className="nw-err">{localErr}</div>}
          {result && (
            <>
              <p>{result.thought}</p>
              {(result.edits || []).map((e: any) => (
                <div key={e.path} className="nw-edit">
                  <b>{e.path}</b>
                  {e.reason} · {e.bytes} bytes
                  {result.applied?.some((a: any) => a.path === e.path) ? " · applied" : ""}
                </div>
              ))}
              {(result.edits || []).length === 0 && <p style={{ color: "#8b7aa8" }}>No file edits proposed.</p>}
            </>
          )}
        </section>
        <aside className="nw-log">
          <div className="nw-k">Activity</div>
          <div className="nw-line">$ nightweaver index {cwd ? `"${cwd}"` : "<cwd>"}</div>
          {tree && <div className="nw-line">indexed {tree.files?.length || 0} paths{tree.truncated ? " (truncated)" : ""}</div>}
          {result && (
            <>
              <div className="nw-line">plan: {(result.edits || []).length} files · hits {result.hits ?? 0}</div>
              {result.usedFallback ? <div className="nw-line">fallback (no LLM)</div> : null}
            </>
          )}
          {busy && <div className="nw-line">weaving…</div>}
        </aside>
      </div>
    </div>
  );
}
