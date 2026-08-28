import { useMemo, useState } from "react";
import { api } from "../api";
import { Tip, bytes } from "./ui";

const FILTERS = [
  ["all", "All"],
  ["chat", "Chat"],
  ["voice", "Voice"],
  ["data", "Data"],
  ["agent", "Agent"],
  ["privacy", "Privacy"],
  ["tools", "Tools"],
] as const;

export type BundleRow = {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
  category: string;
  exclusiveGroup?: string | null;
  ramHintGb: number;
  download?: { repo: string; file: string; sizeBytes: number } | null;
  selected: boolean;
  recommended: boolean;
  fit?: { fits?: boolean; note?: string; sizeMb?: number; needRamMb?: number };
  localModel?: { path: string; name: string; quant?: string } | null;
  downloadStatus?: { id: string; status: string; received?: number; total?: number } | null;
  skillId?: string | null;
};

export function BundlesPanel({
  bundles,
  onRefresh,
  setError,
  setTab,
}: {
  bundles: BundleRow[];
  onRefresh: () => void;
  setError: (s: string) => void;
  setTab: (id: any) => void;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const selected = bundles.filter((b) => b.selected);
  const shown = useMemo(
    () => (filter === "all" ? bundles : bundles.filter((b) => b.category === filter)),
    [bundles, filter]
  );

  async function useIt(id: string) {
    setBusyId(id);
    try {
      const r = await api<any>("/bundles/use", { method: "POST", body: JSON.stringify({ id }) });
      if (r.download?.error) setError(r.download.error);
      else if (r.airplaneBlockedDownload) setError("Airplane mode is on — bundle settings applied, model download skipped.");
      onRefresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function stopIt(id: string) {
    setBusyId(id);
    try {
      await api("/bundles/stop", { method: "POST", body: JSON.stringify({ id }) });
      onRefresh();
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="view flow-in">
      <div className="hero-banner">
        <div>
          <div className="hero-kicker">
            Bundles <Tip text="Turn on a pack to apply its settings. Chat-model bundles replace each other. Feature packs can stack." />
          </div>
          <h2>Select bundles to use</h2>
          <p className="muted">
            One-click setups for Chat, voice, documents, agent, and privacy. Recommended packs match this machine&apos;s RAM.
          </p>
        </div>
        {!!selected.length && (
          <div className="active-chip">{selected.length} in use</div>
        )}
      </div>

      {!!selected.length && (
        <div className="bundle-using">
          <span className="section-label">In use</span>
          <div className="chips">
            {selected.map((b) => (
              <button key={b.id} className="chip on" onClick={() => stopIt(b.id)} title="Stop using">
                {b.name} ×
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="seg">
        {FILTERS.map(([id, label]) => (
          <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="cards two">
        {shown.map((b) => {
          const pct = b.downloadStatus?.total
            ? Math.round((100 * (b.downloadStatus.received || 0)) / b.downloadStatus.total)
            : 0;
          const downloading = b.downloadStatus && b.downloadStatus.status === "running";
          return (
            <article key={b.id} className={`panel bundle-card ${b.selected ? "in-use" : ""} ${b.recommended ? "recommended" : ""}`}>
              <div className="bundle-card-top">
                <div>
                  <div className="panel-title">{b.name}</div>
                  <div className="muted">{b.tagline}</div>
                </div>
                <div className="bundle-flags">
                  {b.recommended && <span className="tone-pill ok-pill">Fits this PC</span>}
                  {b.selected && <span className="tone-pill">In use</span>}
                </div>
              </div>
              <p className="bundle-blurb">{b.blurb}</p>
              <div className="muted tiny">
                {b.ramHintGb ? `Needs ~${b.ramHintGb} GB RAM` : "No extra RAM"}
                {b.download ? ` · ${b.download.file}` : ""}
                {b.fit?.needRamMb ? ` · est. ${b.fit.needRamMb} MB` : ""}
              </div>
              {b.localModel && <div className="muted tiny ok-text">On disk: {b.localModel.name}</div>}
              {b.fit && !b.fit.fits && b.download && (
                <div className="muted tiny warn-text">May not fit this machine — {b.fit.note}</div>
              )}
              {downloading && (
                <div>
                  <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                  <div className="muted tiny">{b.downloadStatus?.status} · {bytes(b.downloadStatus?.received || 0)}</div>
                </div>
              )}
              <div className="row">
                {b.selected ? (
                  <button className="btn" disabled={busyId === b.id} onClick={() => stopIt(b.id)}>Stop using</button>
                ) : (
                  <button className="btn primary" disabled={busyId === b.id} onClick={() => useIt(b.id)}>
                    {busyId === b.id ? "Applying…" : downloading ? "Downloading…" : "Use bundle"}
                  </button>
                )}
                {b.category === "chat" && (
                  <button className="btn ghost" onClick={() => setTab("models")}>Models</button>
                )}
                {b.category === "data" && (
                  <button className="btn ghost" onClick={() => setTab("harbor")}>Data</button>
                )}
                {b.category === "agent" && (
                  <button className="btn ghost" onClick={() => setTab("forge")}>Agent</button>
                )}
                {b.category === "voice" && (
                  <button className="btn ghost" onClick={() => setTab("settings")}>Voice options</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!shown.length && <div className="muted pad">No bundles in this filter.</div>}
    </section>
  );
}

