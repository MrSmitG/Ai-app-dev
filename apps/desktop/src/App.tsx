import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { api, streamChat } from "./api";

const TABS = [
  ["chat", "Chat"],
  ["models", "Models"],
  ["docs", "Documents"],
  ["tools", "Tools"],
  ["settings", "Options"],
] as const;

const MODEL_TABS = [
  ["download", "Download"],
  ["library", "Library"],
] as const;

const OPTION_TABS = [
  ["models", "Storage"],
  ["inference", "Inference"],
  ["privacy", "Privacy"],
  ["developer", "Developer"],
] as const;

const TOOL_TABS = [
  ["server", "Local API"],
  ["mcp", "MCP"],
  ["race", "Race"],
] as const;

const STARTER = [
  ["Qwen 2.5 7B", "Qwen/Qwen2.5-7B-Instruct-GGUF"],
  ["Llama 3.2 3B", "bartowski/Llama-3.2-3B-Instruct-GGUF"],
  ["Mistral 7B", "TheBloke/Mistral-7B-Instruct-v0.2-GGUF"],
  ["Phi-3 Mini", "microsoft/Phi-3-mini-4k-instruct-gguf"],
  ["Gemma 2 2B", "bartowski/gemma-2-2b-it-GGUF"],
  ["DeepSeek R1 7B", "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF"],
];

type Msg = { role: string; content: string; citations?: { id: string; filename: string; page: number; snippet: string }[] };
type Thread = { id: string; title: string; messages: Msg[] };

function bytes(n?: number) {
  const v = n || 0;
  if (v > 1e9) return (v / 1e9).toFixed(2) + " GB";
  if (v > 1e6) return (v / 1e6).toFixed(1) + " MB";
  return v + " B";
}

