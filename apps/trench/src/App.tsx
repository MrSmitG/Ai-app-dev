import { useEffect, useState } from "react";
import { api } from "./engine";

export default function App() {
  const [settings, setSettings] = useState<any>({});
  const [cwd, setCwd] = useState("");
  const [rel, setRel] = useState("README.md");
  const [instruction, setInstruction] = useState("Tighten the opening paragraph. Keep it one file.");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const port = settings.apiPort || 4782;

  useEffect(() => {
    document.title = "The Trench";
    (async () => {
      try {
        const s = await api<any>("/settings");
        setSettings(s);
        setCwd(s.cursorCwd || "");
      } catch (e: any) {
        setErr(e.message || "engine offline");
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

  async function run(apply: boolean) {
    setBusy(true);
    setErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setOut(await api<any>("/trench/inline", { method: "POST", body: JSON.stringify({ cwd, path: rel, instruction, apply }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tr">
      <aside className="tr-depth">The Trench · {cwd ? "on station" : "surface"}</aside>
      <section className="tr-form">
        <h1>The Trench</h1>
        <div className="kicker">One file. Stay until it is done.</div>
        <label>
          Folder
          <input value={cwd} onChange={(e) => setCwd(e.target.value)} />
        </label>
        <div className="tr-row">
          <button className="ghost" type="button" onClick={pick}>
            Browse
          </button>
          <button className="ghost" type="button" onClick={() => api("/api-server/start", { method: "POST" })}>
            Local API
          </button>
        </div>
        <label>
          File
          <input value={rel} onChange={(e) => setRel(e.target.value)} />
        </label>
        <label>
          Instruction
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        </label>
        <div className="tr-row">
          <button disabled={busy || !cwd} type="button" onClick={() => run(false)}>
            Preview
          </button>
          <button disabled={busy || !cwd} type="button" onClick={() => run(true)}>
            Apply
          </button>
        </div>
        <p className="tr-note">
          VS Code: <code>code --install-extension apps/keep</code>
          <br />
          OpenAI base: http://127.0.0.1:{port}/v1
        </p>
        {err && <div className="tr-err">{err}</div>}
      </section>
      <section className="tr-stage">
        <div className="tr-path">
          {cwd ? `${cwd.replace(/\\/g, "/")}/${rel}` : "Pick a folder, then a file"}
          {out?.applied ? " · applied" : out ? " · preview" : ""}
        </div>
        {out?.thought && <div className="tr-thought">{out.thought}</div>}
        <pre className="tr-paper">{out ? String(out.proposed || "") : "The page is blank until you dive."}</pre>
      </section>
    </div>
  );
}
