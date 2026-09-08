import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, readJson, writeJson } from "./paths.js";
import { getSettings } from "./settings.js";
import { completeOnce } from "./chat.js";
import { ollamaTags, ollamaChat } from "./ollama.js";
import { inferenceStatus } from "./inference.js";
import { skillSystemPrompt } from "./skills.js";
import { executeTool, sandboxRoot, validateAction, allowedToolNames, actionFingerprint } from "./agentTools.js";
import { remember, recall } from "./agentMemory.js";
import { withRetry, appendMetric, markLive, markDone, bumpMetric } from "./agentOrchestrator.js";
import {
  criticVerify,
  defaultOrchestrationPlan,
  frameworkSystemPrompt,
  guardrailCheck,
  notifyRun,
} from "./agentFramework.js";

const VISION_HINTS = ["moondream", "llava", "bakllava", "minicpm-v", "minicpm_v", "qwen2-vl", "qwen2vl", "vision", "vl-"];
/** In-memory runs so cancel hits the live loop, not a stale disk copy. */
const liveRuns = new Map();

export function agentLogsDir() {
  const dir = path.join(dataDir(), "agent-logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function indexPath() {
  return path.join(agentLogsDir(), "index.json");
}

export function listLocalAgentRuns() {
  return readJson(indexPath(), []).slice(0, 80);
}

function saveIndex(rows) {
  writeJson(indexPath(), rows.slice(0, 80));
}

function runPath(id) {
  return path.join(agentLogsDir(), `${id}.json`);
}

export function getLocalAgentRun(id) {
  if (!id) return null;
  const run = readJson(runPath(id), null);
  return run ? publicLocalRun(run) : null;
}

function persistRun(run) {
  writeJson(runPath(run.id), run);
  const idx = listLocalAgentRuns().filter((r) => r.id !== run.id);
  idx.unshift({
    id: run.id,
    prompt: run.goal,
    status: run.status,
    model: run.llmModel,
    runtime: "local-vision",
    cwd: run.cwd,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    step: run.step,
    phase: run.phase,
    plan: run.plan,
    vision: run.vision,
    text: run.transcript,
    events: run.log.slice(-40).map((e) => ({
      type: e.phase,
      name: e.action?.name || e.phase,
      preview: (e.thought || e.result || "").slice(0, 180),
      ts: e.t,
    })),
  });
  saveIndex(idx);
}

function imageMeta(img) {
  const dataUrl = img?.dataUrl || img?.url || "";
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
  const mime = img?.mime || dataUrl.match(/^data:([^;]+)/)?.[1] || "image/png";
  const bytes = b64 ? Math.round((b64.length * 3) / 4) : 0;
  let kind = mime.includes("png") ? "png" : mime.includes("jpeg") || mime.includes("jpg") ? "jpeg" : mime;
  return {
    name: img?.name || "image",
    mime,
    kind,
    bytes,
    approxKb: Math.round(bytes / 1024),
  };
}

async function pickVisionModel() {
  const s = getSettings();
  const preferred = String(s.localAgentVisionModel || "").trim();
  try {
    const tags = await ollamaTags();
    const names = tags.map((t) => t.name);
    if (preferred && names.some((n) => n === preferred || n.startsWith(`${preferred}:`))) {
      return { provider: "ollama", model: names.find((n) => n === preferred || n.startsWith(`${preferred}:`)) };
    }
    const hit = names.find((n) => VISION_HINTS.some((h) => n.toLowerCase().includes(h)));
    if (hit) return { provider: "ollama", model: hit };
  } catch {
    /* ollama down */
  }
  const inf = inferenceStatus();
  if (inf.running) {
    return { provider: "llama", model: inf.modelMeta?.name || s.loadedModel || "local" };
  }
  return { provider: "none", model: "" };
}

async function describeWithOllama(model, img, goal) {
  const dataUrl = img.dataUrl || img.url || "";
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const res = await ollamaChat({
    model,
    stream: false,
    messages: [
      {
        role: "user",
        content:
          "You are a lightweight computer-vision observer. Describe this image for another LLM that cannot see pixels. Return JSON only with keys: scene, visible_text (array), ui_elements (array), objects (array), layout, task_cues. Be concrete. User goal: " +
          String(goal || "").slice(0, 400),
        images: [b64],
      },
    ],
    params: { temperature: 0.2, maxTokens: 400, contextLength: 2048 },
  });
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed.message?.content || raw;
  } catch {
    return raw;
  }
}

