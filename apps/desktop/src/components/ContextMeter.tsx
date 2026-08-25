import { Tip } from "./ui";

export type ContextUsage = {
  messages?: number;
  messagesTokens?: number;
  voiceTokens?: number;
  voiceCount?: number;
  imageTokens?: number;
  imageCount?: number;
  pinnedCount?: number;
  totalTokens?: number;
  usedTokens?: number;
  budget?: number;
  reserve?: number;
  contextLength?: number;
  percent?: number;
  compacted?: number;
  remaining?: number;
  mode?: string;
};

type Props = {
  usage: ContextUsage | null | undefined;
  draft?: { text?: string; voice?: string; images?: number };
  contextLength?: number;
};

type Slice = { key: string; label: string; value: number; color: string };

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wedgePath(cx: number, cy: number, r: number, start: number, end: number) {
  const sweep = end - start;
  if (sweep <= 0.01) return "";
  if (sweep >= 359.9) {
    return `M ${cx} ${cy} m ${-r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  const large = sweep > 180 ? 1 : 0;
  const p0 = polar(cx, cy, r, start);
  const p1 = polar(cx, cy, r, end);
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

function PieChart({ slices, size = 88 }: { slices: Slice[]; size?: number }) {
  const total = Math.max(1, slices.reduce((n, s) => n + Math.max(0, s.value), 0));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const hole = size * 0.22;
  let angle = 0;
  const paths = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const sweep = (s.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...s, d: wedgePath(cx, cy, r, start, end) };
    });

  return (
    <svg className="ctx-pie" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {paths.map((p) => (
        <path key={p.key} d={p.d} fill={p.color} className="ctx-pie-slice" opacity={p.key === "free" ? 0.35 : 0.95}>
          <title>{`${p.label}: ${Math.round(p.value)}`}</title>
        </path>
      ))}
      <circle cx={cx} cy={cy} r={hole} className="ctx-pie-core" />
    </svg>
  );
}

export function ContextMeter({ usage, draft, contextLength }: Props) {
  const ctx = contextLength || usage?.contextLength || 4096;
  const used = usage?.usedTokens ?? usage?.totalTokens ?? 0;
  const pct = usage?.percent ?? Math.min(100, Math.round((used / Math.max(1, ctx)) * 100));
  const textTok = Math.max(0, (usage?.messagesTokens ?? 0) - (usage?.voiceTokens ?? 0) - (usage?.imageTokens ?? 0));
  const voiceTok = usage?.voiceTokens ?? Math.ceil(String(draft?.voice || "").length / 4);
  const imgTok = usage?.imageTokens ?? (draft?.images || 0) * 768;
  const free = Math.max(0, ctx - used);
  const msgs = usage?.messages ?? 0;
  const imgN = usage?.imageCount ?? draft?.images ?? 0;
  const compacted = usage?.compacted ?? 0;

  const slices: Slice[] = [
    { key: "text", label: "Messages", value: Math.max(textTok, msgs ? 1 : 0), color: "#4ecdc4" },
    { key: "voice", label: "Voice", value: voiceTok, color: "#ff9f43" },
    { key: "image", label: "Images", value: imgTok, color: "#f0c674" },
    { key: "free", label: "Free", value: free, color: "rgba(255,255,255,0.12)" },
  ];

  return (
    <div className="context-meter pie-style" title="Context budget — messages, voice, images">
      <div className="ctx-pie-layout">
        <div className="ctx-pie-wrap">
          <PieChart slices={slices} />
          <div className="ctx-pie-center">
            <strong>{pct}%</strong>
            <span>used</span>
          </div>
        </div>
        <div className="ctx-pie-meta">
          <div className="context-meter-top">
            <span className="ctx-label">
              Context mix <Tip text="Pie of message text, voice transcripts, images, and free window. Smart compact keeps long threads under n_ctx." />
            </span>
            <span className="mono tiny">
              {used.toLocaleString()} / {ctx.toLocaleString()}
            </span>
          </div>
          <ul className="ctx-legend">
            <li><i style={{ background: "#4ecdc4" }} /> Messages · {msgs}</li>
            <li><i style={{ background: "#ff9f43" }} /> Voice · ~{voiceTok.toLocaleString()} tok</li>
            <li><i style={{ background: "#f0c674" }} /> Images · {imgN} (~{imgTok.toLocaleString()})</li>
            <li><i style={{ background: "rgba(255,255,255,0.2)" }} /> Free · {free.toLocaleString()}</li>
          </ul>
          {compacted > 0 && <div className="tiny ok">{compacted} older turns compacted</div>}
        </div>
      </div>
    </div>
  );
}
