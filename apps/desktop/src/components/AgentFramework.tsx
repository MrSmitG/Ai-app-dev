import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Tip } from "./ui";

const GUIDE_DEFAULT = {
  task: "Research local docs then draft a summary",
  deterministic: false,
  dynamicTools: true,
  multiSpecialist: false,
  highRisk: false,
  simple: false,
  poorTools: false,
  observability: true,
};

export function AgentFramework({
  settings,
  patch,
  setTab,
  pane = "framework",
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
  setTab: (id: any) => void;
  pane?: "framework" | "guide";
}) {
  const [data, setData] = useState<any>(null);
  const [guide, setGuide] = useState(GUIDE_DEFAULT);
  const [verdict, setVerdict] = useState<any>(null);
  const [err, setErr] = useState("");
  const [pipeId, setPipeId] = useState("goal");
  const [loopId, setLoopId] = useState("observe");
  const [metrics, setMetrics] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [fw, met] = await Promise.all([
        api<any>("/agent/framework"),
        api<any>("/agent/metrics").catch(() => null),
      ]);
      setData(fw);
      setMetrics(met);
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

  const s = data.settings || settings || {};
  const health = data.health || {};
  const pending = data.tools?.live?.pendingApprovals || [];
  const pipe = (data.pipeline || []).find((p: any) => p.id === pipeId) || data.pipeline?.[0];
  const loopStep = (data.loop || []).find((p: any) => p.id === loopId) || data.loop?.[0];

  return (
    <div className="af-stack">
      {err && <div className="banner">{err}</div>}

      {pane === "framework" && (
        <>
          <div className="panel spotlight">
            <div className="hero-kicker">
              Autonomous Agent Framework{" "}
              <Tip text="Users/Apps feed a goal into planner, memory, tools, executor, and critic. The feedback loop is Learn, Adapt, Refine." />
            </div>
            <h2 className="owner-name">Users / Apps → Goal → Planner → Memory → Tools → Execute → Critic → Response</h2>
            <p className="muted">
              Feedback loop: <strong>{data.feedback}</strong>. Live runs {health.metrics?.live || 0} · steps {health.metrics?.steps || 0} ·
              critic fails {health.metrics?.criticFail || 0} · loops stopped {health.metrics?.loopsStopped || 0}
              {metrics?.rate ? ` · rate ${metrics.rate.used}/${metrics.rate.limit}` : ""}.
            </p>
            <div className="af-pipeline">
              {(data.pipeline || []).map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  className={`af-pipe ${pipeId === p.id ? "active" : ""}`}
                  onClick={() => setPipeId(p.id)}
                >
                  <div className="af-pipe-title">{p.title}</div>
                  <div className="muted tiny">{p.blurb}</div>
                </button>
              ))}
            </div>
            {pipe && <p className="muted pad-sm"><strong>{pipe.title}.</strong> {pipe.blurb}</p>}
            <div className="muted tiny">Then Learn, Adapt, Refine — scoped memory and metrics JSONL feed the next run.</div>
          </div>

          <div className="panel">
            <div className="section-label">Decision loop</div>
            <div className="workflow-list">
              {(data.loop || []).map((step: any) => (
                <button
                  key={step.id}
                  type="button"
                  className={`workflow-step ${loopId === step.id ? "doing" : "todo"}`}
                  onClick={() => setLoopId(step.id)}
                >
                  <span className="workflow-dot" />
                  <div>
                    <div>{step.title}</div>
                    <div className="muted tiny">{step.blurb}</div>
                  </div>
                </button>
              ))}
            </div>
            {loopStep && (
              <p className="muted tiny">
                {loopStep.title}: {loopStep.blurb} After Verify/Reflect the agent continues or stops (budgets, loop guard, finish).
              </p>
            )}
          </div>

          <div className="panel">
            <div className="section-label">Tool integration map</div>
            <div className="af-grid4">
              {(data.tools?.inputs || []).map((t: any) => (
                <div key={t.id} className="af-card">
                  <div className="af-pipe-title">{t.title}</div>
                  <div className="muted tiny">{t.blurb}</div>
                </div>
              ))}
            </div>
            <div className="af-gateway">{data.tools?.gateway?.title} — {data.tools?.gateway?.blurb}</div>
            <div className="muted tiny pad-sm" style={{ textAlign: "center" }}>↓ Agent (observe → reason → choose → execute → verify) ↓</div>
            <div className="af-grid4">
              {(data.tools?.below || []).map((t: any) => (
                <div key={t.id} className="af-card">
                  <div className="af-pipe-title">{t.title}</div>
                  <div className="muted tiny">{t.blurb}</div>
                </div>
              ))}
            </div>
            <div className="muted tiny pad-sm">
              Registered tools: {(data.tools?.live?.tools || data.tools?.tools || []).map((t: any) => t.name).join(", ") || "—"} · MCP {health.mcp} ·
              Harbor collections {health.collections}
            </div>
            {!!pending.length && (
              <div className="stack">
                <div className="section-label">Human approval</div>
                {pending.map((p: any) => (
                  <div key={p.id} className="row wrap">
                    <span className="mono tiny">{p.tool || p.name} {p.preview || p.args?.path}</span>
                    <button className="btn primary" type="button" onClick={() => approve(p.id, "allow")}>Allow</button>
                    <button className="btn" type="button" onClick={() => approve(p.id, "always")}>Always</button>
                    <button className="btn" type="button" onClick={() => approve(p.id, "deny")}>Deny</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="section-label">Workflow orchestration</div>
            <div className="workflow-list">
              {(data.orchestration?.steps || []).map((st: any) => (
                <div key={st.id} className="workflow-step todo">
                  <span className="workflow-dot" />
                  <div>
                    <div>{st.title}</div>
                    <div className="muted tiny">{st.blurb}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="af-grid4">
              {(data.orchestration?.services || []).map((sv: any) => (
                <div key={sv.id} className="af-card">
                  <div className="af-pipe-title">{sv.title}</div>
                  <div className="muted tiny">{sv.blurb}</div>
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
                <input type="number" min={4} max={120} value={s.agentRatePerMin ?? 20} onChange={(e) => patch({ agentRatePerMin: Number(e.target.value) || 20 }).then(load)} />
              </label>
              <label>
                Token budget
                <input type="number" min={256} max={200000} value={s.agentBudgetTokens ?? 8000} onChange={(e) => patch({ agentBudgetTokens: Number(e.target.value) || 8000 }).then(load)} />
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
              {(data.controls || []).map((c: any) => (
                <div key={c.id} className={`af-card ${c.on ? "on" : ""}`}>
                  <div className="af-pipe-title">{c.title}</div>
                  <div className="muted tiny">{c.blurb}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="section-label">Common pitfalls</div>
            <table className="af-table">
              <thead>
                <tr><th>Pitfall</th><th>Fix (enforced in the loop)</th></tr>
              </thead>
              <tbody>
                {(data.pitfalls || []).map((r: any) => (
                  <tr key={r.id}><td>{r.pitfall}</td><td>{r.fix}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pane === "guide" && (
        <>
          <div className="forge-split">
            <div className="panel">
              <div className="section-label">When autonomy works best</div>
              {(data.worksBest || []).map((w: any) => (
                <div key={w.id} className="event-row">
                  <span className="event-type">{w.title}</span>
                  <span className="muted">{w.blurb}</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="section-label">When not to use</div>
              {(data.doNotUse || []).map((w: any) => (
                <div key={w.id} className="event-row">
                  <span className="event-type">{w.title}</span>
                  <span className="muted">{w.blurb}</span>
                </div>
              ))}
            </div>
          </div>

      <div className="panel" id="af-guide" style={pane === "guide" ? { outline: "1px solid rgba(255,159,67,0.45)" } : undefined}>
            <p className="muted">Deterministic → workflow. Dynamic tools → autonomous agent. Specialists → multi-agent. High risk → human approval.</p>
            <form className="stack" onSubmit={runGuide}>
              <label>
                Task
                <input value={guide.task} onChange={(e) => setGuide({ ...guide, task: e.target.value })} placeholder="What should the agent do?" />
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
                <input type="checkbox" checked={guide.multiSpecialist} onChange={(e) => setGuide({ ...guide, multiSpecialist: e.target.checked })} />
                Need multiple specialists?
              </label>
              <label className="row check">
                <input type="checkbox" checked={guide.highRisk} onChange={(e) => setGuide({ ...guide, highRisk: e.target.checked })} />
                High risk or irreversible side effects?
              </label>
              <label className="row check">
                <input type="checkbox" checked={guide.simple} onChange={(e) => setGuide({ ...guide, simple: e.target.checked })} />
                Low-value simple task?
              </label>
              <label className="row check">
                <input type="checkbox" checked={!guide.observability} onChange={(e) => setGuide({ ...guide, observability: !e.target.checked })} />
                Low observability?
              </label>
              <label className="row check">
                <input type="checkbox" checked={guide.poorTools} onChange={(e) => setGuide({ ...guide, poorTools: e.target.checked })} />
                Poor tool coverage?
              </label>
              <button className="btn primary" type="submit">Recommend</button>
            </form>
            {verdict && (
              <div className="banner">
                <strong>{verdict.label}</strong>
                {verdict.humanApproval ? " · add Human Approval" : ""}
                <div className="muted tiny">{(verdict.reasons || []).join(" ")}</div>
                <div className="af-pipeline pad-sm">
                  {(verdict.path || []).map((step: any, i: number) => (
                    <div key={i} className={`af-pipe ${step.active ? "active" : ""}`}>
                      <div className="af-pipe-title">{typeof step === "string" ? step : step.label}</div>
                      <div className="muted tiny">{typeof step === "string" ? "" : step.if}</div>
                    </div>
                  ))}
                </div>
                <div className="row wrap pad-sm">
                  {(verdict.choice === "agent" || verdict.choice === "workflow") && (
                    <button className="btn" type="button" onClick={() => setTab("forge")}>Open Run</button>
                  )}
                  {verdict.choice === "chat" && <button className="btn" type="button" onClick={() => setTab("chat")}>Open Chat</button>}
                  {verdict.choice === "multi-agent" && <button className="btn" type="button" onClick={() => setTab("skills")}>Open Skills</button>}
                  {verdict.humanApproval && (
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
            {(data.tips || []).map((t: any) => (
              <div key={t.id} className="event-row">
                <span className="event-type">{t.title}</span>
                <span className="muted">{t.blurb}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
