import { getSettings } from "./settings.js";
import { completeOnce } from "./chat.js";
import { getSkill } from "./skills.js";
import {
  playbook,
  DECISION_GUIDE,
  WHEN_BEST,
  WHEN_NOT,
  PIPELINE,
  DECISION_LOOP,
  ORCHESTRATION,
  ORCHESTRATION_SERVICES,
  CONTROLS,
  PITFALLS,
  PRO_TIPS,
  FEEDBACK_LOOP,
} from "./agentPlaybook.js";
import { memoryStatus, recall } from "./agentMemory.js";
import {
  orchestratorStatus,
  estimateTokens,
  budgetRemaining,
  appendMetric,
  fireWebhook,
  readMetrics,
  getCounters,
  testWebhook as pingWebhook,
} from "./agentOrchestrator.js";
import {
  toolCatalog,
  allowedToolNames,
  validateAction,
  pendingApprovals,
  listToolCatalog,
  listApprovals,
  resolveApproval as resolveToolApproval,
} from "./agentTools.js";
import { pendingPermissions, listMcp } from "./mcp.js";
import { inferenceStatus } from "./inference.js";
import { listCollections } from "./rag.js";

export function structuredActionSchema() {
  return {
    type: "object",
    required: ["thought", "action"],
    properties: {
      thought: { type: "string" },
      where: { type: "string" },
      loop: { type: "string", enum: ["observe", "reason", "choose", "execute", "verify"] },
      continue: { type: "boolean" },
      plan: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string", enum: ["todo", "doing", "done"] },
          },
        },
      },
      action: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", enum: allowedToolNames() },
          args: { type: "object" },
        },
      },
    },
  };
}

export function frameworkSystemPrompt() {
  const tools = allowedToolNames().join("|");
  return `You are Localmod's autonomous agent. Follow the decision loop every step:
1. observe — read vision cards, memory, workspace, last result
2. reason — say what that implies for the user goal
3. choose — pick exactly one schema-valid tool
4. execute — the runtime runs it (you only choose)
5. verify — next turn you will see the result; reflect and continue or finish

Orchestration the host already runs: Task Intake → Context Retrieval → Plan → Tool Calls → State Update → Guardrail Check → Response/Action → Logging & Evaluation.

Return JSON only:
{
  "thought": "what you understand now",
  "where": "loop stage / orchestration step",
  "loop": "observe|reason|choose|execute|verify",
  "plan": [{"id":"1","title":"...","status":"doing|todo|done"}],
  "continue": true,
  "action": { "name": "${tools}", "args": { } }
}

Rules:
- One action per step. Prefer list then read then retrieve before write.
- Never invent a tool name. Allowed: ${allowedToolNames().join(", ")}.
- Stay inside the workspace. Do not request credentials.
- If vision is missing, progress with the prompt, memory, and file listing.
- After at most the max steps, action.name must be finish.`;
}

export function defaultOrchestrationPlan(step = 1) {
  return ORCHESTRATION.map((row, i) => {
    const n = i + 1;
    let status = "todo";
    if (step > n) status = "done";
    else if (step === n) status = "doing";
    return { id: row.id, title: row.title, summary: row.summary, status };
  });
}

export const orchestrationPlan = defaultOrchestrationPlan;

export function markPlan(plan, id, status) {
  const rows = Array.isArray(plan) && plan.length ? plan : defaultOrchestrationPlan();
  const aliases = { retrieve: "context", respond: "response" };
  const want = aliases[id] || id;
  return rows.map((p) => (p.id === id || p.id === want ? { ...p, status } : p));
}

export function loopCount(log, action) {
  const fp = `${action?.name || ""}:${JSON.stringify(action?.args || {})}`;
  return (log || []).filter((e) => `${e.action?.name || ""}:${JSON.stringify(e.action?.args || {})}` === fp).length;
}

