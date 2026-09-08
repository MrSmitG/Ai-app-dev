import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Tip } from "./ui";

const GUIDE_DEFAULT = {
  deterministic: false,
  dynamicTools: true,
  specialists: false,
  highRisk: false,
  task: "Explore the workspace, retrieve docs if any, and summarize next steps.",
};

export function AgentFramework({
  patch,
  setTab,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
  setTab: (id: any) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [guide, setGuide] = useState(GUIDE_DEFAULT);
  const [verdict, setVerdict] = useState<any>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<any>("/agent/framework"));
      setErr("");
    } catch (e: any) {
      setErr(e.message || "Could not load framework");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function runGuide(e?: React.FormEvent) {
    e?.preventDefault();
    setVerdict(await api<any>("/agent/decide", { method: "POST", body: JSON.stringify(guide) }));
  }

  async function approve(id: string, decision: string) {
    await api("/agent/approvals", { method: "POST", body: JSON.stringify({ id, decision }) });
    load();
  }

  async function pingHook() {
    const r = await api<any>("/agent/webhook-test", { method: "POST", body: "{}" });
    setErr(r.skipped ? "Set a webhook URL first." : r.ok ? `Webhook ${r.status}` : r.error || "Webhook failed");
    load();
  }

  if (!data) {
    return <div className="panel muted">{err || "Loading autonomous agent framework…"}</div>;
  }

  const book = data.playbook || {};
  const live = data.live || {};
  const s = live.settings || {};
  const pending = live.pendingWrites || [];
  const tools = live.tools || {};

  return (
    <div className="af-stack">
      {err && <div className="banner">{err}</div>}

      <div className="panel spotlight">
        <div className="hero-kicker">
          Autonomous Agent Framework <Tip text="Users/Apps feed a goal into planner, memory, tools, executor, and critic. Feedback loop: Learn, Adapt, Refine." />
        </div>
        <h2 className="owner-name">Users / Apps → Goal → Planner → Memory → Tools → Executor → Critic → Response</h2>
        <p className="muted">
          Feedback loop: <strong>{book.feedbackLoop?.title || "Learn, Adapt, Refine"}</strong>.{" "}
          {book.feedbackLoop?.summary} Queue {live.orchestrator?.queue?.depth ?? 0} · rate {live.orchestrator?.rate?.used ?? 0}/
          {live.orchestrator?.rate?.limit ?? 0} · cache {live.orchestrator?.cache?.entries ?? 0}.
        </p>
        <div className="af-pipeline">
          {(book.pipeline || []).map((p: any) => (
            <div key={p.id} className="af-pipe">
              <div className="af-pipe-title">{p.title}</div>
              <div className="muted tiny">{p.summary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Decision loop</div>
        <div className="workflow-list">
          {(book.decisionLoop || []).map((st: any) => (
            <div key={st.id} className="workflow-step doing">
              <span className="workflow-dot" />
              <div>
                <div>{st.title}</div>
                <div className="muted tiny">{st.summary}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Tool integration map</div>
        <div className="af-grid4">
          {(book.toolMap?.above || []).map((t: any) => (
            <div key={t.id} className="af-card">
              <div className="af-pipe-title">{t.title}</div>
              <div className="muted tiny">via {t.via}</div>
            </div>
          ))}
        </div>
        <div className="af-gateway">
          {book.toolMap?.gateway?.title} — {book.toolMap?.gateway?.summary}
        </div>
        <div className="af-grid4">
          {(book.toolMap?.below || []).map((t: any) => (
            <div key={t.id} className="af-card">
              <div className="af-pipe-title">{t.title}</div>
              <div className="muted tiny">via {t.via}</div>
            </div>
          ))}
        </div>
        <div className="muted tiny pad-sm">
          Registered: {(tools.tools || []).map((t: any) => t.name).join(", ") || "—"} · airplane {tools.airplane ? "on" : "off"}
        </div>
        {!!pending.length && (
          <div className="stack">
            <div className="section-label">Human approval (writes)</div>
            {pending.map((p: any) => (
              <div key={p.id} className="row wrap">
                <span className="mono tiny">{p.tool} {JSON.stringify(p.args || {}).slice(0, 80)}</span>
                <button className="btn primary" type="button" onClick={() => approve(p.id, "allow")}>Allow</button>
                <button className="btn" type="button" onClick={() => approve(p.id, "deny")}>Deny</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="section-label">Workflow orchestration</div>
        <div className="workflow-list">
          {(book.orchestration || []).map((st: any) => (
            <div key={st.id} className="workflow-step todo">
              <span className="workflow-dot" />
              <div>
                <div>{st.title}</div>
                <div className="muted tiny">{st.summary}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="af-grid4">
          {(book.orchestrationServices || []).map((sv: any) => (
            <div key={sv.id} className="af-card">
              <div className="af-pipe-title">{sv.title}</div>
              <div className="muted tiny">{sv.summary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Production design controls</div>
        <div className="form-grid two-col">
          <label className="row check">
            <input type="checkbox" checked={!!s.agentHitlWrites} onChange={(e) => patch({ agentHitlWrites: e.target.checked }).then(load)} />
            Human-in-the-loop on writes
          </label>
          <label className="row check">
            <input type="checkbox" checked={!!s.agentAllowNetwork} onChange={(e) => patch({ agentAllowNetwork: e.target.checked }).then(load)} />
            Allow search (off in airplane)
          </label>
          <label>
            Memory TTL (hours)
            <input type="number" min={1} max={720} value={s.agentMemoryTtlHours ?? 72} onChange={(e) => patch({ agentMemoryTtlHours: Number(e.target.value) || 72 }).then(load)} />
          </label>
          <label>
            Rate / minute
            <input type="number" min={4} max={120} value={s.agentRatePerMin ?? 30} onChange={(e) => patch({ agentRatePerMin: Number(e.target.value) || 30 }).then(load)} />
          </label>
          <label>
            Harbor collection id
            <input value={s.agentCollectionId || ""} onChange={(e) => patch({ agentCollectionId: e.target.value })} placeholder="from Data tab" />
          </label>
          <label>
            Webhook URL
            <div className="row">
              <input className="grow" value={s.agentWebhookUrl || ""} onChange={(e) => patch({ agentWebhookUrl: e.target.value })} placeholder="https://…" />
              <button className="btn" type="button" onClick={pingHook}>Test</button>
            </div>
          </label>
        </div>
        <div className="af-grid4 pad-sm">
          {(book.controls || []).map((c: any) => (
            <div key={c.id} className="af-card on">
              <div className="af-pipe-title">{c.title}</div>
              <div className="muted tiny">{c.summary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Common pitfalls</div>
        <table className="af-table">
          <thead>
            <tr><th>Pitfall</th><th>Fix</th></tr>
          </thead>
          <tbody>
            {(book.pitfalls || []).map((r: any) => (
              <tr key={r.id}><td>{r.pitfall}</td><td>{r.fix}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="forge-split">
        <div className="panel">
          <div className="section-label">When autonomy works best</div>
          {(book.whenBest || []).map((w: any) => (
            <div key={w.id} className="event-row">
              <span className="event-type">{w.title}</span>
              <span className="muted">{w.summary}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="section-label">When not to use</div>
          {(book.whenNot || []).map((w: any) => (
            <div key={w.id} className="event-row">
              <span className="event-type">{w.title}</span>
              <span className="muted">{w.summary}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Decision guide</div>
        <form className="stack" onSubmit={runGuide}>
          <label>
            Task
            <input value={guide.task} onChange={(e) => setGuide({ ...guide, task: e.target.value })} />
          </label>
          <label className="row check">
            <input type="checkbox" checked={guide.deterministic} onChange={(e) => setGuide({ ...guide, deterministic: e.target.checked })} />
            Need deterministic repeatability?
          </label>
          <label className="row check">
            <input type="checkbox" checked={guide.dynamicTools} onChange={(e) => setGuide({ ...guide, dynamicTools: e.target.checked })} />
            Need dynamic tool choice and multi-step reasoning?
          </label>
          <label className="row check">
            <input type="checkbox" checked={guide.specialists} onChange={(e) => setGuide({ ...guide, specialists: e.target.checked })} />
            Need multiple specialists?
          </label>
          <label className="row check">
            <input type="checkbox" checked={guide.highRisk} onChange={(e) => setGuide({ ...guide, highRisk: e.target.checked })} />
            High risk or external side effects?
          </label>
          <button className="btn primary" type="submit">Recommend</button>
        </form>
        {verdict && (
          <div className="banner">
            <strong>{verdict.label}</strong>
            <div className="muted tiny">{(verdict.reasons || []).join(" ")}</div>
            <div className="row wrap pad-sm">
              {verdict.recommendation === "autonomous" && <button className="btn" type="button" onClick={() => setTab("forge")}>Open Run</button>}
              {verdict.recommendation === "skip" && <button className="btn" type="button" onClick={() => setTab("chat")}>Open Chat</button>}
              {verdict.recommendation === "multi-agent" && <button className="btn" type="button" onClick={() => setTab("skills")}>Open Skills</button>}
              {(verdict.recommendation === "hitl" || verdict.flags?.highRisk) && (
                <button className="btn" type="button" onClick={() => patch({ agentHitlWrites: true }).then(load)}>
                  Enable write approval
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="section-label">Pro tips</div>
        {(book.tips || []).map((t: any) => (
          <div key={t.id} className="event-row">
            <span className="event-type">{t.title}</span>
            <span className="muted">{t.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
