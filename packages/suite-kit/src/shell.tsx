import type { ReactNode } from "react";
import { useEffect } from "react";
import { APPS, TASKS, type AppId } from "./catalog";

export function TaskBoard({ appId }: { appId: AppId }) {
  const t = TASKS[appId];
  return (
    <div className="task-board">
      <div className="panel">
        <div className="section-label">This app’s work</div>
        <ul className="task-list does">
          {t.does.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
      <div className="panel">
        <div className="section-label">Not this app</div>
        <ul className="task-list not">
          {t.not.map((n) => {
            const other = APPS.find((a) => a.id === n.id)!;
            return (
              <li key={n.id}>
                <span className="muted">{n.task}</span> →{" "}
                <a href={`http://127.0.0.1:${other.port}`}>{other.name}</a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function AppShell({
  appId,
  children,
  error,
}: {
  appId: AppId;
  children: ReactNode;
  error?: string;
}) {
  const meta = APPS.find((a) => a.id === appId)!;
  useEffect(() => {
    document.body.classList.add("solo-body");
    document.documentElement.dataset.app = appId;
    document.title = meta.name;
  }, [appId, meta.name]);

  return (
    <div className="solo-shell" data-app={appId}>
      <header className="solo-top">
        <div>
          <div className="solo-mark">{meta.name}</div>
          <div className="muted tiny">
            {meta.usage} · React app · port {meta.port}
          </div>
        </div>
        <nav className="solo-switch">
          {APPS.map((a) => (
            <a
              key={a.id}
              className={`solo-link ${a.id === appId ? "on" : ""}`}
              href={`http://127.0.0.1:${a.port}`}
              title={`npm run ${a.id}`}
            >
              {a.name}
            </a>
          ))}
        </nav>
      </header>
      {error && (
        <div className="banner">
          {error}. Start the engine with <code>npm run dev:engine</code> or this app with <code>npm run {appId}</code>.
        </div>
      )}
      <main className="solo-main">
        <TaskBoard appId={appId} />
        {children}
      </main>
      <footer className="solo-foot muted tiny">
        Setup: <code>npm install</code> at the repo root, then <code>npm run {appId}</code>. This window only does {meta.name}’s work.
      </footer>
    </div>
  );
}
