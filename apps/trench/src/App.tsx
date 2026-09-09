import { useEffect, useState } from "react";
import { AppShell } from "@suite/shell";
import { api } from "@suite/api";
import { useEngine } from "@suite/useEngine";

export default function App() {
  const { settings, patch, err } = useEngine();
  const [cwd, setCwd] = useState("");
  const [rel, setRel] = useState("README.md");
  const [instruction, setInstruction] = useState("Tighten the opening paragraph. Keep it one file.");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const port = settings.apiPort || 4782;

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

  async function run(apply: boolean) {
    setBusy(true);
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setOut(await api<any>("/trench/inline", { method: "POST", body: JSON.stringify({ cwd, path: rel, instruction, apply }) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell appId="trench" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">The Trench · editor only</div>
          <h2 className="owner-name">Dive in. One file. Until it is done.</h2>
          <p className="muted">This React app is single-file inline edit plus the VS Code hook. Multi-file plans and CLI are other apps.</p>
        </div>
        <div className="forge-split">
          <div className="panel">
            <div className="section-label">Workspace for this dive</div>
            <label>
              Folder
              <div className="row">
                <input className="grow" value={cwd} onChange={(e) => setCwd(e.target.value)} />
                <button className="btn" type="button" onClick={pick}>Browse</button>
              </div>
            </label>
            <div className="section-label">VS Code</div>
            <ol className="muted">
              <li>Engine on 127.0.0.1:4781</li>
              <li>
                <code className="mono">code --install-extension apps/keep</code>
              </li>
              <li>Command Palette → Localmod Editor: Chat</li>
            </ol>
            <p className="muted tiny">
              OpenAI-compatible base: <code>http://127.0.0.1:{port}/v1</code>
            </p>
            <button className="btn" type="button" onClick={() => api("/api-server/start", { method: "POST" })}>
              Start local API
            </button>
          </div>
          <div className="panel">
            <div className="section-label">Inline edit (one file)</div>
            <label>
              Workspace-relative file
              <input value={rel} onChange={(e) => setRel(e.target.value)} />
            </label>
            <label>
              Instruction
              <textarea rows={3} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
            </label>
            <div className="row wrap">
              <button className="btn primary" disabled={busy || !cwd} type="button" onClick={() => run(false)}>Preview</button>
              <button className="btn" disabled={busy || !cwd} type="button" onClick={() => run(true)}>Apply</button>
            </div>
            {!cwd && <div className="muted tiny">Pick a folder in The Trench — you do not need Nightweaver for this.</div>}
            {out && (
              <>
                <div className="muted tiny">
                  {out.thought} {out.applied ? "· applied" : ""}
                </div>
                <pre className="mono tiny keep-diff">{String(out.proposed || "").slice(0, 2500)}</pre>
              </>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
