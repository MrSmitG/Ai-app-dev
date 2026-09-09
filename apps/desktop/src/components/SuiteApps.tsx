import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PRODUCT, SUITE_APKS } from "../web3";
import { Tip } from "./ui";

export function SuiteHome({
  setTab: _setTab,
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
        <h2 className="owner-name">Six different React apps. Start one.</h2>
        <p className="muted">
          Each product has its own layout, CSS, and Vite process — not a shared shell with different titles.
          Run <code className="mono">npm run blackwhale</code>, then <code className="mono">npm run nightweaver</code>,
          and so on. Cards open that app’s port (start it first).
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
          <button className="btn" disabled={!!busy} type="button" onClick={() => runInstall("android")}>
            {busy === "android" ? "Downloading…" : "Download all Android APKs"}
          </button>
        </div>
        <div className="row wrap pad-sm">
          {SUITE_APKS.map((app) => (
            <button
              key={app.id}
              className="btn"
              disabled={!!busy}
              type="button"
              onClick={() => runInstall(app.id)}
            >
              {busy === app.id ? "Downloading…" : app.file}
            </button>
          ))}
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
          <div key={app.id} className="suite-card">
            <button
              type="button"
              className="suite-card-open"
              onClick={() => window.open(`http://127.0.0.1:${app.port}`, "_blank", "noopener")}
            >
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
                  Own React app in {app.folder} · {app.start} · http://127.0.0.1:{app.port}
                </div>
              )}
            </button>
            <a
              className="btn suite-apk-link"
              href={PRODUCT.downloads.apks[app.id as keyof typeof PRODUCT.downloads.apks]}
              download={`${app.id}.apk`}
            >
              {app.apk || `${app.id}.apk`}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function SuiteLaunch({
  name,
  port,
  start,
  blurb,
}: {
  name: string;
  port: number;
  start: string;
  blurb: string;
}) {
  return (
    <section className="view flow-in">
      <div className="panel spotlight">
        <div className="hero-kicker">{name} · separate React app</div>
        <h2 className="owner-name">{name} is its own product.</h2>
        <p className="muted">{blurb}</p>
        <p className="muted">
          This hub does not embed it. Start the app, then open its window:
        </p>
        <p>
          <code className="mono">{start}</code>
          {" → "}
          <code className="mono">http://127.0.0.1:{port}</code>
        </p>
        <div className="row wrap pad-sm">
          <button
            className="btn primary"
            type="button"
            onClick={() => window.open(`http://127.0.0.1:${port}`, "_blank", "noopener")}
          >
            Open {name}
          </button>
        </div>
      </div>
    </section>
  );
}

export function NightweaverApp() {
  return (
    <SuiteLaunch
      name="Nightweaver"
      port={1422}
      start="npm run nightweaver"
      blurb="A three-column IDE: file tree, plan, activity log. Agentic multi-file edits only."
    />
  );
}

export function ObsidianApp() {
  return (
    <SuiteLaunch
      name="Obsidian"
      port={1423}
      start="npm run obsidian"
      blurb="A stone vault of provider tablets. API keys only — no chat, no races."
    />
  );
}

export function MakoApp() {
  return (
    <SuiteLaunch
      name="Mako"
      port={1424}
      start="npm run mako"
      blurb="A race HUD: giant latency number, ping lanes, prompt race. Speed only."
    />
  );
}

export function TrenchApp() {
  return (
    <SuiteLaunch
      name="The Trench"
      port={1425}
      start="npm run trench"
      blurb="Paper-and-ink split editor. One file, preview or apply, then surface."
    />
  );
}

export function IronmantisApp() {
  return (
    <SuiteLaunch
      name="Ironmantis"
      port={1426}
      start="npm run ironmantis"
      blurb="A phosphor terminal. Autonomous files + allowlisted CLI."
    />
  );
}

export const CodeApp = NightweaverApp;
export const KeysApp = ObsidianApp;
export const FastApp = MakoApp;
export const EditorApp = TrenchApp;
export const HandsApp = IronmantisApp;
export const EngineerApp = IronmantisApp;