export function pipelineState(phase) {
  const book = playbook().pipeline;
  const order = ["goal", "planner", "memory", "tools", "executor", "critic", "response"];
  const idx = order.indexOf(phase);
  return book.map((p) => {
    const i = order.indexOf(p.id);
    let status = "todo";
    if (p.id === "users") status = "done";
    else if (idx < 0) status = "todo";
    else if (i < idx) status = "done";
    else if (i === idx) status = "doing";
    return { ...p, status };
  });
}

export function recommendAutonomy(input = {}) {
  const task = String(input.task || input.goal || "").trim();
  const deterministic = boolish(input.deterministic, /cron|batch|every|scheduled|repeat|pipeline|etl/i.test(task));
  const dynamicTools = boolish(input.dynamicTools, /search|browse|unknown|explore|investigate|research/i.test(task));
  const specialists = boolish(input.specialists, /multi-agent|specialist|team|architect|reviewer/i.test(task));
  const highRisk = boolish(input.highRisk, /delete|prod|payment|email everyone|irreversible|deploy/i.test(task));
  const simple = boolish(input.simple, task.length > 0 && task.length < 40 && !dynamicTools && !highRisk);
  const toolCoverage = input.toolCoverage !== false && input.poorTools !== true;
  const observability = input.observability !== false;
  const hitl = boolish(input.hitl, getSettings().agentHitlWrites !== false);

  const reasons = [];
  let recommendation = "autonomous";
  let label = "Use an autonomous agent";

  if (!task) {
    recommendation = "need-task";
    label = "Describe the task first";
    reasons.push("Decision guide needs a goal.");
  } else if (simple && !dynamicTools && !specialists) {
    recommendation = "skip";
    label = "Skip autonomy — use Chat";
    reasons.push("Low-value simple tasks are cheaper as a single Chat turn.");
  } else if (!toolCoverage) {
    recommendation = "skip";
    label = "Do not use — poor tool coverage";
    reasons.push("The tool bus cannot reach the system of record.");
  } else if (!observability) {
    recommendation = "skip";
    label = "Do not use — low observability";
    reasons.push("Do not run autonomy you cannot inspect or score.");
  } else if (highRisk && !hitl) {
    recommendation = "hitl";
    label = "Require human approval";
    reasons.push("High-risk irreversible work needs HITL before writes.");
  } else if (specialists) {
    recommendation = "multi-agent";
    label = "Use multi-agent";
    reasons.push("Several specialist roles — route via Skills (Architect, Critic, Craftsman).");
  } else if (deterministic && !dynamicTools) {
    recommendation = "workflow";
    label = "Use a workflow";
    reasons.push("Deterministic and repeatable — orchestration steps without a free tool loop.");
  } else if (dynamicTools) {
    recommendation = "autonomous";
    label = "Use an autonomous agent";
    reasons.push("Needs dynamic tool choice mid-run.");
  } else {
    recommendation = "autonomous";
    label = "Use an autonomous agent";
    reasons.push("Default: observe → reason → choose → execute → verify.");
  }

  if (highRisk) {
    reasons.push("Keep agentHitlWrites on.");
  }

  const path = DECISION_GUIDE.steps.map((s) => {
    let active = false;
    if (s.id === "deterministic") active = recommendation === "workflow";
    if (s.id === "dynamic") active = recommendation === "autonomous";
    if (s.id === "specialists") active = recommendation === "multi-agent";
    if (s.id === "risk") active = recommendation === "hitl" || highRisk;
    return { ...s, active };
  });

  return {
    recommendation,
    label,
    reasons,
    path,
    flags: { deterministic, dynamicTools, specialists, highRisk, simple, toolCoverage, observability, hitl },
    whenBest: WHEN_BEST,
    whenNot: WHEN_NOT,
    task,
  };
}

function boolish(v, fallback) {
  if (v === true || v === "true" || v === "yes" || v === "on") return true;
  if (v === false || v === "false" || v === "no" || v === "off") return false;
  return Boolean(fallback);
}

