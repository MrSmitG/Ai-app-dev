import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Markdown from "react-markdown";
import { api, streamChat, streamForge } from "./api";
import { Icon, LabelWithTip, LocationBar, Tip, bytes } from "./components/ui";
import { LlmPanel } from "./components/LlmPanel";
import { OwnerCard } from "./components/OwnerCard";
import { VoiceControls, VoiceSettingsPanel } from "./components/VoiceControls";
import { ContextMeter, type ContextUsage } from "./components/ContextMeter";
import { MemoryTree } from "./components/MemoryTree";
import { BundlesPanel, type BundleRow } from "./components/BundlesPanel";
import { useDesktop } from "./providers/AppProviders";
import { OWNER } from "./owner";

/** Primary labels stay familiar. Brand nicknames only in tips. */
const NAV = [
  ["chat", "Chat", "chat", "Local chat with your loaded GGUF / Ollama model."],
  ["llm", "LLM", "llm", "LM Studio-style inference controls: GPU offload, sampling, KV cache, RoPE, presets."],
  ["models", "Models", "models", "Search Hugging Face, download GGUF files, and manage your local model library."],
  ["bundles", "Bundles", "bundles", "Select curated packs to use: starter chat, vision, voice, RAG, agent, privacy."],
  ["forge", "Agent", "forge", "Autonomous coding agent that can edit a workspace locally or in the cloud."],
  ["skills", "Skills", "skills", "Personalities that shape how Chat replies — Architect, Critic, or your own packs."],
  ["harbor", "Data", "harbor", "Load files and folders into collections for RAG retrieval in Chat."],
  ["tools", "Tools", "tools", "Local OpenAI-style API, MCP servers, and multi-model race using Ollama tags."],
  ["settings", "Options", "settings", "API keys, privacy vault, Ollama URL, and developer settings."],
  ["about", "About", "about", "Owner details — connect with Smit Gaikwad on LinkedIn or GitHub."],
] as const;

const MODEL_TABS = [
  ["download", "Download"],
  ["library", "Library"],
] as const;

const OPTION_TABS = [
  ["voice", "Voice", "Microphone input, transcription engine, and transcript output behavior."],
  ["forge", "Agent", "API key and workspace for the coding agent."],
  ["models", "Storage", "Where GGUF models are saved on disk."],
  ["privacy", "Privacy", "Airplane mode, encrypted vault, integrity log."],
  ["developer", "Developer", "Ollama URL, local API port, and advanced wiring."],
] as const;

const TOOL_TABS = [
  ["server", "Local API", "OpenAI-compatible HTTP server on 127.0.0.1 for other apps."],
  ["mcp", "MCP", "Model Context Protocol servers and permission prompts."],
  ["race", "Race", "Send the same prompt to several Ollama models and compare answers."],
] as const;

const STARTER = [
  ["Qwen 2.5 7B", "Qwen/Qwen2.5-7B-Instruct-GGUF"],
  ["Llama 3.2 3B", "bartowski/Llama-3.2-3B-Instruct-GGUF"],
  ["Mistral 7B", "TheBloke/Mistral-7B-Instruct-v0.2-GGUF"],
  ["Phi-3 Mini", "microsoft/Phi-3-mini-4k-instruct-gguf"],
  ["Gemma 2 2B", "bartowski/gemma-2-2b-it-GGUF"],
  ["DeepSeek R1 7B", "bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF"],
];

