import { useEffect, useState } from "react";
import { api } from "./engine";

const ALLOWED = "git, ls, dir, pwd, npm, node, npx, python, python3, pip, cargo, go, rg, grep";

export default function App() {
  const [settings, setSettings] = useState<any>({});
  const [cwd, setCwd] = useState("");
  const [goal, setGoal] = useState("List the top-level files and run git status.");
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    document.title = "Ironmantis";
    (async () => {
      try {
        const s = await api<any>("/settings");
        setSettings(s);
        setCwd(s.cursorCwd || "");
      } catch (e: any) {
        setLocalErr(e.message || "NO CARRIER");
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
    <div className="im">
      <header className="im-head">
        <h1>IRONMANTIS</h1>
        <p>
          AUTONOMOUS // ALLOWLIST {ALLOWED}
          {settings.loadedModel ? ` // MODEL ${settings.loadedModel}` : ""}
        </p>
      </header>
      <div className="im-prompt">
        <div>
          <input value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="CWD" aria-label="Workspace" />
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Task" />
        </div>
        <div className="im-actions">
          <button type="button" onClick={pick}>
            CWD
          </button>
          <button className="go" disabled={busy} type="button" onClick={start}>
            {busy ? "STRIKE…" : "EXECUTE"}
          </button>
        </div>
      </div>
      <div className="im-log">
        {localErr && <div className="ln im-err">{localErr}</div>}
        {!run && !localErr && (
          <div className="ln">
            waiting for target{busy ? "" : ""}
            <span className="im-blink" />
          </div>
        )}
        {run && (
          <>
            <div className="ln">
              status {run.status} // {run.steps} steps
            </div>
            {(run.log || []).map((e: any) => (
              <div key={e.step} className="ln">
                [{e.step}] {e.action?.name}
                {"\n"}
                {e.thought} — {String(e.result || "").slice(0, 400)}
              </div>
            ))}
            <div className="ln">
              done
              <span className="im-blink" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
