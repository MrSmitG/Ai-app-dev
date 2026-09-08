import { PRODUCT } from "../web3";

function OsMark({ id }: { id: "windows" | "mac" | "linux" }) {
  if (id === "windows") {
    return (
      <svg viewBox="0 0 24 24" width="42" height="42" aria-hidden>
        <path fill="currentColor" d="M3 5.5 10.2 4.4v7.1H3V5.5zm8.4-1.3L21 2.5v9H11.4V4.2zM3 13.5h7.2V20.6L3 19.5v-6zm8.4 0H21V21.5l-9.6-1.4v-6.6z" />
      </svg>
    );
  }
  if (id === "mac") {
    return (
      <svg viewBox="0 0 24 24" width="42" height="42" aria-hidden>
        <path
          fill="currentColor"
          d="M16.4 12.4c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.8 3-.8s1.8.8 3 .8 2-.1 2.9-2.3c1-1.4 1.4-2.7 1.4-2.8-.1 0-2.7-1-2.7-4.4zM14.7 5.3c.6-.8 1.1-1.9.9-3-1 .1-2.1.7-2.8 1.5-.6.7-1.2 1.9-.9 2.9 1.1.1 2.2-.5 2.8-1.4z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="42" height="42" aria-hidden>
      <path
        fill="currentColor"
        d="M12.5 2c.4 0 .7.3.8.7l.3 1.3c1.7.3 3.2 1.1 4.4 2.2l1.2-.5c.4-.2.8 0 1 .4l1 1.8c.2.4 0 .8-.3 1l-1 .7c.2.8.3 1.6.3 2.4s-.1 1.6-.3 2.4l1 .7c.4.2.5.6.3 1l-1 1.8c-.2.4-.6.6-1 .4l-1.2-.5c-1.2 1.1-2.7 1.9-4.4 2.2l-.3 1.3c-.1.4-.4.7-.8.7h-2c-.4 0-.7-.3-.8-.7l-.3-1.3c-1.7-.3-3.2-1.1-4.4-2.2l-1.2.5c-.4.2-.8 0-1-.4l-1-1.8c-.2-.4 0-.8.3-1l1-.7C3.1 13.6 3 12.8 3 12s.1-1.6.3-2.4l-1-.7c-.4-.2-.5-.6-.3-1l1-1.8c.2-.4.6-.6 1-.4l1.2.5C7.4 4.1 8.9 3.3 10.6 3l.3-1.3c.1-.4.4-.7.8-.7h.8zM11 9.5A2.5 2.5 0 1 0 11 14.5 2.5 2.5 0 0 0 11 9.5z"
      />
    </svg>
  );
}

const TILES = [
  {
    id: "windows" as const,
    label: "Windows",
    file: "Localmod.exe",
    href: PRODUCT.downloads.windows,
    hint: "Download, then click the Localmod icon. No install, no terminal.",
  },
  {
    id: "mac" as const,
    label: "macOS",
    file: "Localmod.dmg",
    href: PRODUCT.downloads.mac,
    hint: "Open the DMG, drag Localmod to Applications, click the icon.",
  },
  {
    id: "linux" as const,
    label: "Linux",
    file: "Localmod.AppImage",
    href: PRODUCT.downloads.linux,
    hint: "Download, then double-click the Localmod icon.",
  },
];

export function DownloadIcons({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="owner-card compact">
        <div className="section-label">Get the app</div>
        <div className="muted tiny">Click an icon — GitHub download, then run Localmod.</div>
        <div className="download-icon-row">
          {TILES.map((t) => (
            <a key={t.id} className="download-icon-only" href={t.href} download={t.file} title={`${t.label}: ${t.hint}`}>
              <OsMark id={t.id} />
              <span className="sr-only">{t.label}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="panel download-panel flow-in">
      <div className="hero-kicker">Download</div>
      <h2 className="owner-name">Click your system icon</h2>
      <p className="muted">
        This is the Localmod React app. Files come from GitHub Releases. After the download finishes, click the
        Localmod icon — no Node.js, Git, or terminal.
      </p>
      <div className="download-grid">
        {TILES.map((t) => (
          <a key={t.id} className="download-tile" href={t.href} download={t.file}>
            <span className="download-os-icon">
              <OsMark id={t.id} />
            </span>
            <span className="download-os-name">{t.label}</span>
            <span className="muted tiny">{t.file}</span>
            <span className="muted tiny">{t.hint}</span>
          </a>
        ))}
      </div>
      <p className="muted tiny">
        If a file is missing, the GitHub release is still building.{" "}
        <a className="status-link" href={PRODUCT.releasesUrl} target="_blank" rel="noreferrer">
          Open Releases
        </a>
      </p>
    </div>
  );
}
