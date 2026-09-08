import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Tip } from "./ui";

export function SuiteHome({
  setTab,
}: {
  setTab: (id: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<any>("/suite"));
      setErr("");
    } catch (e: any) {
      setErr(e.message || "Could not load suite");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apps = data?.apps || [];
  const live = data?.live || {};

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">
          Localmod Suite <Tip text="Named apps by usage: agentic coding, BYOK, speed, IDE extensions, autonomous engineer — plus Studio for chat and models." />
        </div>
        <h2 className="owner-name">A suite of local-first AI systems</h2>
        <p className="muted">
          Pick the app for the job. All of them talk to the same engine on this machine. Cloud keys are optional and never required.
        </p>
        <div className="muted tiny">
          Live: {live.llama ? "llama-server" : "no llama"} · Ollama tags {live.ollamaTags || 0} · provider {live.provider || "—"}
          {live.airplane ? " · airplane" : ""} · keys { (live.keys || []).join(", ") || "none" }
        </div>
      </div>
      {err && <div className="banner">{err}</div>}
      <div className="suite-grid">
        {apps.map((app: any) => (
          <button key={app.id} type="button" className="suite-card" onClick={() => setTab(app.id === "studio" ? "chat" : app.id)}>
            <div className="suite-usage">{app.usage}</div>
            <div className="suite-name">{app.name}</div>
            <div className="muted tiny">{app.tagline}</div>
            <p className="muted">{app.blurb}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CurrentApp({
  settings,
  patch,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
}) {
  const [cwd, setCwd] = useState(settings.cursorCwd || "");
  const [goal, setGoal] = useState("Find the engine HTTP routes and add a one-line comment on GET /health.");
  const [query, setQuery] = useState("pathname === \"/health\"");
  const [tree, setTree] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
    setErr("");
    try {
      setTree(await api<any>(`/codebase/tree?cwd=${encodeURIComponent(cwd)}`));
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function run(apply: boolean) {
    setBusy(true);
    setErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setResult(await api<any>("/current/run", { method: "POST", body: JSON.stringify({ cwd, goal, query, apply }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Current · agentic coding</div>
        <h2 className="owner-name">Deep context. Multi-file edits.</h2>
        <p className="muted">
          Current indexes the workspace, searches the tree, then coordinates edits across files — an agentic partner, not a single-line completer.
        </p>
      </div>
      {err && <div className="banner">{err}</div>}
      <div className="panel">
        <label>
          Workspace
          <div className="row">
            <input className="grow" value={cwd} onChange={(e) => setCwd(e.target.value)} placeholder="Project folder" />
            <button className="btn" type="button" onClick={pick}>Browse</button>
            <button className="btn" type="button" onClick={() => patch({ cursorCwd: cwd }).then(indexTree)}>Index</button>
          </div>
        </label>
        <label>
          Search (optional)
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Symbol or string to pull into context" />
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
          <div className="section-label">Plan</div>
          <p>{result.thought}</p>
          {(result.edits || []).length === 0 && <div className="muted">No file edits proposed.</div>}
          {(result.edits || []).map((e: any) => (
            <div key={e.path} className="event-row">
              <span className="event-type">{e.path}</span>
              <span className="muted">{e.reason} · {e.bytes} bytes {result.applied?.some((a: any) => a.path === e.path) ? "· applied" : ""}</span>
            </div>
          ))}
          <div className="muted tiny">Indexed {result.filesIndexed} · hits {result.hits} {result.usedFallback ? "· fallback (no LLM)" : ""}</div>
        </div>
      )}
    </section>
  );
}

export function KeyringApp({
  settings,
  patch,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
}) {
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
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Keyring · bring your own keys</div>
        <h2 className="owner-name">Your providers. Your keys. No lock-in.</h2>
        <p className="muted">
          Localmod is not a hosted subscription. Use llama-server or Ollama for free local inference, or paste a key you already pay for.
        </p>
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
  );
}

export function PulseApp({ setTab }: { setTab: (id: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState("Reply with one word: pong");
  const [race, setRace] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function ping() {
    setData(await api<any>("/pulse"));
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
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Pulse · speed</div>
        <h2 className="owner-name">Local first. Lowest latency wins.</h2>
        <p className="muted">
          Pulse pings every backend you configured and can race the same prompt. Built for people who care about round-trip time — local GGUF and Ollama included.
        </p>
      </div>
      <div className="panel">
        <div className="row wrap">
          <button className="btn primary" type="button" onClick={ping}>Ping backends</button>
          <button className="btn" type="button" onClick={() => setTab("keyring")}>Open Keyring</button>
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
              <span className="event-type">{r.provider} {r.ms}ms</span>
              <span className="muted">{r.ok ? String(r.text || "").slice(0, 160) : r.error}</span>
            </div>
          ))}
      </div>
    </section>
  );
}

export function KeepApp({
  settings,
  patch,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
}) {
  const [rel, setRel] = useState("README.md");
  const [instruction, setInstruction] = useState("Add a one-sentence blurb that Localmod is a suite of named AI apps.");
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const cwd = settings.cursorCwd || "";
  const port = settings.apiPort || 4782;

  async function run(apply: boolean) {
    setBusy(true);
    try {
      setOut(await api<any>("/keep/inline", { method: "POST", body: JSON.stringify({ cwd, path: rel, instruction, apply }) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Keep · stay in your IDE</div>
        <h2 className="owner-name">Cursor-like chat and inline edit, in the editor you already have.</h2>
        <p className="muted">
          Keep is the Localmod extension for VS Code. It talks to the engine on this machine (Ollama or a Keyring provider) so you are not locked into a proprietary chat subscription.
        </p>
      </div>
      <div className="forge-split">
        <div className="panel">
          <div className="section-label">Install Keep in VS Code</div>
          <ol className="muted">
            <li>Keep Localmod running (engine on 127.0.0.1:4781).</li>
            <li>Optional: Tools → Local API → Start (default {port}).</li>
            <li>
              From a terminal in this repo:{" "}
              <code className="mono">code --install-extension apps/keep</code>
            </li>
            <li>Command Palette → “Localmod Keep: Chat”.</li>
          </ol>
          <p className="muted tiny">
            OpenAI-compatible base: <code>http://127.0.0.1:{port}/v1</code> — works with Keep, Continue-style clients, and anything that speaks chat completions.
          </p>
          <button className="btn" type="button" onClick={() => patch({}).then(() => api("/api-server/start", { method: "POST" }))}>
            Start local API
          </button>
        </div>
        <div className="panel">
          <div className="section-label">Inline edit (here in Studio)</div>
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
          {!cwd && <div className="muted tiny">Set a workspace in Current first.</div>}
          {out && (
            <>
              <div className="muted tiny">{out.thought} {out.applied ? "· applied" : ""}</div>
              <pre className="mono tiny keep-diff">{String(out.proposed || "").slice(0, 2500)}</pre>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function HandsApp({
  settings,
  patch,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
}) {
  const [cwd, setCwd] = useState(settings.cursorCwd || "");
  const [goal, setGoal] = useState("List the top-level files and run git status.");
  const [run, setRun] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pick() {
    const r = await api<{ cancelled?: boolean; path?: string }>("/forge/pick-cwd", { method: "POST" });
    if (!r.cancelled && r.path) {
      setCwd(r.path);
      await patch({ cursorCwd: r.path });
    }
  }

  async function start() {
    setBusy(true);
    setErr("");
    try {
      if (cwd) await patch({ cursorCwd: cwd });
      setRun(await api<any>("/hands/run", { method: "POST", body: JSON.stringify({ cwd, goal, maxSteps: 6 }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Hands · autonomous engineer</div>
        <h2 className="owner-name">Read, write, run CLI, finish the job.</h2>
        <p className="muted">
          Hands lives in this sidebar (and as a VS Code extension). It is not autocomplete: it lists files, edits them, and runs allowlisted commands like git, npm, node, and python inside your workspace.
        </p>
      </div>
      {err && <div className="banner">{err}</div>}
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
          {busy ? "Working…" : "Run Hands"}
        </button>
        <div className="muted tiny pad-sm">
          Also: <code className="mono">code --install-extension apps/hands</code>
        </div>
      </div>
      {run && (
        <div className="panel">
          <div className="section-label">Log · {run.status} · {run.steps} steps</div>
          {(run.log || []).map((e: any) => (
            <div key={e.step} className="event-row">
              <span className="event-type">{e.action?.name}</span>
              <span className="muted">{e.thought} — {String(e.result || "").slice(0, 220)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