export async function criticVerify({ goal, thought, action, result, signal }) {
  const critic = getSkill("critic");
  const prompt = `Goal: ${String(goal || "").slice(0, 400)}
Thought: ${String(thought || "").slice(0, 400)}
Action: ${JSON.stringify(action || {}).slice(0, 400)}
Result: ${String(result || "").slice(0, 1200)}

Score this agent step. Return JSON only:
{"score":0-10,"pass":true|false,"continue":true|false,"risk":"low|medium|high","critique":"...","fix":"..."}`;
  try {
    const once = await completeOnce({
      vision: false,
      signal,
      messages: [
        { role: "system", content: (critic?.personality || "You are Critic.") + "\nBe terse. JSON only." },
        { role: "user", content: prompt },
      ],
    });
    const m = String(once.text || "").match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      const critique = j.critique || j.fix || "";
      const pass = j.pass !== false;
      const cont = j.continue !== false;
      return {
        score: Number(j.score ?? 6),
        pass,
        continue: cont,
        stop: !cont,
        reason: critique,
        risk: j.risk || "low",
        critique,
        source: "critic",
      };
    }
  } catch {
    /* LLM unavailable — heuristic */
  }
  return heuristicVerify({ action, result });
}

function heuristicVerify({ action, result }) {
  const text = String(result || "");
  const failed = /failed|error|denied|timed out|unknown tool|rate limited/i.test(text);
  const empty = !text.trim();
  const score = failed ? 3 : empty ? 5 : 7;
  const critique = failed ? text.slice(0, 240) : "Heuristic verify: step recorded.";
  const cont = !failed || action?.name !== "finish";
  return {
    score,
    pass: !failed,
    continue: cont,
    stop: !cont,
    reason: critique,
    risk: failed && action?.name === "write" ? "high" : failed ? "medium" : "low",
    critique,
    source: "heuristic",
  };
}

export function liveStatus() {
  const s = getSettings();
  const inf = inferenceStatus();
  return {
    settings: {
      agentHitlWrites: !!s.agentHitlWrites,
      agentMemoryTtlHours: s.agentMemoryTtlHours ?? 72,
      agentRatePerMin: s.agentRatePerMin ?? 20,
      agentWebhookUrl: s.agentWebhookUrl || "",
      agentCollectionId: s.agentCollectionId || "",
      agentAllowNetwork: !!s.agentAllowNetwork && !s.airplane,
      agentBudgetTokens: s.agentBudgetTokens ?? 8000,
      agentTimeoutMs: s.agentTimeoutMs ?? 15000,
      agentRetries: s.agentRetries ?? 2,
      agentCacheTtlSec: s.agentCacheTtlSec ?? 300,
      airplane: !!s.airplane,
    },
    inference: { running: inf.running, model: inf.modelMeta?.name || s.loadedModel || "" },
    memory: memoryStatus(),
    orchestrator: orchestratorStatus(),
    tools: toolCatalog(),
    pendingWrites: pendingApprovals(),
    mcpPending: pendingPermissions().map(({ resolve, reject, ...r }) => r),
    schema: structuredActionSchema(),
  };
}

export function getFramework(extra = {}) {
  return {
    playbook: playbook(),
    live: { ...liveStatus(), ...extra },
  };
}

export function loopFingerprintLog(log) {
  const counts = new Map();
  for (const e of log || []) {
    const fp = `${e.action?.name || ""}:${JSON.stringify(e.action?.args || {})}`;
    counts.set(fp, (counts.get(fp) || 0) + 1);
  }
  const repeats = [...counts.entries()].filter(([, n]) => n >= 3);
  return { looping: repeats.length > 0, repeats };
}

export function guardrailCheck({ run, action }) {
  const tokens = estimateTokens(run.transcript);
  const budget = budgetRemaining(tokens);
  const loop = loopFingerprintLog(run.log);
  const valid = validateAction(action);
  const blocks = [];
  if (budget.exceeded) blocks.push("token budget exceeded");
  if (loop.looping) blocks.push("repeated action loop detected");
  if (!valid.ok) blocks.push(valid.error);
  return {
    ok: blocks.length === 0,
    blocks,
    budget,
    loop,
    valid,
    tokens,
  };
}

