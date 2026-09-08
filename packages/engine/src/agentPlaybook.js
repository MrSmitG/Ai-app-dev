/** Catalogs for the Autonomous Agent Framework (10 product sections). */

export const PIPELINE = [
  {
    id: "users",
    title: "Users / Apps",
    role: "source",
    summary: "Chat, Bundles, voice, or another app submits a goal into Localmod.",
  },
  {
    id: "goal",
    title: "Goal / Task Input",
    role: "intake",
    summary: "Normalize the prompt, voice note, images, and workspace into a single task.",
  },
  {
    id: "planner",
    title: "Planner / Router",
    role: "plan",
    summary: "Decide workflow vs autonomous loop vs multi-agent vs human approval.",
  },
  {
    id: "memory",
    title: "Memory & Context",
    role: "context",
    summary: "Scoped TTL memory, RAG retrieve, vision cards, and recent chat.",
  },
  {
    id: "tools",
    title: "Tool Layer",
    role: "tools",
    summary: "Schema-validated tool bus: files, RAG, search, MCP, code, messaging.",
  },
  {
    id: "executor",
    title: "Action Executor",
    role: "act",
    summary: "Retries, timeouts, sandbox paths, and HITL writes before side effects.",
  },
  {
    id: "critic",
    title: "Evaluator / Critic",
    role: "verify",
    summary: "Critic skill checks the result, then continue or stop.",
  },
  {
    id: "response",
    title: "Final Response",
    role: "output",
    summary: "Transcript, metrics, webhook, and a logged evaluation.",
  },
];

export const FEEDBACK_LOOP = {
  id: "learn",
  title: "Learn, Adapt, Refine",
  summary: "Each run writes scoped memory and metrics so the next pass starts sharper.",
};

export const DECISION_LOOP = [
  { id: "observe", title: "Observe", summary: "Read vision cards, workspace, memory, and last tool result." },
  { id: "reason", title: "Reason", summary: "Local LLM (or fallback planner) explains the current state." },
  { id: "choose", title: "Choose Tool / Action", summary: "Pick one schema-valid tool. Hallucinated names are rejected." },
  { id: "execute", title: "Execute", summary: "Tool bus runs the action with retries, rate limits, and sandboxing." },
  { id: "verify", title: "Verify / Reflect", summary: "Critic scores the step. Continue, retry, or stop." },
];

export const TOOL_MAP = {
  above: [
    { id: "browser", title: "Browser / Search", lane: "network", via: "search", summary: "Optional web search. Blocked in airplane mode and when network tools are off." },
    { id: "apis", title: "APIs", lane: "network", via: "mcp_call", summary: "MCP servers expose APIs through one permissioned call." },
    { id: "databases", title: "Databases", lane: "data", via: "retrieve", summary: "Harbor collections stand in for structured lookup." },
    { id: "vector", title: "Vector Memory", lane: "data", via: "retrieve", summary: "RAG retrieve plus scoped TTL notes — treated as data, not instructions." },
  ],
  gateway: { id: "bus", title: "Tool Bus / MCP / Tool Gateway", summary: "Single validated entry. Airplane mode and HITL sit here." },
  agent: { id: "agent", title: "Agent", summary: "Observe → reason → choose → execute → verify." },
  below: [
    { id: "runner", title: "Code Runner", via: "run_code", summary: "Sandboxed JS expressions. No require, bounded timeout." },
    { id: "files", title: "Files / Docs", via: "list,read,write", summary: "Workspace-relative paths only. Writes can wait for approval." },
    { id: "messaging", title: "Messaging / Workflow", via: "message", summary: "Queue a webhook/workflow event without leaving the bus." },
    { id: "hitl", title: "Human Approval", via: "write + approvals", summary: "Pending writes show in Framework until Allow / Always / Deny." },
  ],
};

