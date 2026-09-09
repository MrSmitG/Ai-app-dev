import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import {
  BlackwhaleApp,
  NightweaverApp,
  ObsidianApp,
  MakoApp,
  TrenchApp,
  IronmantisApp,
} from "../components/SuiteApps";

const APPS = [
  { id: "blackwhale", name: "Blackwhale", port: 1421 },
  { id: "nightweaver", name: "Nightweaver", port: 1422 },
  { id: "obsidian", name: "Obsidian", port: 1423 },
  { id: "mako", name: "Mako", port: 1424 },
  { id: "trench", name: "The Trench", port: 1425 },
  { id: "ironmantis", name: "Ironmantis", port: 1426 },
] as const;

export function StandaloneRoot({ appId }: { appId: string }) {
  const [settings, setSettings] = useState<any>({});
  const [err, setErr] = useState("");
  const meta = APPS.find((a) => a.id === appId) || APPS[0];

  const refresh = useCallback(async () => {
    try {
      setSettings(await api<any>("/settings"));
      setErr("");
    } catch (e: any) {
      setErr(e.message || "Engine not running on 127.0.0.1:4781");
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("solo-body");
    document.documentElement.dataset.app = appId;
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [appId, refresh]);

  async function patch(partial: Record<string, unknown>) {
    const next = await api<any>("/settings", { method: "POST", body: JSON.stringify(partial) });
    setSettings(next);
    return next;
  }

  function openApp(id: string) {
    const hit = APPS.find((a) => a.id === id);
    if (!hit) return;
    window.open(`http://127.0.0.1:${hit.port}`, "_blank", "noopener");
  }

  let body: ReactNode = null;
  if (appId === "blackwhale") body = <BlackwhaleApp settings={settings} />;
  else if (appId === "nightweaver") body = <NightweaverApp settings={settings} patch={patch} />;
  else if (appId === "obsidian") body = <ObsidianApp settings={settings} patch={patch} />;
  else if (appId === "mako") body = <MakoApp openApp={openApp} />;
  else if (appId === "trench") body = <TrenchApp settings={settings} patch={patch} />;
  else if (appId === "ironmantis") body = <IronmantisApp settings={settings} patch={patch} />;

  return (
    <div className="solo-shell" data-app={appId}>
      <header className="solo-top">
        <div>
          <div className="solo-mark">{meta.name}</div>
          <div className="muted tiny">Localmod · one React app · port {meta.port}</div>
        </div>
        <nav className="solo-switch">
          {APPS.map((a) => (
            <a
              key={a.id}
              className={`solo-link ${a.id === appId ? "on" : ""}`}
              href={`http://127.0.0.1:${a.port}`}
              title={`Start with: npm run ${a.id}`}
            >
              {a.name}
            </a>
          ))}
        </nav>
      </header>
      {err && (
        <div className="banner">
          {err}. Start the engine (`npm run dev:engine`) or run this app with `npm run {appId}`.
        </div>
      )}
      <main className="solo-main">{body}</main>
      <footer className="solo-foot muted tiny">
        This window is <strong>{meta.name}</strong> only. Start another:{" "}
        {APPS.filter((a) => a.id !== appId)
          .map((a) => `npm run ${a.id}`)
          .join(" · ")}
      </footer>
    </div>
  );
}