type Attachment = { id: string; kind: "image"; name: string; mime: string; dataUrl: string; bytes: number };
type Msg = {
  role: string;
  content: string;
  attachments?: Attachment[];
  source?: "voice" | "text" | "image";
  pinned?: boolean;
  citations?: { id: string; filename: string; page: number; snippet: string }[];
};
type Thread = {
  id: string;
  title: string;
  messages: Msg[];
  parentId?: string | null;
  branchFromMsgIndex?: number | null;
  branchLabel?: string;
  main?: boolean;
  createdAt?: number;
};
type Skill = { id: string; name: string; tagline: string; emoji: string; tone: string; personality: string; builtin?: boolean };

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const desktop = useDesktop();
  const initialTab = (() => {
    const seg = location.pathname.replace(/^\//, "").split("/")[0];
    return (NAV.find(([id]) => id === seg)?.[0] || "chat") as (typeof NAV)[number][0];
  })();
  const [tab, setTabState] = useState<(typeof NAV)[number][0]>(initialTab);
  const setTab = (id: (typeof NAV)[number][0]) => {
    setTabState(id);
    navigate(`/${id}`);
  };
  const [modelTab, setModelTab] = useState<(typeof MODEL_TABS)[number][0]>("download");
  const [optionTab, setOptionTab] = useState<(typeof OPTION_TABS)[number][0]>("voice");
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
  const [paletteQ, setPaletteQ] = useState("");
  const [error, setError] = useState("");
  const [pass, setPass] = useState("");
  const [query, setQuery] = useState("qwen 7b instruct gguf");
  const [hits, setHits] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [repo, setRepo] = useState("");
  const [downloads, setDownloads] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [dataPath, setDataPath] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);
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
  const [forge, setForge] = useState<any>({});
  const [forgeModels, setForgeModels] = useState<any[]>([]);
  const [forgeHistory, setForgeHistory] = useState<any[]>([]);
  const [forgePrompt, setForgePrompt] = useState("Summarize this repository and list the top 5 files to read first.");
  const [forgeText, setForgeText] = useState("");
  const [forgeEvents, setForgeEvents] = useState<any[]>([]);
  const [forgeBusy, setForgeBusy] = useState(false);
  const [forgeSession, setForgeSession] = useState<any>(null);
  const [forgeCwdDraft, setForgeCwdDraft] = useState("");
  const [forgeImages, setForgeImages] = useState<Attachment[]>([]);
  const [forgeVoiceNote, setForgeVoiceNote] = useState("");
  const [forgeIncludeChat, setForgeIncludeChat] = useState(true);
  const [pendingImages, setPendingImages] = useState<Attachment[]>([]);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [forgeBudget, setForgeBudget] = useState<ContextUsage | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [skillDraft, setSkillDraft] = useState({ name: "", tagline: "", personality: "", emoji: "○" });
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const abort = useRef<AbortController | null>(null);
  const forgeAbort = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const forgeFileRef = useRef<HTMLInputElement | null>(null);
  const thread = threads.find((t) => t.id === active);

  const refresh = useCallback(async () => {
    try {
      const [h, s, v, lib, chats, inf, cols, ap, dl, dir, frg, hist, sk, act, bdl] = await Promise.all([
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
        api<any>("/forge").catch(() => ({})),
        api<any>("/forge/history").catch(() => []),
        api<any>("/skills").catch(() => []),
        api<any>("/skills/active").catch(() => ({ skill: null })),
        api<any>("/bundles").catch(() => []),
      ]);
      setHw({ ...h, inference: inf });
      setSettings(s);
      setVault(v);
      setLibrary(Array.isArray(lib) ? lib : []);
      setLibraryDir(dir.path || s.libraryPath || "");
      setFolderDraft((prev) => prev || s.libraryPath || dir.path || "");
      setForgeCwdDraft((prev) => prev || s.cursorCwd || "");
      const list: Thread[] = (chats.threads || []).map((t: Thread, i: number) => ({
        ...t,
        main: t.main ?? (!t.parentId && i === 0),
      }));
      // Ensure at least one sacred timeline
      if (list.length && !list.some((t) => t.main)) {
        const root = list.find((t) => !t.parentId) || list[0];
        root.main = true;
      }
      setThreads(list);
      setCollections(Array.isArray(cols) ? cols : []);
      setApiState(ap);
      setDownloads(Array.isArray(dl) ? dl : []);
      setForge(frg);
      setForgeHistory(Array.isArray(hist) ? hist : []);
      setSkills(Array.isArray(sk) ? sk : []);
      setActiveSkill(act.skill || null);
      setBundles(Array.isArray(bdl) ? bdl : []);
      setActive((id) => id || list[0]?.id || null);
      setCollectionId((id) => id || cols?.[0]?.id || "");
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const seg = location.pathname.replace(/^\//, "").split("/")[0];
    const id = NAV.find(([x]) => x === seg)?.[0];
    if (id && id !== tab) setTabState(id);
  }, [location.pathname]);

  useEffect(() => {
    if (!collectionId) return;
    api<any>(`/harbor/sources?collectionId=${encodeURIComponent(collectionId)}`)
      .then(setSources)
      .catch(() => setSources([]));
  }, [collectionId, ingestResult]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        setPaletteQ("");
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
    const hasMain = threads.some((t) => t.main || !t.parentId);
    const t: Thread = {
      id: crypto.randomUUID(),
      title: "New chat",
      messages: [],
      main: !hasMain,
      createdAt: Date.now(),
    };
    persist([t, ...threads.map((x) => (t.main ? { ...x, main: false } : x))]);
    setActive(t.id);
    setTab("chat");
  }

  function pivotFromMessage(msgIndex: number) {
    if (!active) return;
    const src = threads.find((t) => t.id === active);
    if (!src) return;
    const pivotMsg = src.messages[msgIndex];
    if (!pivotMsg) return;
    const label = (pivotMsg.content || "pivot").replace(/\s+/g, " ").slice(0, 48);
    const branch: Thread = {
      id: crypto.randomUUID(),
      title: `Pivot · ${label}`,
      messages: src.messages.slice(0, msgIndex + 1).map((m) => ({ ...m, attachments: m.attachments ? [...m.attachments] : undefined })),
      parentId: src.id,
      branchFromMsgIndex: msgIndex,
      branchLabel: `from “${label}${label.length >= 48 ? "…" : ""}”`,
      main: false,
      createdAt: Date.now(),
    };
    persist([branch, ...threads]);
    setActive(branch.id);
    setInput("");
    setPendingImages([]);
  }

  function promoteMain(id: string) {
    persist(threads.map((t) => ({ ...t, main: t.id === id })));
  }

  useEffect(() => {
    const msgs = thread?.messages || [];
    const draftAttach = pendingImages;
    const estimateMsgs = [
      ...msgs,
      ...(input.trim() || draftAttach.length
        ? [{ role: "user", content: input, attachments: draftAttach, source: "text" as const }]
        : []),
    ];
    if (!estimateMsgs.length) {
      setContextUsage(null);
      return;
    }
    const t = setTimeout(() => {
      api<ContextUsage>("/context/estimate", {
        method: "POST",
        body: JSON.stringify({ messages: estimateMsgs }),
      })
        .then(setContextUsage)
        .catch(() => setContextUsage(null));
    }, 280);
    return () => clearTimeout(t);
  }, [thread?.messages, input, pendingImages, settings.contextLength]);

  useEffect(() => {
    const t = setTimeout(() => {
      api<ContextUsage>("/context/estimate", {
        method: "POST",
        body: JSON.stringify({
          text: forgePrompt,
          voice: forgeVoiceNote,
          images: forgeImages,
        }),
      })
        .then(setForgeBudget)
        .catch(() => setForgeBudget(null));
    }, 280);
    return () => clearTimeout(t);
  }, [forgePrompt, forgeVoiceNote, forgeImages]);

  async function readImageFiles(files: FileList | File[]): Promise<Attachment[]> {
    const max = settings.maxImagesPerTurn ?? 8;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, max);
    const out: Attachment[] = [];
    for (const f of list) {
      if (f.size > 8 * 1024 * 1024) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      out.push({
        id: crypto.randomUUID(),
        kind: "image",
        name: f.name,
        mime: f.type || "image/png",
        dataUrl,
        bytes: f.size,
      });
    }
    return out;
  }

  async function send(overrideText?: string, opts?: { source?: Msg["source"]; images?: Attachment[] }) {
    const text = (overrideText ?? input).trim();
    const images = opts?.images ?? pendingImages;
    if (!text && !images.length) return;
    let id = active;
    let next = [...threads];
    if (!id) {
      const t: Thread = {
        id: crypto.randomUUID(),
        title: (text || "Image").slice(0, 40),
        messages: [],
        main: !threads.some((x) => x.main),
        createdAt: Date.now(),
      };
      next = [t, ...next];
      id = t.id;
      setActive(id);
    }
    const cur = { ...next.find((t) => t.id === id)! };
    const userMsg: Msg = {
      role: "user",
      content: text || (images.length ? "(image)" : ""),
      attachments: images.length ? images : undefined,
      source: opts?.source || (images.length && !text ? "image" : "text"),
    };
    cur.messages = [...cur.messages, userMsg, { role: "assistant", content: "" }];
    next = next.map((t) => (t.id === id ? cur : t));
    setInput("");
    setPendingImages([]);
    await persist(next);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const meta = await streamChat(
        {
          messages: cur.messages.filter((m) => m.content || m.attachments?.length),
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
      if (meta && typeof meta === "object") {
        const m = meta as { context?: ContextUsage; citations?: Msg["citations"] };
        if (m.context) setContextUsage(m.context);
        if (m.citations?.length) {
          cur.messages[cur.messages.length - 1].citations = m.citations;
        }
      }
      await persist(next.map((t) => (t.id === id ? cur : t)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function applyVoiceTranscript(text: string, outputMode: string) {
    const t = text.trim();
    if (!t) return;
    if (outputMode === "append") setInput((prev) => (prev ? `${prev.trim()} ${t}` : t));
    else if (outputMode === "send") send(t, { source: "voice" });
    else setInput(t); // fill / default
  }

  function applyForgeVoice(text: string, outputMode: string) {
    const t = text.trim();
    if (!t) return;
    if (outputMode === "append") setForgeVoiceNote((prev) => (prev ? `${prev.trim()} ${t}` : t));
    else if (outputMode === "send") {
      setForgeVoiceNote(t);
      setForgePrompt((p) => p || t);
    } else {
      setForgeVoiceNote(t);
      if (!forgePrompt.trim()) setForgePrompt(t);
    }
  }

  function togglePin(msgIndex: number) {
    if (!active) return;
    const next = threads.map((t) => {
      if (t.id !== active) return t;
      const messages = t.messages.map((m, i) => (i === msgIndex ? { ...m, pinned: !m.pinned } : m));
      return { ...t, messages };
    });
    persist(next);
  }

  async function runForge(followUp = false) {
    if (!forgePrompt.trim() && !forgeVoiceNote.trim() && !forgeImages.length) return;
    setForgeBusy(true);
    setForgeText("");
    setForgeEvents([]);
    setError("");
    forgeAbort.current = new AbortController();
    const chatContext =
      forgeIncludeChat && thread?.messages?.length
        ? thread.messages.slice(-12).map((m) => ({
            role: m.role,
            content: m.content,
          }))
        : [];
    const pinnedNotes =
      forgeIncludeChat && thread?.messages?.length
        ? thread.messages.filter((m) => m.pinned).map((m) => m.content).filter(Boolean)
        : [];
    try {
      await streamForge(
        {
          prompt: forgePrompt || "Follow the voice note and inspect any attached images.",
          voiceTranscript: forgeVoiceNote || undefined,
          images: forgeImages,
          chatContext,
          pinnedNotes,
          model: settings.cursorModel,
          runtime: settings.cursorRuntime || "local",
          cwd: forgeCwdDraft || settings.cursorCwd,
          cloudRepo: settings.cursorCloudRepo,
          agentId: followUp ? forgeSession?.agentId : undefined,
        },
        {
          onToken: (t) => setForgeText((x) => x + t),
          onEvent: (e) => setForgeEvents((x) => [...x, e]),
          onSession: (s) => {
            setForgeSession(s);
            if (s.context) setForgeBudget((b) => ({ ...(b || {}), ...s.context, usedTokens: s.context.promptTokensEst }));
          },
          onDone: (s) => {
            setForgeSession(s);
            if (s.text) setForgeText(s.text);
            setForgeImages([]);
            setForgeVoiceNote("");
            refresh();
          },
          onError: (e) => setError(e.error || e.message || "Forge run failed"),
        },
        forgeAbort.current.signal
      );
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setForgeBusy(false);
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
        body: JSON.stringify({ repoId: repo, file, destDir: folderDraft || settings.libraryPath || undefined }),
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
    try {
      const r = await api<{ cancelled?: boolean; path?: string }>("/models/pick-dir", { method: "POST" });
      if (!r.cancelled && r.path) {
        setFolderDraft(r.path);
        setLibraryDir(r.path);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function activateSkill(id: string) {
    const r = await api<any>("/skills/activate", { method: "POST", body: JSON.stringify({ id }) });
    setActiveSkill(r.skill);
    setSettings((s: any) => ({ ...s, activeSkillId: r.activeSkillId }));
  }

  async function createSkill() {
    if (!skillDraft.name.trim()) return;
    await api("/skills", { method: "POST", body: JSON.stringify(skillDraft) });
    setSkillDraft({ name: "", tagline: "", personality: "", emoji: "○" });
    refresh();
  }

  async function ingestData() {
    if (!collectionId || !dataPath.trim()) return;
    setIngestBusy(true);
    setIngestResult(null);
    try {
      const r = await api("/harbor/ingest", { method: "POST", body: JSON.stringify({ collectionId, path: dataPath.trim() }) });
      setIngestResult(r);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIngestBusy(false);
    }
  }

  const hud = useMemo(() => {
    if (!hw) return "Detecting hardware…";
    const ram = `${Math.round((hw.ramUsedMb || 0) / 1024)}/${Math.round((hw.ramTotalMb || 0) / 1024)} GB`;
    const gpu = hw.gpus?.[0]?.name || hw.backendHint || "CPU";
    return `${ram} · ${gpu}`;
  }, [hw]);

  const paletteItems = useMemo(() => {
    const items = [
      ...NAV.map(([id, label, , tip]) => ({ id: `nav-${id}`, label: `${label} — ${tip}`, run: () => setTab(id) })),
      { id: "new", label: "New chat", run: () => newChat() },
      { id: "skill", label: "Browse Skills", run: () => setTab("skills") },
      { id: "bundles", label: "Select bundles to use", run: () => setTab("bundles") },
      { id: "harbor", label: "Load data (files / folders)", run: () => setTab("harbor") },
      { id: "forge", label: "Launch coding agent", run: () => setTab("forge") },
      { id: "ollama", label: "Tools → Race (Ollama tags)", run: () => { setTab("tools"); setToolTab("race"); } },
    ];
    const q = paletteQ.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  }, [paletteQ]);

  const title = NAV.find(([id]) => id === tab)?.[1] || "Localmod";
  const sideTabs = tab === "chat" || tab === "forge" || tab === "skills";

  return (
    <div className="shell">
      <div className="ambient a1" />
      <div className="ambient a2" />
      <aside className="rail">
        <div className="rail-brand" title="Localmod">
          <span>LM</span>
        </div>
        {NAV.map(([id, label, icon, tip]) => (
          <button key={id} className={`rail-btn ${tab === id ? "active" : ""}`} title={tip} onClick={() => setTab(id)}>
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className="rail-btn" title="Command palette" onClick={() => setPalette(true)}>
          <Icon name="search" />
          <span>Find</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <div className="top-title">{title}</div>
            <div className="muted tiny">{hud}{activeSkill ? ` · ${activeSkill.emoji} ${activeSkill.name}` : ""}</div>
          </div>
          <div className="top-pills">
            <span className={`status-pill ${settings.airplane ? "warn" : "ok"}`}>{settings.airplane ? "Airplane" : "Online"}</span>
            <span className={`status-pill ${hw?.inference?.running ? "ok" : ""}`}>{hw?.inference?.running ? "Engine live" : "Engine idle"}</span>
            <span className={`status-pill ${forge.configured ? "ok" : ""}`} title="Coding agent API key status">{forge.configured ? "Agent ready" : "Agent key"}</span>
            <span className={`status-pill ${activeSkill ? "ok" : ""}`} title="Active Skill personality for Chat">{activeSkill ? activeSkill.name : "No skill"}</span>
            <span className={`status-pill ${bundles.some((b) => b.selected) ? "ok" : ""}`} title="Bundles currently in use">
              {bundles.filter((b) => b.selected).length ? `${bundles.filter((b) => b.selected).length} bundle${bundles.filter((b) => b.selected).length === 1 ? "" : "s"}` : "No bundles"}
            </span>
          </div>
          <div className="top-actions">
            <button className="btn ghost" onClick={() => setPalette(true)} title="Open command palette">Ctrl+K</button>
            <button className="btn primary" onClick={newChat}><Icon name="plus" /> New chat</button>
          </div>
        </header>

        <div className={`stage ${sideTabs ? "with-side" : ""}`}>
          {sideTabs && (
            <nav className="sidebar flow-in">
              {tab === "chat" && (
                <>
                  <div className="side-head">
                    <span>
                      Memory tree <Tip text="Sacred timeline is the main channel. Use Pivot on a message to bifurcate — Loki-style — when the conversation takes another path." />
                    </span>
                    <button className="btn icon" onClick={newChat} title="New sacred timeline">
                      <Icon name="plus" />
                    </button>
                  </div>
                  <MemoryTree
                    branches={threads.map((t) => ({
                      id: t.id,
                      title: t.title || "Untitled",
                      parentId: t.parentId,
                      branchFromMsgIndex: t.branchFromMsgIndex,
                      branchLabel: t.branchLabel,
                      main: !!t.main,
                      messageCount: (t.messages || []).length,
                      preview: (t.messages || []).find((m) => m.role === "user")?.content?.slice(0, 72),
                    }))}
                    activeId={active}
                    onSelect={setActive}
                    onPromoteMain={promoteMain}
                    hideHead
                  />
                </>
              )}
              {tab === "forge" && (
                <>
                  <div className="side-head"><span>Agent runs</span><Tip text="Past autonomous agent sessions for this machine." /></div>
                  <div className="side-list">
                    {forgeHistory.map((h) => (
                      <button key={h.id} className={`side-item ${forgeSession?.id === h.id ? "active" : ""}`} onClick={() => {
                        setForgeSession(h); setForgeText(h.text || ""); setForgeEvents(h.events || []); setForgePrompt(h.prompt || "");
                      }}>
                        <div className="side-item-title">{h.prompt?.slice(0, 48) || h.id}</div>
                        <div className="muted tiny">{h.status} · {h.model}</div>
                      </button>
                    ))}
                    {!forgeHistory.length && <div className="muted pad">Your agent runs show up here.</div>}
                  </div>
                </>
              )}
              {tab === "skills" && (
                <>
                  <div className="side-head"><span>Active skill</span><Tip text="The selected personality is prepended to the Chat system prompt." /></div>
                  <div className="side-list">
                    <button className={`side-item ${!activeSkill ? "active" : ""}`} onClick={() => activateSkill("")}>
                      <div className="side-item-title">Neutral</div>
                      <div className="muted tiny">No personality overlay</div>
                    </button>
                    {skills.map((s) => (
                      <button key={s.id} className={`side-item ${activeSkill?.id === s.id ? "active" : ""}`} onClick={() => activateSkill(s.id)}>
                        <div className="side-item-title">{s.emoji} {s.name}</div>
                        <div className="muted tiny">{s.tagline}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </nav>
          )}

          <main className="main">
            {error && <div className="banner error flow-in">{error}<button className="btn ghost" onClick={() => setError("")}>Dismiss</button></div>}

            {tab === "chat" && (
              <section className="view chat-view">
                <div className="messages">
                  {!(thread?.messages || []).length && (
                    <div className="hero-empty flow-in">
                      <div className="hero-kicker">Chat <Tip text="Local conversation with llama-server or Ollama. Brand nickname: Pulse." /></div>
                      <h1>Talk to a local model</h1>
                      <p>Load a GGUF from Models, tune it in LLM, pick a Skill, attach Data, then chat.</p>
                      <div className="row">
                        <button className="btn primary" onClick={() => setTab("bundles")}>Choose a bundle</button>
                        <button className="btn" onClick={() => setTab("models")}>Get models</button>
                        <button className="btn" onClick={() => setTab("llm")}>Open LLM studio</button>
                        <button className="btn" onClick={() => setTab("skills")}>Choose a skill</button>
                      </div>
                    </div>
                  )}
                  {(thread?.messages || []).map((m, i) => (
                    <article key={i} className={`bubble ${m.role} flow-in ${m.pinned ? "pinned" : ""}`}>
                      <div className="bubble-meta">
                        <span>{m.role}{m.source === "voice" ? " · voice" : ""}{m.attachments?.length ? ` · ${m.attachments.length} img` : ""}</span>
                        <span className="bubble-actions">
                          <button type="button" className={`pin-btn ${m.pinned ? "on" : ""}`} title="Pin in context (never compacted away)" onClick={() => togglePin(i)}>
                            {m.pinned ? "Pinned" : "Pin"}
                          </button>
                          <button type="button" className="pin-btn pivot" title="Branch a new timeline from here (Loki-style pivot)" onClick={() => pivotFromMessage(i)}>
                            Pivot
                          </button>
                        </span>
                      </div>
                      {thread?.branchFromMsgIndex === i && thread.parentId && (
                        <div className="pivot-banner">Bifurcation — branched from sacred timeline at this event</div>
                      )}
                      {!!m.attachments?.length && (
                        <div className="attach-row">
                          {m.attachments.map((a) => (
                            <img key={a.id} src={a.dataUrl} alt={a.name} className="attach-thumb" />
                          ))}
                        </div>
                      )}
                      {m.role === "assistant" ? <Markdown>{m.content}</Markdown> : <div>{m.content}</div>}
                      {m.citations?.map((c) => <div key={c.id} className="cite">[{c.filename} p.{c.page}] {c.snippet?.slice(0, 140)}</div>)}
                    </article>
                  ))}
                </div>
                <div className="composer-bar">
                  <ContextMeter usage={contextUsage} draft={{ text: input, images: pendingImages.length }} contextLength={settings.contextLength} />
                  <div className="row">
                    <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} title="RAG collection from Data tab">
                      <option value="">No data collection</option>
                      {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button className="btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>Attach image</button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        const imgs = await readImageFiles(files);
                        setPendingImages((prev) => [...prev, ...imgs].slice(0, settings.maxImagesPerTurn ?? 8));
                        e.target.value = "";
                      }}
                    />
                    <button className="btn" disabled={!busy} onClick={() => abort.current?.abort()}><Icon name="stop" /> Stop</button>
                  </div>
                  {!!pendingImages.length && (
                    <div className="attach-row pending">
                      {pendingImages.map((a) => (
                        <button key={a.id} type="button" className="attach-chip" onClick={() => setPendingImages((p) => p.filter((x) => x.id !== a.id))} title="Remove">
                          <img src={a.dataUrl} alt={a.name} />
                        </button>
                      ))}
                    </div>
                  )}
                  <VoiceControls
                    settings={settings}
                    patch={patch}
                    setError={setError}
                    disabled={busy}
                    onTranscript={applyVoiceTranscript}
                  />
                  <div
                    className="composer"
                    onPaste={async (e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      const files: File[] = [];
                      for (const it of Array.from(items)) {
                        if (it.type.startsWith("image/")) {
                          const f = it.getAsFile();
                          if (f) files.push(f);
                        }
                      }
                      if (!files.length) return;
                      e.preventDefault();
                      const imgs = await readImageFiles(files);
                      setPendingImages((prev) => [...prev, ...imgs].slice(0, settings.maxImagesPerTurn ?? 8));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (e.dataTransfer?.files?.length) {
                        const imgs = await readImageFiles(e.dataTransfer.files);
                        setPendingImages((prev) => [...prev, ...imgs].slice(0, settings.maxImagesPerTurn ?? 8));
                      }
                    }}
                  >
                    <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={activeSkill ? `Message as ${activeSkill.name}…` : "Message a local model… (paste or drop images)"} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <button className="btn primary" onClick={() => send()} disabled={busy || (!input.trim() && !pendingImages.length)}>Send</button>
                  </div>
                </div>
              </section>
            )}

            {tab === "llm" && (
              <LlmPanel
                settings={settings}
                hw={hw}
                library={library}
                patch={patch}
                refresh={refresh}
                setError={setError}
                setTab={setTab}
              />
            )}

            {tab === "models" && (
              <section className="view flow-in">
                <LocationBar folderDraft={folderDraft} libraryDir={libraryDir} onDraft={setFolderDraft} onSave={saveFolder} onBrowse={browseFolder} />
                <div className="seg">{MODEL_TABS.map(([id, label]) => <button key={id} className={modelTab === id ? "active" : ""} onClick={() => setModelTab(id)}>{label}</button>)}</div>
                {modelTab === "download" && (
                  <div className="stack">
                    <div className="row">
                      <input className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Hugging Face GGUF…" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
                      <button className="btn primary" onClick={() => runSearch()}>Search</button>
                    </div>
                    <div className="chips">{STARTER.map(([label, id]) => <button key={id} className="chip" onClick={() => runSearch(id)}>{label}</button>)}</div>
                    <div className="cards">{hits.map((h) => (
                      <div className="panel" key={h.id}>
                        <div className="panel-title">{h.id}</div>
                        <div className="muted">{h.downloads} downloads · {h.fit?.note}</div>
                        <button className="btn" onClick={() => openRepo(h.id)}>Choose quant</button>
                      </div>
                    ))}</div>
                    {repo && <div className="section-label">Files in {repo}</div>}
                    <div className="cards">{files.map((f) => (
                      <div className="panel" key={f.path}>
                        <div className="panel-title">{f.path}</div>
                        <div className="muted">{f.quant} · {bytes(f.size)}</div>
                        <button className="btn primary" onClick={() => downloadFile(f.path)}>Download</button>
                      </div>
                    ))}</div>
                    {downloads.map((d) => {
                      const pct = d.total ? Math.round((100 * (d.received || 0)) / d.total) : 0;
                      return (
                        <div className="panel" key={d.id}>
                          <div>{d.id}</div>
                          <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                          <div className="muted">{d.status} · {bytes(d.received)} / {bytes(d.total)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {modelTab === "library" && (
                  <div className="stack">
                    {!library.length && (
                      <div className="hero-empty flow-in">
                        <div className="hero-kicker">Library</div>
                        <h2>No models on disk yet</h2>
                        <p className="muted">Download a GGUF from Hugging Face, set your models folder, or import an existing file.</p>
                        <div className="row">
                          <button className="btn primary" onClick={() => setModelTab("download")}>Search Hugging Face</button>
                          <button className="btn" onClick={() => browseFolder()}>Choose models folder</button>
                        </div>
                      </div>
                    )}
                    <div className="cards two">
                      {library.map((m) => (
                        <div className="panel" key={m.path}>
                          <div className="panel-title">{m.name}</div>
                          <div className="muted">{bytes(m.size)} · {m.quant}</div>
                          <div className="mono muted">{m.path}</div>
                          <button className="btn primary" onClick={async () => {
                            await patch({ loadedModel: m.path });
                            await api("/inference/start", { method: "POST", body: JSON.stringify({ modelPath: m.path }) });
                            refresh(); setTab("chat");
                          }}>Load in Chat</button>
                        </div>
                      ))}
                      <div className="panel">
                        <div className="panel-title">Import file</div>
                        <input value={importPath} onChange={(e) => setImportPath(e.target.value)} placeholder="C:\path\to\model.gguf" />
                        <button className="btn" onClick={async () => { await api("/models/import", { method: "POST", body: JSON.stringify({ path: importPath }) }); refresh(); }}>Copy into library</button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {tab === "bundles" && (
              <BundlesPanel
                bundles={bundles}
                onRefresh={refresh}
                setError={setError}
                setTab={setTab}
              />
            )}

            {tab === "forge" && (
              <section className="view forge-view flow-in">
                <div className="panel spotlight">
                  <div className="panel-head">
                    <div>
                      <div className="hero-kicker">Agent <Tip text="Autonomous coding agent (Forge). Needs an API key under Options → Agent." /></div>
                      <div className="panel-title">Run a coding agent on a workspace</div>
                      <div className="muted">Point it at a folder. It can explore and edit files — local machine or cloud VM.</div>
                    </div>
                    <span className={`status-pill ${forge.configured ? "ok" : "warn"}`}>{forge.configured ? "Key set" : "Needs key"}</span>
                  </div>
                  <div className="form-grid">
                    <label>Workspace
                      <div className="row">
                        <input className="grow" value={forgeCwdDraft} onChange={(e) => setForgeCwdDraft(e.target.value)} placeholder="D:\PROJECT\MyRepo" />
                        <button className="btn" onClick={async () => {
                          const r = await api<{ cancelled?: boolean; path?: string }>("/forge/pick-cwd", { method: "POST" });
                          if (!r.cancelled && r.path) { setForgeCwdDraft(r.path); refresh(); }
                        }}>Browse</button>
                        <button className="btn" onClick={() => patch({ cursorCwd: forgeCwdDraft.trim() }).then(refresh)}>Save</button>
                      </div>
                    </label>
                    <label>Model
                      <div className="row">
                        <input className="grow" value={settings.cursorModel || "composer-2.5"} onChange={(e) => patch({ cursorModel: e.target.value })} list="forge-models" />
                        <button className="btn" onClick={async () => {
                          const m = await api<any>("/forge/models");
                          setForgeModels(Array.isArray(m) ? m : m.items || []);
                        }}>List</button>
                      </div>
                      <datalist id="forge-models">{forgeModels.map((m: any) => { const id = m.id || m.name || String(m); return <option key={id} value={id} />; })}</datalist>
                    </label>
                    <label>Runtime
                      <select value={settings.cursorRuntime || "local"} onChange={(e) => patch({ cursorRuntime: e.target.value })}>
                        <option value="local">Local machine</option>
                        <option value="cloud">Cloud VM</option>
                      </select>
                    </label>
                    {(settings.cursorRuntime || "local") === "cloud" && (
                      <label>GitHub repo<input value={settings.cursorCloudRepo || ""} onChange={(e) => patch({ cursorCloudRepo: e.target.value })} placeholder="https://github.com/org/repo" /></label>
                    )}
                  </div>
                </div>
                <div className="composer-bar forge-composer">
                  <ContextMeter usage={forgeBudget} draft={{ text: forgePrompt, voice: forgeVoiceNote, images: forgeImages.length }} contextLength={settings.contextLength} />
                  <VoiceControls
                    settings={settings}
                    patch={patch}
                    setError={setError}
                    disabled={forgeBusy}
                    onTranscript={applyForgeVoice}
                  />
                  {forgeVoiceNote && (
                    <div className="voice-note panel compact">
                      <div className="section-label">Voice note in agent context</div>
                      <div className="muted">{forgeVoiceNote}</div>
                      <button className="btn ghost" type="button" onClick={() => setForgeVoiceNote("")}>Clear voice</button>
                    </div>
                  )}
                  <textarea value={forgePrompt} onChange={(e) => setForgePrompt(e.target.value)} placeholder="What should the agent build, fix, or explore?" rows={4} />
                  <div className="row wrap">
                    <button className="btn" type="button" onClick={() => forgeFileRef.current?.click()} disabled={forgeBusy}>Attach image</button>
                    <input
                      ref={forgeFileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        const imgs = await readImageFiles(files);
                        setForgeImages((prev) => [...prev, ...imgs].slice(0, 8));
                        e.target.value = "";
                      }}
                    />
                    <label className="row check">
                      <input type="checkbox" checked={forgeIncludeChat} onChange={(e) => setForgeIncludeChat(e.target.checked)} />
                      Include recent Chat context
                    </label>
                  </div>
                  {!!forgeImages.length && (
                    <div className="attach-row pending">
                      {forgeImages.map((a) => (
                        <button key={a.id} type="button" className="attach-chip" onClick={() => setForgeImages((p) => p.filter((x) => x.id !== a.id))} title="Remove">
                          <img src={a.dataUrl} alt={a.name} />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="row">
                    <button className="btn primary" disabled={forgeBusy || !forge.configured} onClick={() => runForge(false)}>{forgeBusy ? "Running…" : "Run agent"}</button>
                    <button className="btn" disabled={forgeBusy || !forgeSession?.agentId} onClick={() => runForge(true)}>Follow-up</button>
                    <button className="btn" disabled={!forgeBusy} onClick={() => { forgeAbort.current?.abort(); if (forgeSession?.id) api("/forge/cancel", { method: "POST", body: JSON.stringify({ id: forgeSession.id }) }); }}><Icon name="stop" /> Stop</button>
                    <button className="btn ghost" onClick={() => { setOptionTab("forge"); setTab("settings"); }}>API key</button>
                  </div>
                </div>
                <div className="forge-split">
                  <div className="panel grow">
                    <div className="section-label">Transcript</div>
                    <div className="forge-output">{forgeText ? <Markdown>{forgeText}</Markdown> : <div className="muted">Live agent output streams here.</div>}</div>
                  </div>
                  <div className="panel timeline">
                    <div className="section-label">Activity</div>
                    <div className="event-list">
                      {forgeEvents.map((e, i) => (
                        <div key={i} className="event-row"><span className="event-type">{e.type}</span><span className="muted">{e.name ? `${e.name} · ` : ""}{e.preview}</span></div>
                      ))}
                      {!forgeEvents.length && <div className="muted">Tool calls appear as the agent works.</div>}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {tab === "skills" && (
              <section className="view flow-in">
                <div className="hero-banner">
                  <div>
                    <div className="hero-kicker">Skills <Tip text="Personality packs. Activating one changes how Chat answers." /></div>
                    <h2>Personalities for Chat</h2>
                    <p className="muted">Activate a skill to shape replies. Built-ins are ready; create your own packs anytime.</p>
                  </div>
                  {activeSkill && <div className="active-chip">{activeSkill.emoji} {activeSkill.name} live</div>}
                </div>
                <div className="cards skill-grid">
                  {skills.map((s) => (
                    <button key={s.id} className={`skill-card ${activeSkill?.id === s.id ? "active" : ""}`} onClick={() => activateSkill(s.id)}>
                      <div className="skill-emoji">{s.emoji}</div>
                      <div className="panel-title">{s.name}</div>
                      <div className="muted">{s.tagline}</div>
                      <div className="tone-pill">{s.tone}</div>
                      <div className="skill-preview">{s.personality.slice(0, 120)}…</div>
                      {!s.builtin && (
                        <span className="btn danger tiny-btn" onClick={(e) => { e.stopPropagation(); api(`/skills/${s.id}`, { method: "DELETE" }).then(refresh); }}>Delete</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="panel">
                  <div className="panel-title">Create a skill pack</div>
                  <div className="form-grid">
                    <div className="row">
                      <input style={{ width: 64 }} value={skillDraft.emoji} onChange={(e) => setSkillDraft({ ...skillDraft, emoji: e.target.value })} placeholder="○" />
                      <input className="grow" value={skillDraft.name} onChange={(e) => setSkillDraft({ ...skillDraft, name: e.target.value })} placeholder="Name — e.g. Night Owl" />
                    </div>
                    <input value={skillDraft.tagline} onChange={(e) => setSkillDraft({ ...skillDraft, tagline: e.target.value })} placeholder="Short tagline" />
                    <textarea value={skillDraft.personality} onChange={(e) => setSkillDraft({ ...skillDraft, personality: e.target.value })} placeholder="Personality prompt — how this skill should think and speak" rows={5} />
                    <button className="btn primary" onClick={createSkill}>Save skill</button>
                  </div>
                </div>
              </section>
            )}

            {tab === "harbor" && (
              <section className="view flow-in">
                <div className="hero-banner">
                  <div>
                    <div className="hero-kicker">Data <Tip text="Load files/folders into collections. Chat can retrieve them (RAG). Brand nickname: Harbor." /></div>
                    <h2>Load files & folders</h2>
                    <p className="muted">Index docs, notes, or code into a collection, then select it in Chat.</p>
                  </div>
                </div>
                <div className="panel spotlight drop-zone">
                  <div className="row">
                    <button className="btn primary" onClick={async () => {
                      await api("/rag/collections", { method: "POST", body: JSON.stringify({ name: "Collection " + (collections.length + 1) }) });
                      refresh();
                    }}><Icon name="plus" /> New collection</button>
                    <select className="grow" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} title="Select which collection to load into">
                      <option value="">Select collection</option>
                      {collections.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.docs} docs</option>)}
                    </select>
                    <button className="btn" disabled={!collectionId} onClick={() => { setTab("chat"); }}>Use in Chat</button>
                  </div>
                  <div className="row">
                    <input className="grow" value={dataPath} onChange={(e) => setDataPath(e.target.value)} placeholder="D:\docs or C:\repo\README.md" />
                    <button className="btn" onClick={async () => {
                      const r = await api<{ cancelled?: boolean; path?: string }>("/harbor/pick", { method: "POST" });
                      if (!r.cancelled && r.path) setDataPath(r.path);
                    }}><Icon name="folder" /> Browse folder</button>
                    <button className="btn primary" disabled={ingestBusy || !collectionId || !dataPath} onClick={ingestData}>
                      {ingestBusy ? "Loading…" : "Load path"}
                    </button>
                  </div>
                  <div className="muted">Supports folders (recursive) and files: PDF, DOCX, MD, TXT, code, and more.</div>
                  {ingestResult && (
                    <div className="banner ok">Loaded {ingestResult.files || 1} file(s) · {ingestResult.chunks || 0} chunks{ingestResult.errors?.length ? ` · ${ingestResult.errors.length} skipped` : ""}</div>
                  )}
                </div>
                <div className="section-label">Sources in collection</div>
                <div className="cards">
                  {sources.map((s) => (
                    <div className="panel" key={s.filename}>
                      <div className="panel-title">{s.filename}</div>
                      <div className="muted">{s.chunks} chunks indexed</div>
                    </div>
                  ))}
                  {!sources.length && <div className="muted">Nothing loaded yet — browse a folder to begin.</div>}
                </div>
              </section>
            )}

            {tab === "tools" && (
              <section className="view stack flow-in">
                <div className="seg">{TOOL_TABS.map(([id, label, tip]) => (
                  <button key={id} className={toolTab === id ? "active" : ""} onClick={() => setToolTab(id)} title={tip}>
                    <LabelWithTip tip={tip}>{label}</LabelWithTip>
                  </button>
                ))}</div>
                {toolTab === "server" && (
                  <div className="stack">
                    <div className="panel">OpenAI-style API {apiState.running ? "running" : "stopped"} on {apiState.bind}:{apiState.port || settings.apiPort || 4782}</div>
                    <div className="row">
                      <button className="btn primary" onClick={async () => { await api("/api-server/start", { method: "POST" }); refresh(); }}>Start</button>
                      <button className="btn" onClick={async () => { await api("/api-server/stop", { method: "POST" }); refresh(); }}>Stop</button>
                      <button className="btn" onClick={async () => setInspector(await api("/api-server/inspector"))}>Inspector</button>
                    </div>
                    {inspector.map((r, i) => <div className="muted" key={i}>{r.path} {r.ms}ms {r.status}</div>)}
                  </div>
                )}
                {toolTab === "mcp" && (
                  <div className="stack">
                    <input value={mcpCmd} onChange={(e) => setMcpCmd(e.target.value)} />
                    <input value={mcpArgs} onChange={(e) => setMcpArgs(e.target.value)} />
                    <button className="btn primary" onClick={async () => {
                      await api("/mcp/connect", { method: "POST", body: JSON.stringify({ id: "fs", command: mcpCmd, args: mcpArgs.split(" ").filter(Boolean) }) });
                      setMcp(await api("/mcp"));
                    }}>Connect</button>
                    {mcp.map((s) => <div key={s.id} className="panel">{s.id} {s.status}</div>)}
                    <button className="btn" onClick={async () => setPending(await api("/mcp/pending"))}>Pending</button>
                    {pending.map((p) => (
                      <div className="panel" key={p.id}>{p.name}
                        <div className="row">
                          <button className="btn primary" onClick={() => api("/mcp/permission", { method: "POST", body: JSON.stringify({ id: p.id, decision: "allow" }) })}>Allow</button>
                          <button className="btn" onClick={() => api("/mcp/permission", { method: "POST", body: JSON.stringify({ id: p.id, decision: "deny" }) })}>Deny</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {toolTab === "race" && (
                  <div className="stack">
                    <div className="panel">
                      <div className="panel-title">
                        <LabelWithTip tip="Ollama tags = the list of models already pulled on your machine (from ollama list / GET /api/tags). We do not rename this — it is the standard Ollama term.">
                          Ollama tags
                        </LabelWithTip>
                      </div>
                      <div className="muted">Load installed Ollama model names, then race the same prompt across up to 3 of them.</div>
                      {ollama.length > 0 && (
                        <div className="chips">
                          {ollama.slice(0, 12).map((m: any) => (
                            <span key={m.name || m.model} className="chip" title={m.name || m.model}>{m.name || m.model}</span>
                          ))}
                        </div>
                      )}
                      {!ollama.length && <div className="muted">No tags loaded yet — click Load Ollama tags (requires Ollama running).</div>}
                    </div>
                    <textarea value={racePrompt} onChange={(e) => setRacePrompt(e.target.value)} />
                    <div className="row">
                      <button
                        className="btn"
                        title="Calls Ollama GET /api/tags — returns installed model names"
                        onClick={async () => {
                          try {
                            const tags = await api<any>("/ollama/tags");
                            setOllama(Array.isArray(tags) ? tags : tags.models || []);
                          } catch (e: any) {
                            setError(e.message || "Could not load Ollama tags. Is Ollama running?");
                          }
                        }}
                      >
                        Load Ollama tags
                        <Tip text="Standard Ollama API: lists every model tag installed locally (e.g. llama3.2:latest)." />
                      </button>
                      <button
                        className="btn primary"
                        disabled={!ollama.length}
                        title="Run the prompt on the first 3 Ollama tags"
                        onClick={async () => setRaceOut(await api("/race", { method: "POST", body: JSON.stringify({ prompt: racePrompt, runners: ollama.slice(0, 3).map((m: any) => ({ provider: "ollama", model: m.name || m.model })) }) }))}
                      >
                        Race models
                      </button>
                    </div>
                    {raceOut.map((r, i) => <div className="panel" key={i}><strong>{r.model}</strong> {r.ms}ms {r.ok ? r.text : r.error}</div>)}
                  </div>
                )}
              </section>
            )}

            {tab === "about" && (
              <section className="view flow-in stack">
                <OwnerCard />
                <div className="panel">
                  <div className="panel-title">Localmod</div>
                  <div className="muted">
                    Local-first desktop studio for open-weight models — Chat, LLM controls, Agents, Skills, and Data.
                    MIT licensed. No chats leave your machine unless you choose cloud agent runs.
                  </div>
                  <div className="muted tiny">
                    Runtime: {desktop.isDesktop ? `Desktop (${desktop.platform})` : "Browser"} · React + Electron-ready
                    {desktop.versions?.electron ? ` · Electron ${desktop.versions.electron}` : ""}
                  </div>
                  <div className="row">
                    <a className="btn" href={OWNER.repo.url} target="_blank" rel="noreferrer">View on GitHub</a>
                    <a className="btn primary" href={OWNER.linkedin.url} target="_blank" rel="noreferrer">Message on LinkedIn</a>
                  </div>
                </div>
              </section>
            )}

            {tab === "settings" && (
              <section className="view options-layout flow-in">
                <div className="options-nav">
                  {OPTION_TABS.map(([id, label, tip]) => (
                    <button key={id} className={optionTab === id ? "active" : ""} onClick={() => setOptionTab(id)} title={tip}>
                      <LabelWithTip tip={tip}>{label}</LabelWithTip>
                    </button>
                  ))}
                </div>
                <div className="options-body stack">
                  <div className="panel-title">Options · {OPTION_TABS.find(([id]) => id === optionTab)?.[1]}</div>
                  {optionTab === "voice" && <VoiceSettingsPanel settings={settings} patch={patch} />}
                  {optionTab === "forge" && (
                    <div className="stack">
                      <div className="panel">
                        <div className="panel-title">
                          <LabelWithTip tip="API key used by the coding agent. Same key family as CURSOR_API_KEY if you already have one.">
                            Agent API key
                          </LabelWithTip>
                        </div>
                        <div className="muted">Powers the Agent tab. Paste your key, or set CURSOR_API_KEY in the environment.</div>
                        <input type="password" value={settings.cursorApiKey || ""} onChange={(e) => patch({ cursorApiKey: e.target.value })} placeholder="API key…" />
                      </div>
                      <label><LabelWithTip tip="Default model id for agent runs.">Default model</LabelWithTip><input value={settings.cursorModel || "composer-2.5"} onChange={(e) => patch({ cursorModel: e.target.value })} /></label>
                      <label><LabelWithTip tip="Local folder the agent works in.">Default workspace</LabelWithTip><input value={settings.cursorCwd || ""} onChange={(e) => patch({ cursorCwd: e.target.value })} /></label>
                      <label><LabelWithTip tip="GitHub repo URL when Agent runtime is Cloud.">Cloud repo</LabelWithTip><input value={settings.cursorCloudRepo || ""} onChange={(e) => patch({ cursorCloudRepo: e.target.value })} /></label>
                    </div>
                  )}
                  {optionTab === "models" && (
                    <div className="stack">
                      <LocationBar folderDraft={folderDraft} libraryDir={libraryDir} onDraft={setFolderDraft} onSave={saveFolder} onBrowse={browseFolder} />
                      <div className="panel">
                        <div className="panel-title">Full LLM controls</div>
                        <div className="muted">GPU layers, sampling, KV cache, RoPE, and more live in the LLM tab (LM Studio-style).</div>
                        <button className="btn primary" onClick={() => setTab("llm")}>Open LLM studio</button>
                      </div>
                    </div>
                  )}
                  {optionTab === "privacy" && (
                    <div className="stack">
                      <label className="row check"><input type="checkbox" checked={!!settings.airplane} onChange={(e) => patch({ airplane: e.target.checked })} /> Airplane mode</label>
                      <div className="row">
                        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Vault passphrase" />
                        <button className="btn" onClick={() => api("/vault/setup", { method: "POST", body: JSON.stringify({ passphrase: pass }) }).then(() => refresh())}>Set</button>
                        <button className="btn" onClick={() => api("/vault/unlock", { method: "POST", body: JSON.stringify({ passphrase: pass }) }).then(() => refresh())}>Unlock</button>
                        <button className="btn" onClick={() => api("/vault/lock", { method: "POST" }).then(() => refresh())}>Lock</button>
                      </div>
                      <button className="btn" onClick={async () => setIntegrity(await api("/integrity"))}>Integrity log</button>
                      {integrity && <pre className="mono muted">{JSON.stringify(integrity.verify, null, 2)}</pre>}
                    </div>
                  )}
                  {optionTab === "developer" && (
                    <div className="stack">
                      <label>
                        <LabelWithTip tip="Base URL for your local Ollama server. Used for tags listing and race.">Ollama URL</LabelWithTip>
                        <input value={settings.ollamaUrl || ""} onChange={(e) => patch({ ollamaUrl: e.target.value })} />
                      </label>
                      <label>
                        <LabelWithTip tip="Port for the OpenAI-compatible Local API under Tools.">Local API port</LabelWithTip>
                        <input type="number" value={settings.apiPort ?? 4782} onChange={(e) => patch({ apiPort: Number(e.target.value) })} />
                      </label>
                    </div>
                  )}
                </div>
              </section>
            )}
          </main>

          <aside className="inspector">
            <div className="section-label">Now</div>
            <div className="panel compact">
              <div>{hw?.inference?.running ? "Engine live" : "Engine idle"}</div>
              <div className="mono muted tiny">{settings.loadedModel || "No model"}</div>
            </div>
            <div className="section-label"><LabelWithTip tip="Active Skill personality for Chat.">Skill</LabelWithTip></div>
            <div className="panel compact">{activeSkill ? `${activeSkill.emoji} ${activeSkill.name}` : "Neutral"}</div>
            <div className="section-label"><LabelWithTip tip="Selected Data collection for RAG.">Data</LabelWithTip></div>
            <div className="panel compact muted">{collections.find((c) => c.id === collectionId)?.name || "None selected"}</div>
            <div className="section-label"><LabelWithTip tip="Folder the coding agent uses.">Agent workspace</LabelWithTip></div>
            <div className="panel compact mono muted">{settings.cursorCwd || forgeCwdDraft || "not set"}</div>
            <OwnerCard compact />
          </aside>
        </div>

        <footer className="statusbar">
          <span className="brand-word">Localmod</span>
          <span className="dot" />
          <span>by {OWNER.name}</span>
          <span className="dot" />
          <a className="status-link" href={OWNER.github.url} target="_blank" rel="noreferrer">GitHub</a>
          <span className="dot" />
          <a className="status-link" href={OWNER.linkedin.url} target="_blank" rel="noreferrer">LinkedIn</a>
          <span className="grow" />
          <span>{forge.activeRuns ? `${forge.activeRuns} agent run(s)` : "Ready"}</span>
        </footer>
      </div>

      {palette && (
        <>
          <div className="overlay" onClick={() => setPalette(false)} />
          <div className="palette flow-in">
            <input autoFocus value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} placeholder="Jump to Chat, Agent, Skills, Ollama tags…" onKeyDown={(e) => {
              if (e.key === "Enter" && paletteItems[0]) { paletteItems[0].run(); setPalette(false); }
            }} />
            <div className="palette-list">
              {paletteItems.map((item) => (
                <button key={item.id} onClick={() => { item.run(); setPalette(false); }}>{item.label}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
