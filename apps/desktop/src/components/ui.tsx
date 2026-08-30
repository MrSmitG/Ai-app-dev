import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Icon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "chat":
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "llm":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 12h5M8 15h6" />
        </svg>
      );
    case "forge":
      return (
        <svg {...common}>
          <path d="M14 4h6v6" />
          <path d="m20 4-9 9" />
          <path d="M10 7H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
        </svg>
      );
    case "skills":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c1.5-3.5 4-5 8-5s6.5 1.5 8 5" />
        </svg>
      );
    case "harbor":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M12 11v5M9 14h6" />
        </svg>
      );
    case "tools":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "models":
      return (
        <svg {...common}>
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
          <path d="M12 22V12" />
          <path d="m3 7 9 5 9-5" />
        </svg>
      );
    case "about":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6M12 7h.01" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "stop":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M19 11a7 7 0 0 1-14 0M12 18v3" />
        </svg>
      );
    case "info":
      return (
        <svg {...common} width={14} height={14}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6M12 7h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/** Hover info tip — fixed overlay above the icon so text is never clipped. */
export function Tip({ text, label }: { text: string; label?: string }) {
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 280, above: true });

  function place() {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(300, Math.max(220, window.innerWidth - 24));
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const above = r.top >= 88;
    const top = above ? r.top - 12 : r.bottom + 12;
    setBox({ top, left, width, above });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, text]);

  return (
    <span
      ref={anchor}
      className={`tip ${open ? "open" : ""}`}
      tabIndex={0}
      aria-label={label || text}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => {
        place();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => {
        place();
        setOpen(true);
      }}
      onBlur={() => setOpen(false)}
    >
      <Icon name="info" />
      {open &&
        createPortal(
          <span
            id={id}
            className={`tip-bubble tip-portal ${box.above ? "above" : "below"}`}
            role="tooltip"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
            }}
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}

export function LabelWithTip({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <span className="label-with-tip">
      {children}
      <Tip text={tip} />
    </span>
  );
}

export function bytes(n?: number) {
  const v = n || 0;
  if (v > 1e9) return (v / 1e9).toFixed(2) + " GB";
  if (v > 1e6) return (v / 1e6).toFixed(1) + " MB";
  return v + " B";
}

export function LocationBar({
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
    <div className="panel location-panel flow-in">
      <div className="panel-head">
        <div>
          <div className="panel-title">
            <LabelWithTip tip="Folder where downloaded GGUF model files are saved on this PC.">Model download folder</LabelWithTip>
          </div>
          <div className="muted">Browse or paste a path such as D:\models</div>
        </div>
      </div>
      <div className="row">
        <input className="grow" value={folderDraft} onChange={(e) => onDraft(e.target.value)} placeholder="D:\models" />
        <button className="btn" onClick={onBrowse}>
          <Icon name="folder" /> Browse
        </button>
        <button className="btn primary" onClick={onSave}>
          Save
        </button>
      </div>
      <div className="mono muted">Using: {libraryDir || folderDraft || "default ~/.localmod/models"}</div>
    </div>
  );
}