export async function notifyRun(event, run) {
  appendMetric({
    kind: "run",
    event,
    runId: run.id,
    status: run.status,
    step: run.step,
    phase: run.phase,
  });
  if (event === "done" || event === "error") {
    await fireWebhook(event, {
      data: {
        runId: run.id,
        status: run.status,
        goal: run.goal,
        step: run.step,
      },
    });
  }
}

export function decideAutonomy(input = {}) {
  const rec = recommendAutonomy({
    ...input,
    specialists: input.specialists ?? input.multiSpecialist,
    highRisk: input.highRisk,
    dynamicTools: input.dynamicTools,
    deterministic: input.deterministic,
  });
  const choice =
    rec.recommendation === "skip" || rec.recommendation === "need-task"
      ? "chat"
      : rec.recommendation === "multi-agent"
        ? "multi-agent"
        : rec.recommendation === "workflow"
          ? "workflow"
          : rec.recommendation === "hitl"
            ? "agent"
            : "agent";
  return {
    ...rec,
    choice,
    humanApproval: rec.recommendation === "hitl" || !!rec.flags.highRisk,
    path: rec.path.map((s) => `${s.if} → ${s.label}`),
  };
}

export function frameworkSnapshot() {
  const s = getSettings();
  const live = liveStatus();
  const book = playbook();
  const metrics = getCounters();
  const catalog = listToolCatalog();
  const controlOn = {
    structured: true,
    retries: true,
    rate: true,
    hitl: !!s.agentHitlWrites,
    sandbox: true,
    memory: true,
    observe: true,
    evals: true,
    rollback: true,
    cache: true,
  };
  return {
    feedback: FEEDBACK_LOOP.title,
    pipeline: PIPELINE.map((p) => ({ id: p.id, title: p.title, blurb: p.summary })),
    loop: DECISION_LOOP.map((p) => ({ id: p.id, title: p.title, blurb: p.summary })),
    tools: catalog,
    orchestration: {
      steps: ORCHESTRATION.map((p) => ({ id: p.id, title: p.title, blurb: p.summary })),
      services: ORCHESTRATION_SERVICES.map((p) => ({ id: p.id, title: p.title, blurb: p.summary })),
    },
    controls: CONTROLS.map((c) => ({
      id: c.id,
      title: c.title,
      blurb: c.summary,
      on: controlOn[c.id] !== false,
    })),
    pitfalls: PITFALLS.map((p) => ({ id: p.id, pitfall: p.pitfall, fix: p.fix, enforce: p.enforce })),
    worksBest: WHEN_BEST.map((w) => ({ id: w.id, title: w.title, blurb: w.summary })),
    doNotUse: WHEN_NOT.map((w) => ({ id: w.id, title: w.title, blurb: w.summary })),
    tips: PRO_TIPS.map((t) => ({ id: t.id, title: t.title, blurb: t.body })),
    settings: {
      agentHitlWrites: !!s.agentHitlWrites,
      agentMemoryTtlHours: s.agentMemoryTtlHours ?? 72,
      agentRatePerMin: s.agentRatePerMin ?? 20,
      agentWebhookUrl: s.agentWebhookUrl || "",
      agentCollectionId: s.agentCollectionId || "",
      agentAllowNetwork: !!s.agentAllowNetwork,
      agentBudgetTokens: s.agentBudgetTokens ?? 8000,
      agentTimeoutMs: s.agentTimeoutMs ?? 15000,
      agentRetries: s.agentRetries ?? 2,
      agentCacheTtlSec: s.agentCacheTtlSec ?? 300,
      airplane: !!s.airplane,
    },
    health: {
      metrics,
      mcp: listMcp().length,
      collections: listCollections().length,
      memory: live.memory,
      orchestrator: live.orchestrator,
    },
    playbook: book,
    live,
    schema: structuredActionSchema(),
  };
}

export function resolveApproval(body) {
  return resolveToolApproval(body);
}

export async function testWebhook(url) {
  return pingWebhook(url);
}

export { playbook, recall, readMetrics, listApprovals };