function LocationBar({
  folderDraft,
  libraryDir,
  onDraft,
  onSave,
  onBrowse,
}: {
  folderDraft: string;
  libraryDir: string;
  onDraft: (v: string) => void;
  onSave: () => void;
  onBrowse: () => void;
}) {
  return (
    <div className="card location-card">
      <div>
        <strong>Download location</strong>
        <div className="k">GGUF files are saved here. Browse or paste a folder such as D:\models</div>
      </div>
      <div className="row">
        <input style={{ flex: 1 }} value={folderDraft} onChange={(e) => onDraft(e.target.value)} placeholder="D:\models" />
        <button onClick={onBrowse}>Browse…</button>
        <button className="primary" onClick={onSave}>Save</button>
      </div>
      <div className="path">Using: {libraryDir || folderDraft || "default ~/.localmod/models"}</div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("chat");
  const [modelTab, setModelTab] = useState<(typeof MODEL_TABS)[number][0]>("download");
  const [optionTab, setOptionTab] = useState<(typeof OPTION_TABS)[number][0]>("models");
  const [toolTab, setToolTab] = useState<(typeof TOOL_TABS)[number][0]>("server");
  const [hw, setHw] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [vault, setVault] = useState<any>({});
  const [library, setLibrary] = useState<any[]>([]);
  const [libraryDir, setLibraryDir] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [palette, setPalette] = useState(false);
  const [error, setError] = useState("");
  const [pass, setPass] = useState("");
  const [query, setQuery] = useState("qwen 7b instruct gguf");
  const [hits, setHits] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [repo, setRepo] = useState("");
  const [downloads, setDownloads] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [docPath, setDocPath] = useState("");
  const [importPath, setImportPath] = useState("");
  const [apiState, setApiState] = useState<any>({});
  const [inspector, setInspector] = useState<any[]>([]);
  const [mcp, setMcp] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [mcpCmd, setMcpCmd] = useState("npx");
  const [mcpArgs, setMcpArgs] = useState("-y @modelcontextprotocol/server-filesystem .");
  const [racePrompt, setRacePrompt] = useState("Explain quantization in one paragraph.");
  const [raceOut, setRaceOut] = useState<any[]>([]);
  const [integrity, setIntegrity] = useState<any>(null);
  const [ollama, setOllama] = useState<any[]>([]);
  const abort = useRef<AbortController | null>(null);
  const thread = threads.find((t) => t.id === active);

  const refresh = useCallback(async () => {
    try {
      const [h, s, v, lib, chats, inf, cols, ap, dl, dir] = await Promise.all([
        api<any>("/hardware"),
        api<any>("/settings"),
        api<any>("/vault"),
        api<any>("/models/library"),
        api<any>("/chats"),
        api<any>("/inference"),
        api<any>("/rag/collections"),
        api<any>("/api-server"),
        api<any>("/models/downloads"),
        api<any>("/models/dir").catch(() => ({ path: "" })),
      ]);
      setHw({ ...h, inference: inf });
      setSettings(s);
      setVault(v);
      setLibrary(Array.isArray(lib) ? lib : []);
      setLibraryDir(dir.path || s.libraryPath || "");
      setFolderDraft((prev) => prev || s.libraryPath || dir.path || "");
      const list: Thread[] = chats.threads || [];
      setThreads(list);
      setCollections(Array.isArray(cols) ? cols : []);
      setApiState(ap);
      setDownloads(Array.isArray(dl) ? dl : []);
      setActive((id) => id || list[0]?.id || null);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function patch(partial: Record<string, unknown>) {
    const next = await api<any>("/settings", { method: "POST", body: JSON.stringify(partial) });
    setSettings(next);
    return next;
  }

  async function persist(next: Thread[]) {
    setThreads(next);
    await api("/chats", { method: "POST", body: JSON.stringify({ threads: next }) });
  }

  function newChat() {
    const t: Thread = { id: crypto.randomUUID(), title: "New chat", messages: [] };
    persist([t, ...threads]);
    setActive(t.id);
    setTab("chat");
  }

  async function send() {
    if (!input.trim()) return;
    let id = active;
    let next = [...threads];
    if (!id) {
      const t: Thread = { id: crypto.randomUUID(), title: input.slice(0, 40), messages: [] };
      next = [t, ...next];
      id = t.id;
      setActive(id);
    }
    const cur = { ...next.find((t) => t.id === id)! };
    cur.messages = [...cur.messages, { role: "user", content: input }, { role: "assistant", content: "" }];
    next = next.map((t) => (t.id === id ? cur : t));
    setInput("");
    await persist(next);
    setBusy(true);
    abort.current = new AbortController();
    try {
      await streamChat(
        {
          messages: cur.messages.filter((m) => m.content),
          collectionId: collectionId || undefined,
          provider: settings.provider || "llama",
          model: settings.loadedModel,
        },
        (tok) => {
          cur.messages[cur.messages.length - 1].content += tok;
          setThreads((x) => x.map((t) => (t.id === id ? { ...cur, messages: [...cur.messages] } : t)));
        },
        abort.current.signal
      );
      await persist(next.map((t) => (t.id === id ? cur : t)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(q = query) {
    setQuery(q);
    setError("");
    try {
      setHits(await api(`/models/search?q=${encodeURIComponent(q)}`));
      setFiles([]);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openRepo(id: string) {
    setRepo(id);
    setFiles(await api(`/models/files?repo=${encodeURIComponent(id)}`));
    setModelTab("download");
    setTab("models");
  }

  async function downloadFile(file: string) {
    setError("");
    try {
      await api("/models/download", {
        method: "POST",
        body: JSON.stringify({
          repoId: repo,
          file,
          destDir: folderDraft || settings.libraryPath || undefined,
        }),
      });
      refresh();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function saveFolder() {
    const next = await patch({ libraryPath: folderDraft.trim() });
    const dir = await api<any>("/models/dir");
    setLibraryDir(dir.path || next.libraryPath);
    refresh();
  }

  async function browseFolder() {
    setError("");
    try {
      const r = await api<{ cancelled?: boolean; path?: string }>("/models/pick-dir", { method: "POST" });
      if (!r.cancelled && r.path) {
        setFolderDraft(r.path);
        setLibraryDir(r.path);
      }
    } catch (e: any) {
      setError(e.message || "Could not open folder picker. Paste a path instead.");
    }
  }

  const hud = useMemo(() => {
    if (!hw) return "hardware…";
    const ram = `${hw.ramUsedMb ?? "?"}/${hw.ramTotalMb ?? "?"} MB`;
    const gpu = hw.gpus?.[0]?.name || hw.backendHint || "";
    return `${ram} · ${gpu} · ngl ${settings.gpuLayers ?? "—"}`;
  }, [hw, settings]);

  return (
    <div className="app">
      <header className="hud">
        <span className="brand">LOCALMOD</span>
        <span className={`pill ${settings.airplane ? "on" : ""}`}>{settings.airplane ? "AIRPLANE" : "ONLINE"}</span>
        <span className="pill">{vault.unlocked ? "VAULT OPEN" : vault.configured ? "VAULT LOCKED" : "NO VAULT"}</span>
        <span className="pill">{hw?.inference?.running ? "ENGINE ON" : "ENGINE OFF"}</span>
        <span className="pill">{hud}</span>
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={() => setPalette(true)}>Ctrl+K</button>
      </header>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="primary" onClick={newChat}>New chat</button>
      </div>
      <div className={`layout ${tab === "chat" ? "" : "wide"}`}>
        {tab === "chat" && (
          <nav className="nav">
            <div className="k">Threads</div>
            {threads.map((t) => (
              <button key={t.id} className={active === t.id ? "active" : ""} onClick={() => setActive(t.id)}>
                {t.title || "Untitled"}
              </button>
            ))}
          </nav>
        )}
        <main className="main">
          {error && <div className="err">{error}</div>}

          {tab === "chat" && (
            <>
              <div className="page-title">{thread?.title || "Chat"}</div>
              <div className="messages">
                {!(thread?.messages || []).length && (
                  <div className="empty">
                    <h2>Chat with a local model</h2>
                    <p>Load a GGUF from Models, then send a message. Nothing leaves this PC unless you turn airplane mode off for Hugging Face downloads.</p>
                    <button className="primary" onClick={() => setTab("models")}>Get a model</button>
                  </div>
                )}
                {(thread?.messages || []).map((m, i) => (
                  <div key={i} className={`msg ${m.role}`}>
                    <div className="k">{m.role}</div>
                    {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : <div>{m.content}</div>}
                    {m.citations?.map((c) => (
                      <div key={c.id} className="cite">[{c.filename} p.{c.page}] {c.snippet?.slice(0, 140)}</div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="row">
                <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
                  <option value="">No documents</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button disabled={!busy} onClick={() => abort.current?.abort()}>Stop</button>
              </div>
              <div className="composer">
                <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message a local model…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                <button className="primary" onClick={send} disabled={busy}>Send</button>
              </div>
            </>
          )}

          {tab === "models" && (
            <>
              <div className="page-title">Models</div>
              <LocationBar folderDraft={folderDraft} libraryDir={libraryDir} onDraft={setFolderDraft} onSave={saveFolder} onBrowse={browseFolder} />
              <div className="subtabs">
                {MODEL_TABS.map(([id, label]) => (
                  <button key={id} className={modelTab === id ? "active" : ""} onClick={() => setModelTab(id)}>{label}</button>
                ))}
              </div>
              {modelTab === "download" && (
                <div className="grid">
                  <div className="row">
                    <input style={{ flex: 1 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Hugging Face GGUF…" />
                    <button className="primary" onClick={() => runSearch()}>Search</button>
                  </div>
                  <div className="row">
                    {STARTER.map(([label, id]) => (
                      <span key={id} className="chip" onClick={() => runSearch(id)}>{label}</span>
                    ))}
                  </div>
                  {!hits.length && (
                    <div className="empty compact">
                      Search Hugging Face for GGUF weights, pick a quant, then download into the folder above.
                    </div>
                  )}
                  {hits.map((h) => (
                    <div className="card" key={h.id}>
                      <strong>{h.id}</strong>
                      <div className="k">{h.downloads} downloads · {h.fit?.fits ? "likely fits" : "check VRAM"} · {h.fit?.note}</div>
                      <button onClick={() => openRepo(h.id)}>Choose quant and download</button>
                    </div>
                  ))}
                  {repo && <div className="k">Files in {repo}</div>}
                  {files.map((f) => (
                    <div className="card" key={f.path}>
                      <strong>{f.path}</strong>
                      <div className="k">{f.quant} · {bytes(f.size)} · {f.fit?.fits ? "fits" : "may be tight"}</div>
                      <button className="primary" onClick={() => downloadFile(f.path)}>Download to folder</button>
                    </div>
                  ))}
                  {downloads.length > 0 && <div className="k">Transfers</div>}
                  {downloads.map((d) => {
                    const pct = d.total ? Math.round((100 * (d.received || 0)) / d.total) : 0;
                    return (
                      <div className="card" key={d.id}>
                        <div>{d.id}</div>
                        <div className="path">{d.dest}</div>
                        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                        <div className="k">{d.status} · {bytes(d.received)} / {bytes(d.total)}</div>
                        {d.status === "running" && (
                          <button className="danger" onClick={() => api("/models/cancel", { method: "POST", body: JSON.stringify({ id: d.id }) })}>Cancel</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {modelTab === "library" && (
                <div className="grid two">
                  {library.map((m) => (
                    <div className="card" key={m.path}>
                      <strong>{m.name}</strong>
                      <div className="k">{bytes(m.size)} · {m.quant}</div>
                      <div className="path">{m.path}</div>
                      <button className="primary" onClick={async () => {
                        await patch({ loadedModel: m.path });
                        await api("/inference/start", { method: "POST", body: JSON.stringify({ modelPath: m.path }) });
                        refresh();
                        setTab("chat");
                      }}>Load in chat</button>
                    </div>
                  ))}
                  {!library.length && <div className="k">No GGUF files in this folder yet. Use the Download tab.</div>}
                  <div className="card">
                    <strong>Import existing file</strong>
                    <input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="C:\path\to\model.gguf" />
                    <button onClick={async () => { await api("/models/import", { method: "POST", body: JSON.stringify({ path: importPath }) }); refresh(); }}>Copy into library</button>
                    <button onClick={async () => { await api("/inference/stop", { method: "POST" }); refresh(); }}>Unload engine</button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "docs" && (
            <>
              <div className="page-title">Documents</div>
              <div className="grid">
                <button className="primary" onClick={async () => { await api("/rag/collections", { method: "POST", body: JSON.stringify({ name: "Collection " + (collections.length + 1) }) }); refresh(); }}>New collection</button>
                {collections.map((c) => (
                  <div className="card" key={c.id}>
                    {c.name} · {c.docs} docs
                    <button onClick={() => { setCollectionId(c.id); setTab("chat"); }}>Use in chat</button>
                  </div>
                ))}
                <input value={docPath} onChange={(e) => setDocPath(e.target.value)} placeholder="Absolute path to PDF / DOCX / TXT / MD" />
                <button onClick={() => api("/rag/ingest", { method: "POST", body: JSON.stringify({ collectionId, path: docPath }) })}>Ingest locally</button>
              </div>
            </>
          )}

          {tab === "tools" && (
            <>
              <div className="page-title">Tools</div>
              <div className="subtabs">
                {TOOL_TABS.map(([id, label]) => (
                  <button key={id} className={toolTab === id ? "active" : ""} onClick={() => setToolTab(id)}>{label}</button>
                ))}
              </div>
              {toolTab === "server" && (
                <div className="grid">
                  <div className="card">OpenAI-style API {apiState.running ? "running" : "stopped"} on {apiState.bind}:{apiState.port || settings.apiPort || 4782}</div>
                  <div className="row">
                    <button className="primary" onClick={async () => { await api("/api-server/start", { method: "POST" }); refresh(); }}>Start</button>
                    <button onClick={async () => { await api("/api-server/stop", { method: "POST" }); refresh(); }}>Stop</button>
                    <button onClick={async () => setInspector(await api("/api-server/inspector"))}>Inspector</button>
                  </div>
                  {inspector.map((r, i) => <div className="k" key={i}>{r.path} {r.ms}ms {r.model || ""} {r.status}</div>)}
                </div>
              )}
              {toolTab === "mcp" && (
                <div className="grid">
                  <input value={mcpCmd} onChange={(e) => setMcpCmd(e.target.value)} />
                  <input value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} />
                  <button className="primary" onClick={async () => {
                    await api("/mcp/connect", { method: "POST", body: JSON.stringify({ id: "fs", command: mcpCmd, args: mcpArgs.split(" ").filter(Boolean) }) });
                    setMcp(await api("/mcp"));
                  }}>Connect</button>
                  {mcp.map((s) => <div key={s.id} className="card">{s.id} {s.status} {(s.tools || []).map((t: any) => t.name).join(", ")}</div>)}
                  <button onClick={async () => setPending(await api("/mcp/pending"))}>Pending permissions</button>
                  {pending.map((p) => (
                    <div className="card" key={p.id}>
                      {p.name} {JSON.stringify(p.args)}
                      <button className="primary" onClick={() => api("/mcp/permission", { method: "POST", body: JSON.stringify({ id: p.id, decision: "allow" }) })}>Allow</button>
                      <button onClick={() => api("/mcp/permission", { method: "POST", body: JSON.stringify({ id: p.id, decision: "always" }) })}>Always</button>
                      <button onClick={() => api("/mcp/permission", { method: "POST", body: JSON.stringify({ id: p.id, decision: "deny" }) })}>Deny</button>
                    </div>
                  ))}
                </div>
              )}
              {toolTab === "race" && (
                <div className="grid">
                  <textarea value={racePrompt} onChange={(e) => setRacePrompt(e.target.value)} />
                  <button onClick={async () => setOllama(await api("/ollama/tags"))}>Load Ollama tags</button>
                  <button className="primary" onClick={async () => setRaceOut(await api("/race", { method: "POST", body: JSON.stringify({ prompt: racePrompt, runners: ollama.slice(0, 3).map((m: any) => ({ provider: "ollama", model: m.name })) }) }))}>Race</button>
                  {raceOut.map((r, i) => <div className="card" key={i}><strong>{r.model}</strong> {r.ms}ms {r.ok ? r.text : r.error}</div>)}
                </div>
              )}
            </>
          )}

          {tab === "settings" && (
            <div className="options-layout">
              <div className="options-nav">
                {OPTION_TABS.map(([id, label]) => (
                  <button key={id} className={optionTab === id ? "active" : ""} onClick={() => setOptionTab(id)}>{label}</button>
                ))}
              </div>
              <div className="options-body">
              <div className="page-title">Options · {OPTION_TABS.find(([id]) => id === optionTab)?.[1]}</div>
              {optionTab === "models" && (
                <div className="grid">
                  <LocationBar folderDraft={folderDraft} libraryDir={libraryDir} onDraft={setFolderDraft} onSave={saveFolder} onBrowse={browseFolder} />
                  <div className="card">
                    <strong>Hugging Face token</strong>
                    <div className="k">Optional. Needed only for gated or private repos.</div>
                    <input type="password" value={settings.hfToken || ""} onChange={(e) => patch({ hfToken: e.target.value })} placeholder="hf_…" />
                  </div>
                </div>
              )}
              {optionTab === "inference" && (
                <div className="grid">
                  <label className="row"><input type="checkbox" checked={!!settings.autotune} onChange={(e) => patch({ autotune: e.target.checked })} /> AutoTune sampling</label>
                  <div className="row">
                    {["quality", "balanced", "cpu", "longctx"].map((p) => (
                      <button key={p} className={settings.preset === p ? "primary" : ""} onClick={() => api("/settings/preset", { method: "POST", body: JSON.stringify({ name: p }) }).then(() => refresh())}>{p}</button>
                    ))}
                  </div>
                  <label>llama-server path<input value={settings.llamaServerPath || ""} onChange={(e) => patch({ llamaServerPath: e.target.value })} /></label>
                  <label>GPU layers<input type="number" value={settings.gpuLayers ?? 20} onChange={(e) => patch({ gpuLayers: Number(e.target.value) })} /></label>
                  <label>Context<input type="number" value={settings.contextLength ?? 4096} onChange={(e) => patch({ contextLength: Number(e.target.value) })} /></label>
                  <label>Temperature<input type="number" step="0.1" value={settings.temperature ?? 0.7} onChange={(e) => patch({ temperature: Number(e.target.value) })} /></label>
                  <label>System prompt<textarea value={settings.systemPrompt || ""} onChange={(e) => patch({ systemPrompt: e.target.value })} /></label>
                </div>
              )}
              {optionTab === "privacy" && (
                <div className="grid">
                  <label className="row"><input type="checkbox" checked={!!settings.airplane} onChange={(e) => patch({ airplane: e.target.checked })} /> Airplane mode (block Hugging Face)</label>
                  <div className="row">
                    <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Vault passphrase" />
                    <button onClick={() => api("/vault/setup", { method: "POST", body: JSON.stringify({ passphrase: pass }) }).then(() => refresh())}>Set vault</button>
                    <button onClick={() => api("/vault/unlock", { method: "POST", body: JSON.stringify({ passphrase: pass }) }).then(() => refresh())}>Unlock</button>
                    <button onClick={() => api("/vault/lock", { method: "POST" }).then(() => refresh())}>Lock</button>
                  </div>
                  <button onClick={async () => setIntegrity(await api("/integrity"))}>Integrity log</button>
                  {integrity && <pre className="k">{JSON.stringify(integrity.verify, null, 2)}</pre>}
                </div>
              )}
              {optionTab === "developer" && (
                <div className="grid">
                  <label>Ollama URL<input value={settings.ollamaUrl || ""} onChange={(e) => patch({ ollamaUrl: e.target.value })} /></label>
                  <label>Local API port<input type="number" value={settings.apiPort ?? 4782} onChange={(e) => patch({ apiPort: Number(e.target.value) })} /></label>
                  <div className="k">MLX: {hw?.mlxAvailable ? "Apple Silicon path available" : "not this machine"}</div>
                </div>
              )}
              </div>
            </div>
          )}
        </main>
        <aside className="side">
          <div className="k">Engine</div>
          <div className="card">{hw?.inference?.running ? `Running pid ${hw.inference.pid}` : "llama-server not running"}</div>
          <div className="k">Save folder</div>
          <div className="card path">{libraryDir || "default"}</div>
          <p className="k">Downloads stay on this PC. Bind 127.0.0.1. Use an SSH tunnel for another machine.</p>
        </aside>
      </div>
      {palette && (
        <>
          <div className="overlay" onClick={() => setPalette(false)} />
          <div className="palette">
            <div className="k">Command palette</div>
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setPalette(false); }}>{label}</button>
            ))}
            <button onClick={() => { patch({ airplane: !settings.airplane }); setPalette(false); }}>Toggle airplane</button>
            <button onClick={() => { newChat(); setPalette(false); }}>New chat</button>
          </div>
        </>
      )}
    </div>
  );
}
