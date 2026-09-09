import { useEffect, useState } from "react";
import { AppShell } from "@suite/shell";
import { api } from "@suite/api";
import { useEngine } from "@suite/useEngine";

const ALLOWED = "git, ls, dir, pwd, npm, node, npx, python, python3, pip, cargo, go, rg, grep";

export default function App() {
  const { settings, patch, err } = useEngine();
  const [cwd, setCwd] = useState("");
  const [goal, setGoal] = useState("List the top-level files and run git status.");
  const [run, setRun] = useState<any>(null);
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

  async function start() {
    setBusy(true);
    setLocalErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setRun(await api<any>("/ironmantis/run", { method: "POST", body: JSON.stringify({ cwd, goal, maxSteps: 6 }) }));
    } catch (e: any) {
      setLocalErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell appId="ironmantis" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">Ironmantis · autonomous only</div>
          <h2 className="owner-name">Ruthless precision. Finish the job.</h2>
          <p className="muted">This React app runs multi-step file + CLI work. Single-file polish is The Trench. Chat is Blackwhale.</p>
        </div>
        {localErr && <div className="banner">{localErr}</div>}
        <div className="panel">
          <label>
            Workspace
            <div className="row">
              <input className="grow" value={cwd} onChange={(e) => setCwd(e.target.value)} />
              <button className="btn" type="button" onClick={pick}>Browse</button>
            </div>
          </label>
          <label>
            Task
            <textarea rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy} type="button" onClick={start}>
            {busy ? "Striking…" : "Run Ironmantis"}
          </button>
          <div className="muted tiny pad-sm">Allowlisted CLI: {ALLOWED}</div>
        </div>
        {run && (
          <div className="panel">
            <div className="section-label">
              Log · {run.status} · {run.steps} steps
            </div>
            {(run.log || []).map((e: any) => (
              <div key={e.step} className="event-row">
                <span className="event-type">{e.action?.name}</span>
                <span className="muted">
                  {e.thought} — {String(e.result || "").slice(0, 220)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