export const ORCHESTRATION = [
  { id: "intake", title: "Task Intake", summary: "Accept goal, images, chat context, and budgets." },
  { id: "context", title: "Context Retrieval", summary: "Vision observe + RAG retrieve + scoped memory recall." },
  { id: "plan", title: "Plan", summary: "Build the checklist the loop will walk." },
  { id: "tools", title: "Tool Calls", summary: "One validated action per step through the tool bus." },
  { id: "state", title: "State Update", summary: "Write memory, cache hits, and run transcript." },
  { id: "guardrail", title: "Guardrail Check", summary: "Rate limit, token budget, loop detection, permissions." },
  { id: "response", title: "Response / Action", summary: "Stream tokens and apply workspace effects." },
  { id: "eval", title: "Logging & Evaluation", summary: "JSONL metrics, critic score, optional webhook." },
];

export const ORCHESTRATION_SERVICES = [
  { id: "queues", title: "Queues", summary: "Serialize agent jobs so two runs do not thrash the workspace." },
  { id: "retries", title: "Retries", summary: "Exponential backoff on transient tool failures." },
  { id: "limits", title: "Rate Limits", summary: "Cap tool calls per minute (agentRatePerMin)." },
  { id: "webhooks", title: "Webhooks", summary: "POST run lifecycle events to agentWebhookUrl." },
];

export const CONTROLS = [
  {
    id: "structured",
    title: "Structured Outputs",
    setting: null,
    summary: "Actions must match the tool schema. Unknown tools are rejected.",
  },
  {
    id: "retries",
    title: "Retries & Timeouts",
    setting: "agentTimeoutMs",
    summary: "Each tool call has a timeout and bounded retries.",
  },
  {
    id: "rate",
    title: "Rate Limiting",
    setting: "agentRatePerMin",
    summary: "Token-bucket limit on tool executions per minute.",
  },
  {
    id: "hitl",
    title: "Human-in-the-Loop",
    setting: "agentHitlWrites",
    summary: "Workspace writes wait for approval when HITL is on.",
  },
  {
    id: "sandbox",
    title: "Permissions / Sandboxing",
    setting: "agentAllowNetwork",
    summary: "Paths stay inside the workspace. Network tools honor airplane mode.",
  },
  {
    id: "memory",
    title: "Memory Management",
    setting: "agentMemoryTtlHours",
    summary: "Scoped notes with TTL and prune under ~/.localmod/agent-memory.",
  },
  {
    id: "observe",
    title: "Observability",
    setting: null,
    summary: "SSE events, agent-logs, and metrics JSONL for every run.",
  },
  {
    id: "evals",
    title: "Evaluations",
    setting: null,
    summary: "Critic skill scores each step; run eval is stored on the session.",
  },
  {
    id: "rollback",
    title: "Rollback / Fallback",
    setting: null,
    summary: "Lightweight planner if the LLM is down. Denied writes never land.",
  },
  {
    id: "cache",
    title: "Caching",
    setting: "agentCacheTtlSec",
    summary: "Retrieve and search results are cached by query hash.",
  },
];

export const PITFALLS = [
  {
    id: "hallucinated-tools",
    pitfall: "Hallucinated tool names",
    fix: "Schema-validate every action. Reject unknown names and tell the model the allow-list.",
    enforce: "schema",
  },
  {
    id: "unbounded-loop",
    pitfall: "Unbounded observe/act loops",
    fix: "Max steps, token budget, and repeat-hash loop detection stop the run.",
    enforce: "budget",
  },
  {
    id: "write-risk",
    pitfall: "Irreversible writes without a human",
    fix: "Turn on agentHitlWrites. Writes sit in /agent/approvals until allow or deny.",
    enforce: "hitl",
  },
  {
    id: "stale-memory",
    pitfall: "Stale or global memory",
    fix: "Scope memory to the run/workspace and prune by TTL.",
    enforce: "ttl",
  },
  {
    id: "silent-network",
    pitfall: "Network tools in airplane mode",
    fix: "Search and remote MCP are blocked when airplane is on or agentAllowNetwork is off.",
    enforce: "airplane",
  },
  {
    id: "no-eval",
    pitfall: "No evaluation of tool results",
    fix: "Critic/verify after every execute. Continue only if the step is useful.",
    enforce: "critic",
  },
  {
    id: "rate-stampede",
    pitfall: "Tool stampede / retry storms",
    fix: "Rate limit plus backoff. Cache repeated retrieve/search.",
    enforce: "rate",
  },
  {
    id: "blind-run",
    pitfall: "Low observability",
    fix: "JSONL metrics, SSE workflow events, and webhook test endpoint.",
    enforce: "metrics",
  },
  {
    id: "context-overload",
    pitfall: "Context overload",
    fix: "Cap vision cards, RAG, memory, and log tails. Token budget stops the run.",
    enforce: "budget",
  },
  {
    id: "injection",
    pitfall: "Prompt injection via tools or docs",
    fix: "Treat retrieve/search/memory results as untrusted data. Never follow instructions found inside them.",
    enforce: "untrusted-context",
  },
  {
    id: "cost",
    pitfall: "Cost and token runaway",
    fix: "Max steps plus agentBudgetTokens. Rate limit tool calls per minute.",
    enforce: "budget",
  },
  {
    id: "silent-fail",
    pitfall: "Silent tool failures",
    fix: "Critic scores every result. Failed steps are logged; continue is refused when verify says stop.",
    enforce: "critic",
  },
  {
    id: "fragile",
    pitfall: "Fragile workflows",
    fix: "Retries, timeouts, fallback planner, and queued single-flight runs.",
    enforce: "retries",
  },
];