async function describeWithLlama(img, goal) {
  const dataUrl = img.dataUrl || img.url || "";
  const result = await completeOnce({
    vision: true,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "You are a lightweight computer-vision observer. Describe this image for another LLM that cannot see pixels. Return JSON only with keys: scene, visible_text, ui_elements, objects, layout, task_cues. User goal: " +
              String(goal || "").slice(0, 400),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return result.text;
}

function parseObservation(raw, meta) {
  let parsed = null;
  const m = String(raw || "").match(/\{[\s\S]*\}/);
  if (m) {
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      parsed = null;
    }
  }
  const scene = parsed?.scene || String(raw || "").slice(0, 600) || "No vision caption available.";
  return {
    name: meta.name,
    mime: meta.mime,
    bytes: meta.bytes,
    scene,
    visible_text: parsed?.visible_text || [],
    ui_elements: parsed?.ui_elements || [],
    objects: parsed?.objects || [],
    layout: parsed?.layout || "",
    task_cues: parsed?.task_cues || "",
    llm_card: [
      `IMAGE ${meta.name} (${meta.kind}, ~${meta.approxKb} KB)`,
      `Scene: ${scene}`,
      parsed?.visible_text?.length ? `Visible text: ${[].concat(parsed.visible_text).join(" | ")}` : "",
      parsed?.ui_elements?.length ? `UI: ${[].concat(parsed.ui_elements).join(", ")}` : "",
      parsed?.objects?.length ? `Objects: ${[].concat(parsed.objects).join(", ")}` : "",
      parsed?.layout ? `Layout: ${parsed.layout}` : "",
      parsed?.task_cues ? `Cues: ${parsed.task_cues}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export async function observeImages(images, goal) {
  const list = Array.isArray(images) ? images.filter((i) => i?.dataUrl || i?.url) : [];
  const vision = await pickVisionModel();
  const observations = [];
  for (const img of list.slice(0, 4)) {
    const meta = imageMeta(img);
    let raw = "";
    try {
      if (vision.provider === "ollama") raw = await describeWithOllama(vision.model, img, goal);
      else if (vision.provider === "llama") raw = await describeWithLlama(img, goal);
    } catch (err) {
      raw = `Vision model error: ${err.message || err}`;
    }
    if (!raw) {
      raw = JSON.stringify({
        scene: "No vision model is loaded. Only file metadata is available.",
        visible_text: [],
        ui_elements: [],
        objects: [],
        layout: "",
        task_cues: "Load Ollama moondream/llava or a vision GGUF, or describe the image in the prompt.",
      });
    }
    observations.push(parseObservation(raw, meta));
  }
  return { vision, observations };
}

function parseThink(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) {
    return {
      thought: String(text || "").slice(0, 800),
      where: "",
      action: { name: "note", args: { text: String(text || "").slice(0, 400) } },
    };
  }
  try {
    const j = JSON.parse(m[0]);
    return {
      thought: j.thought || j.think || "",
      where: j.where || j.position || "",
      plan: Array.isArray(j.plan) ? j.plan : null,
      action: j.action && typeof j.action === "object" ? j.action : { name: "note", args: { text: j.thought || "" } },
    };
  } catch {
    return { thought: text.slice(0, 800), where: "", action: { name: "finish", args: { summary: text.slice(0, 200) } } };
  }
}

const SYSTEM = frameworkSystemPrompt();

function fallbackThink({ goal, cards, step, maxSteps, lastResult }) {
  const plan = defaultOrchestrationPlan(step);
  if (step === 1) {
    return {
      thought: "Fallback planner: listing the workspace so the log has a position.",
      where: "observe",
      plan,
      action: { name: "list", args: { path: "." } },
    };
  }
  if (step === 2) {
    return {
      thought: `User goal: ${String(goal).slice(0, 280)}. Vision: ${String(cards).slice(0, 200) || "(none)"}.`,
      where: "reason",
      plan,
      action: { name: "note", args: { text: `Workspace listing:\n${String(lastResult || "").slice(0, 1500)}` } },
    };
  }
  return {
    thought: "Workflow complete. Logs keep observe → reason → choose → execute → verify.",
    where: "verify",
    plan: defaultOrchestrationPlan(8).map((p) => ({ ...p, status: "done" })),
    action: {
      name: "finish",
      args: { summary: `Local agent pass finished. Goal: ${String(goal).slice(0, 180)}.` },
    },
  };
}

function formatChatContext(chatContext) {
  if (!Array.isArray(chatContext) || !chatContext.length) return "";
  return chatContext
    .slice(-12)
    .map((m) => `${m.role}: ${String(m.content || "").slice(0, 400)}`)
    .join("\n")
    .slice(0, 2500);
}

function priorLog(agentId) {
  if (!agentId) return "";
  const prev = readJson(runPath(agentId), null);
  if (!prev?.log?.length) return prev?.transcript?.slice(-2000) || "";
  return prev.log
    .slice(-12)
    .map((e) => `[${e.phase}#${e.step}] ${e.thought || ""} → ${e.action?.name || ""} ${e.result ? String(e.result).slice(0, 200) : ""}`)
    .join("\n");
}

export async function startLocalAgent(body, onEvent) {
  const emit = (type, data) => {
    try {
      onEvent?.({ type, data });
    } catch {
      /* ignore */
    }
  };
  const s = getSettings();
  const cwd = sandboxRoot(body.cwd);
  const maxSteps = Math.max(1, Math.min(12, Number(body.maxSteps || s.localAgentMaxSteps || 8)));
  const goal = String(body.prompt || body.voiceTranscript || "").trim() || "Inspect the workspace and attached images, then report.";
  const followLog = priorLog(body.agentId);
  const chatBits = formatChatContext(body.chatContext);
  const run = {
    id: randomUUID(),
    goal,
    cwd,
    status: "running",
    step: 0,
    phase: "observe",
    maxSteps,
    llmModel: s.loadedModel || s.provider || "local",
    vision: null,
    observations: [],
    plan: defaultOrchestrationPlan(1),
    log: [],
    transcript: "",
    startedAt: Date.now(),
    finishedAt: null,
    error: "",
    usedFallback: false,
  };
  liveRuns.set(run.id, run);
  markLive(run.id);
  persistRun(run);
  emit("session", publicLocalRun(run));
  notifyRun("start", run).catch(() => {});

  const finish = (status = run.status) => {
    if (run.status === "running") run.status = status;
    run.finishedAt = run.finishedAt || Date.now();
    persistRun(run);
    liveRuns.delete(run.id);
    markDone(run.id);
    remember({ scope: cwd, key: "last-run", text: `${goal.slice(0, 180)} → ${status}`, runId: run.id });
    notifyRun(status === "error" ? "error" : "done", run).catch(() => {});
    emit("done", publicLocalRun(run));
    return publicLocalRun(run);
  };

  const aborted = () => Boolean(body.signal?.aborted) || run.status !== "running";

  try {
    run.plan = defaultOrchestrationPlan(2);
    emit("event", { type: "observe", name: "observe", preview: "Observing images, memory, and workspace…", ts: Date.now() });
    const seen = await observeImages(body.images || [], goal);
    if (aborted()) return finish("cancelled");
    run.vision = { provider: seen.vision.provider, model: seen.vision.model };
    run.observations = seen.observations;
    const cards = seen.observations.map((o) => o.llm_card).join("\n\n") || "(no images attached)";
    run.log.push({
      t: Date.now(),
      step: 0,
      phase: "observe",
      thought: `Vision via ${seen.vision.provider || "none"} ${seen.vision.model || "(metadata fallback)"}`.trim(),
      where: "observe",
      action: { name: "observe" },
      result: cards.slice(0, 1200),
    });
    const memBits = recall({ scope: cwd, query: goal, limit: 6 })
      .map((n) => `- ${n.key}: ${String(n.text).slice(0, 200)}`)
      .join("\n");
    let ragBits = "";
    if (s.agentCollectionId) {
      try {
        const ragOut = await executeTool({ name: "retrieve", args: { query: goal } }, { cwd, runId: run.id, goal, scope: cwd });
        ragBits = String(ragOut.result || "").slice(0, 1500);
      } catch {
        ragBits = "";
      }
    }
    run.transcript += `## Observe\n${cards}\n\n`;
    if (memBits) run.transcript += `## Memory\n${memBits}\n\n`;
    if (ragBits) run.transcript += `## Context retrieval\n${ragBits}\n\n`;
    emit("token", run.transcript);
    emit("event", { type: "observe", name: run.vision.model || run.vision.provider, preview: cards.slice(0, 180), ts: Date.now() });
    persistRun(run);
    emit("session", publicLocalRun(run));

    let lastResult = "";
    const seenFp = new Map();
    for (let i = 1; i <= maxSteps; i++) {
      if (aborted()) return finish(run.status === "running" ? "cancelled" : run.status);
      run.step = i;
      appendMetric({ kind: "step", runId: run.id, step: i });
      bumpMetric("steps");
      run.phase = "reason";
      run.plan = defaultOrchestrationPlan(Math.min(8, 2 + i));
      const logTail = run.log
        .slice(-8)
        .map((e) => `[${e.phase}#${e.step}] ${(e.thought || "").slice(0, 100)} → ${e.action?.name || ""}`)
        .join("\n");
      const planText = (run.plan || []).map((p) => `- [${p.status}] ${p.title}`).join("\n");
      const user = [
        `User prompt:\n${goal}`,
        body.voiceTranscript ? `Voice:\n${body.voiceTranscript}` : "",
        chatBits ? `Recent chat:\n${chatBits}` : "",
        followLog ? `Previous agent log (follow-up):\n${followLog}` : "",
        `Workspace: ${cwd}`,
        `You are at step ${i} of ${maxSteps}. Allowed tools: ${allowedToolNames().join(", ")}.`,
        `Orchestration:\n${planText}`,
        `Agent log:\n${logTail || "(empty)"}`,
        memBits ? `Scoped memory:\n${memBits}` : "",
        ragBits ? `RAG:\n${ragBits}` : "",
        `Vision cards:\n${cards}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      emit("event", { type: "reason", name: `step ${i}`, preview: `Step ${i}: reason → choose…`, ts: Date.now() });
      let parsed;
      try {
        const once = await withRetry(
          () =>
            completeOnce({
              vision: false,
              signal: body.signal,
              messages: [
                { role: "system", content: skillSystemPrompt(SYSTEM) },
                { role: "user", content: user },
              ],
            }),
          { retries: 1, label: "planner" }
        );
        parsed = parseThink(once.text);
        run.llmModel = s.loadedModel || s.provider || run.llmModel;
      } catch (err) {
        if (aborted()) return finish(run.status === "running" ? "cancelled" : run.status);
        run.usedFallback = true;
        run.llmModel = "fallback-planner";
        parsed = fallbackThink({ goal, cards, step: i, maxSteps, lastResult });
        emit("event", {
          type: "status",
          name: "fallback",
          preview: `LLM unavailable (${String(err.message || err).slice(0, 80)}). Using lightweight planner.`,
          ts: Date.now(),
        });
      }

      const checked = validateAction(parsed.action);
      if (!checked.ok) {
        emit("event", { type: "verify", name: "schema", preview: checked.error, ts: Date.now() });
        parsed.action = { name: "note", args: { text: checked.error } };
        parsed.thought = `${parsed.thought || ""} Hallucinated tool blocked.`;
      } else {
        parsed.action = checked.action;
      }

      if (parsed.plan?.length) {
        run.plan = parsed.plan.map((p, idx) => ({
          id: String(p.id || idx + 1),
          title: p.title || "step",
          status: p.status || "todo",
        }));
      }

      const fp = actionFingerprint(parsed.action);
      seenFp.set(fp, (seenFp.get(fp) || 0) + 1);
      const rails = guardrailCheck({ run, action: parsed.action });
      if (rails.loop.looping || seenFp.get(fp) >= 3) {
        bumpMetric("loopsStopped");
        parsed.action = { name: "finish", args: { summary: "Stopped: same tool+args repeated (loop guard)." } };
      }
      if (rails.budget.exceeded) {
        parsed.action = { name: "finish", args: { summary: "Stopped: token budget exceeded." } };
      }

      run.phase = "execute";
      const out = await executeTool(parsed.action, { cwd, runId: run.id, goal, scope: cwd });
      const result = out.result;
      lastResult = result;
      run.phase = "verify";
      const verdict = await criticVerify({
        goal,
        thought: parsed.thought,
        action: parsed.action,
        result,
        signal: body.signal,
      });
      run.log.push({
        t: Date.now(),
        step: i,
        phase: "execute",
        thought: parsed.thought,
        where: parsed.where,
        action: parsed.action,
        result: String(result).slice(0, 4000),
        critic: verdict,
      });
      const line = `### Step ${i} — ${parsed.action?.name || "note"}\nWhere: ${parsed.where || "reason"}\nThink: ${parsed.thought}\nResult: ${String(result).slice(0, 1200)}\nCritic: ${verdict.pass ? "pass" : "fail"} (${verdict.score ?? "?"}) — ${verdict.critique || ""}\n\n`;
      run.transcript += line;
      emit("token", line);
      emit("event", { type: "tool", name: parsed.action?.name, preview: String(result).slice(0, 180), ts: Date.now() });
      emit("event", { type: "verify", name: verdict.pass ? "pass" : "fail", preview: verdict.critique || "", ts: Date.now() });
      if (!verdict.pass) bumpMetric("criticFail");
      persistRun(run);
      emit("session", publicLocalRun(run));

      const stop = parsed.action?.name === "finish" || i === maxSteps || verdict.continue === false;
      if (stop) {
        run.phase = "respond";
        if (i === maxSteps && parsed.action?.name !== "finish") {
          run.transcript += `\n## Stopped at max steps (${maxSteps})\n`;
        }
        run.plan = defaultOrchestrationPlan(8).map((p) => ({ ...p, status: "done" }));
        return finish("done");
      }
    }

    return finish("done");
  } catch (err) {
    appendMetric({ kind: "error", runId: run.id, error: String(err.message || err) });
    bumpMetric("errors");
    run.error = String(err.message || err);
    emit("error", { error: run.error });
    return finish("error");
  }
}

export function publicLocalRun(run) {
  if (!run) return null;
  return {
    id: run.id,
    agentId: run.id,
    prompt: run.goal,
    status: run.status,
    model: run.llmModel,
    runtime: "local-vision",
    cwd: run.cwd,
    text: run.transcript,
    events: (run.log || []).slice(-80).map((e) => ({
      type: e.phase,
      name: e.action?.name || e.phase,
      preview: (e.where ? `${e.where} · ` : "") + String(e.thought || e.result || "").slice(0, 200),
      ts: e.t,
    })),
    plan: run.plan,
    vision: run.vision,
    observations: (run.observations || []).map((o) => ({
      name: o.name,
      scene: o.scene,
      llm_card: o.llm_card,
    })),
    step: run.step,
    phase: run.phase,
    error: run.error || "",
    usedFallback: !!run.usedFallback,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    context: null,
  };
}

export function localAgentHistory() {
  return listLocalAgentRuns();
}

export function cancelLocalAgent(id) {
  const run = (id && liveRuns.get(id)) || (id ? readJson(runPath(id), null) : null);
  if (!run) return null;
  if (run.status === "running") {
    run.status = "cancelled";
    run.finishedAt = Date.now();
    persistRun(run);
    liveRuns.delete(id);
    markDone(id);
  }
  return publicLocalRun(run);
}

export function localAgentStatus() {
  const s = getSettings();
  const inf = inferenceStatus();
  const local = s.cursorRuntime === "local-vision" || s.agentMode === "local";
  return {
    mode: s.agentMode || "forge",
    runtime: s.cursorRuntime || "local",
    maxSteps: s.localAgentMaxSteps || 8,
    visionModel: s.localAgentVisionModel || "",
    llmReady: Boolean(inf.running) || s.provider === "ollama",
    configured: local,
    cwd: s.cursorCwd || path.join(dataDir(), "agent-workspace"),
    hitlWrites: !!s.agentHitlWrites,
    allowNetwork: !!s.agentAllowNetwork && !s.airplane,
    budgetTokens: s.agentBudgetTokens || 8000,
  };
}
