import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamChat } from "../api";
import { Tip } from "./ui";

export function SuiteHome({
  setTab,
}: {
  setTab: (id: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [dest, setDest] = useState("");
  const [installOut, setInstallOut] = useState<any>(null);
  const [busy, setBusy] = useState("");

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

  async function browse() {
    const r = await api<{ cancelled?: boolean; path?: string }>("/install/pick", { method: "POST" });
    if (!r.cancelled && r.path) setDest(r.path);
  }

  async function runInstall(mode: string) {
    if (!dest.trim()) {
      setErr("Choose a folder path first (Browse works on Mac and Windows).");
      return;
    }
    setBusy(mode);
    setErr("");
    try {
      setInstallOut(await api<any>("/install", { method: "POST", body: JSON.stringify({ dest, mode }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  const apps = data?.apps || [];
  const live = data?.live || {};

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">
          Localmod <Tip text="Six React apps: Blackwhale, Nightweaver, Obsidian, Mako, The Trench, Ironmantis. Start one, then another." />
        </div>
        <h2 className="owner-name">Apex names. Six React apps. Start one.</h2>
        <p className="muted">
          Each app is its own React process. Run <code className="mono">npm run blackwhale</code>, then{" "}
          <code className="mono">npm run nightweaver</code>, and so on — or open a card here in the hub.
        </p>
        <div className="muted tiny">
          Live: {live.llama ? "llama-server" : "no llama"} · Ollama tags {live.ollamaTags || 0} · provider {live.provider || "—"}
          {live.airplane ? " · airplane" : ""} · {live.platform || ""}
        </div>
      </div>
      {err && <div className="banner">{err}</div>}
      <div className="panel">
        <div className="section-label">Install to a file path</div>
        <p className="muted">
          Browse a folder on this Mac or PC. Copy the React suite files there, or drop the ready-to-run Windows / Mac download into that folder.
        </p>
        <label>
          Folder
          <div className="row">
            <input className="grow" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="C:\Apps  or  /Users/you/Applications" />
            <button className="btn" type="button" onClick={browse}>Browse</button>
          </div>
        </label>
        <div className="row wrap pad-sm">
          <button className="btn primary" disabled={!!busy} type="button" onClick={() => runInstall("files")}>
            {busy === "files" ? "Copying…" : "Copy all files here"}
          </button>
          <button className="btn" disabled={!!busy} type="button" onClick={() => runInstall("windows")}>
            {busy === "windows" ? "Downloading…" : "Download Windows (Localmod.exe)"}
          </button>
          <button className="btn" disabled={!!busy} type="button" onClick={() => runInstall("mac")}>
            {busy === "mac" ? "Downloading…" : "Download Mac (Localmod.dmg)"}
          </button>
        </div>
        {installOut && (
          <div className="banner ok">
            {installOut.file
              ? `Saved ${installOut.name} (${installOut.bytes} bytes) → ${installOut.dest}`
              : `Copied ${installOut.count} paths → ${installOut.dest}. On Windows run Start Localmod.bat; on Mac run Start Localmod.command.`}
          </div>
        )}
      </div>
      <div className="suite-grid">
        {apps.map((app: any) => (
          <button key={app.id} type="button" className="suite-card" onClick={() => setTab(app.id)}>
            <div className="suite-usage">{app.usage}</div>
            <div className="suite-name">{app.name}</div>
            <div className="muted tiny">{app.tagline}</div>
            <p className="muted">{app.blurb}</p>
            {Array.isArray(app.does) && (
              <ul className="muted tiny" style={{ margin: 0, paddingLeft: 16 }}>
                {app.does.map((d: string) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            {app.folder && (
              <div className="muted tiny">
                Files: {app.folder} · port {app.port} · {app.start}
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

export function BlackwhaleApp({ settings }: { settings: any }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setErr("");
    try {
      await streamChat(
        {
          messages: next.filter((m) => m.content),
          provider: settings.provider || "llama",
          model: settings.loadedModel,
        },
        (tok) => {
          next[next.length - 1].content += tok;
          setMessages([...next]);
        }
      );
    } catch (e: any) {
      setErr(e.message || "Blackwhale could not reach a model.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Blackwhale · chat</div>
        <h2 className="owner-name">Deep-sea communication hub.</h2>
        <p className="muted">
          A massive basin where every signal centralizes. Talk to a local model — everything surfaces here.
        </p>
      </div>
      {err && <div className="banner">{err}</div>}
      <div className="panel blackwhale-stream">
        {messages.length === 0 && <p className="muted">The water is still. Send the first ping.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="suite-usage">{m.role === "user" ? "You" : "Blackwhale"}</div>
            <div>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="panel">
        <label>
          Message
          <div className="row">
            <input
              className="grow"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Speak into the dark…"
            />
            <button className="btn primary" disabled={busy} type="button" onClick={send}>
              {busy ? "Sounding…" : "Send"}
            </button>
          </div>
        </label>
      </div>
    </section>
  );
}

export function NightweaverApp({
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
      setResult(await api<any>("/code/run", { method: "POST", body: JSON.stringify({ cwd, goal, query, apply }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Nightweaver · agentic coding</div>
        <h2 className="owner-name">Unseen. Spinning webs of code.</h2>
        <p className="muted">
          Nightweaver indexes the workspace, searches the tree, then coordinates edits across files — an autonomous weaver, not a single-line completer.
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
          <div className="section-label">Web</div>
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

export function ObsidianApp({
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
        <div className="hero-kicker">Obsidian · API keys</div>
        <h2 className="owner-name">Dark. Unbreakable. The vault.</h2>
        <p className="muted">
          Your most sensitive access tokens stay here. Local inference, or a key you already pay for — never a lock-in.
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

export function MakoApp({ openApp }: { openApp: (id: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [prompt, setPrompt] = useState("Reply with one word: pong");
  const [race, setRace] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function ping() {
    setData(await api<any>("/fast"));
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
        <div className="hero-kicker">Mako · speed</div>
        <h2 className="owner-name">Fastest in the water.</h2>
        <p className="muted">
          Built purely for high-speed execution and racing. Ping every backend. The lowest latency wins.
        </p>
      </div>
      <div className="panel">
        <div className="row wrap">
          <button className="btn primary" type="button" onClick={ping}>Ping backends</button>
          <button className="btn" type="button" onClick={() => openApp("obsidian")}>Open Obsidian</button>
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

export function TrenchApp({
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
      setOut(await api<any>("/editor/inline", { method: "POST", body: JSON.stringify({ cwd, path: rel, instruction, apply }) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">The Trench · editor</div>
        <h2 className="owner-name">Dive in. Do not leave until it is done.</h2>
        <p className="muted">
          An immersive, high-pressure environment for inline edit and chat — here in this React app or from VS Code.
        </p>
      </div>
      <div className="forge-split">
        <div className="panel">
          <div className="section-label">Install The Trench in VS Code</div>
          <ol className="muted">
            <li>Leave Localmod running (engine on 127.0.0.1:4781).</li>
            <li>Optional: Tools → Local API → Start (default {port}).</li>
            <li>
              From a terminal in this repo:{" "}
              <code className="mono">code --install-extension apps/keep</code>
              {" "}(extension files are in the repo; The Trench UI is in <code className="mono">apps/trench</code>).
            </li>
            <li>Command Palette → “Localmod Editor: Chat”.</li>
          </ol>
          <p className="muted tiny">
            OpenAI-compatible base: <code>http://127.0.0.1:{port}/v1</code>
          </p>
          <button className="btn" type="button" onClick={() => patch({}).then(() => api("/api-server/start", { method: "POST" }))}>
            Start local API
          </button>
        </div>
        <div className="panel">
          <div className="section-label">Inline edit (in The Trench)</div>
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
          {!cwd && <div className="muted tiny">Set a workspace in Nightweaver first.</div>}
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

export function IronmantisApp({
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
      setRun(await api<any>("/engineer/run", { method: "POST", body: JSON.stringify({ cwd, goal, maxSteps: 6 }) }));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">Ironmantis · autonomous</div>
        <h2 className="owner-name">Ruthless precision. Finish the job.</h2>
        <p className="muted">
          A hyper-efficient autonomous builder: list files, edit them, run allowlisted commands (git, npm, node, python) inside the folder you pick.
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
          {busy ? "Striking…" : "Run Ironmantis"}
        </button>
        <div className="muted tiny pad-sm">
          Also: <code className="mono">code --install-extension apps/hands</code> · app files in <code className="mono">apps/ironmantis</code>
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

export const CodeApp = NightweaverApp;
export const KeysApp = ObsidianApp;
export const FastApp = MakoApp;
export const EditorApp = TrenchApp;
export const HandsApp = IronmantisApp;
export const EngineerApp = IronmantisApp;