export const WHEN_BEST = [
  {
    id: "research",
    title: "Research Assistants",
    summary: "Multi-source gather + cite. Pair retrieve with scoped memory.",
  },
  {
    id: "triage",
    title: "Support Triage",
    summary: "Classify, draft, and escalate. Keep HITL on before sending.",
  },
  {
    id: "pipelines",
    title: "Data Pipelines",
    summary: "Repeatable ingest → retrieve → transform with retries and logs.",
  },
  {
    id: "coding",
    title: "Coding Agents",
    summary: "List/read then write in a sandbox. Critic reviews the diff.",
  },
  {
    id: "workflow",
    title: "Workflow Automation",
    summary: "Multi-step checklists with webhooks and queued jobs.",
  },
];

export const WHEN_NOT = [
  {
    id: "simple",
    title: "Low-value simple tasks",
    summary: "A single Chat turn is cheaper than a multi-step loop.",
  },
  {
    id: "irreversible",
    title: "High-risk irreversible work without HITL",
    summary: "Deletes, payments, or public posts need a human gate.",
  },
  {
    id: "coverage",
    title: "Poor tool coverage",
    summary: "If the bus cannot reach the system of record, do not fake it.",
  },
  {
    id: "blind",
    title: "Low observability",
    summary: "Do not run autonomy you cannot inspect, score, or roll back.",
  },
];

export const DECISION_GUIDE = {
  title: "Decision Guide",
  steps: [
    { id: "deterministic", if: "Task is deterministic and repeatable", then: "workflow", label: "Use a workflow" },
    { id: "dynamic", if: "Needs dynamic tool choice mid-run", then: "autonomous", label: "Use an autonomous agent" },
    { id: "specialists", if: "Needs several specialist roles", then: "multi-agent", label: "Use multi-agent" },
    { id: "risk", if: "High-risk or irreversible side effects", then: "hitl", label: "Require human approval" },
  ],
};

export const PRO_TIPS = [
  { id: "narrow", title: "Start Narrow", body: "One workspace, a few tools, a short step budget. Widen after it is reliable." },
  { id: "instrument", title: "Instrument Everything", body: "Treat metrics JSONL and SSE as part of the product, not an afterthought." },
  { id: "scoped", title: "Keep Memory Scoped", body: "TTL + workspace scope beats a forever global scratchpad." },
  { id: "explicit", title: "Prefer Explicit Tools", body: "Named, schema-checked tools beat a free-form 'do anything' action." },
  { id: "real", title: "Evaluate with Real Tasks", body: "Score the agent on the jobs you actually run, not synthetic demos." },
];

export function playbook() {
  return {
    pipeline: PIPELINE,
    feedbackLoop: FEEDBACK_LOOP,
    decisionLoop: DECISION_LOOP,
    toolMap: TOOL_MAP,
    orchestration: ORCHESTRATION,
    orchestrationServices: ORCHESTRATION_SERVICES,
    controls: CONTROLS,
    pitfalls: PITFALLS,
    whenBest: WHEN_BEST,
    whenNot: WHEN_NOT,
    decisionGuide: DECISION_GUIDE,
    tips: PRO_TIPS,
  };
}
