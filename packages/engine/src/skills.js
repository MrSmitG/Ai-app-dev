import { randomUUID } from "node:crypto";
import path from "node:path";
import { dataDir, readJson, writeJson } from "./paths.js";
import { getSettings, patchSettings } from "./settings.js";

const BUILTINS = [
  {
    id: "architect",
    name: "Architect",
    tagline: "Systems thinking, clean boundaries",
    emoji: "A",
    tone: "precise",
    personality:
      "You are Architect - a senior systems designer. Prefer clear structure, trade-offs, and durable APIs. Be concise, name risks early, and propose phased plans.",
    builtin: true,
  },
  {
    id: "craftsman",
    name: "Craftsman",
    tagline: "Elegant code, ruthless clarity",
    emoji: "C",
    tone: "focused",
    personality:
      "You are Craftsman - an expert implementer. Write clean, idiomatic code. Explain only what matters. Prefer small diffs and tests when useful.",
    builtin: true,
  },
  {
    id: "socratic",
    name: "Socratic",
    tagline: "Teaches by asking better questions",
    emoji: "S",
    tone: "curious",
    personality:
      "You are Socratic - a patient mentor. Ask clarifying questions, teach concepts step by step, and avoid dumping walls of text unless asked.",
    builtin: true,
  },
  {
    id: "critic",
    name: "Critic",
    tagline: "Finds holes before users do",
    emoji: "X",
    tone: "sharp",
    personality:
      "You are Critic - a rigorous reviewer. Hunt bugs, edge cases, security issues, and weak UX. Be direct but constructive; always suggest a fix.",
    builtin: true,
  },
  {
    id: "researcher",
    name: "Researcher",
    tagline: "Evidence first, speculation last",
    emoji: "R",
    tone: "calm",
    personality:
      "You are Researcher - careful and evidence-driven. Cite local documents when available. Separate facts from guesses. Prefer structured summaries.",
    builtin: true,
  },
  {
    id: "storyteller",
    name: "Storyteller",
    tagline: "Makes complex ideas vivid",
    emoji: "T",
    tone: "warm",
    personality:
      "You are Storyteller - explain with metaphors and narrative when helpful, without sacrificing accuracy. Keep language inviting and memorable.",
    builtin: true,
  },
];

function customPath() {
  return path.join(dataDir(), "skills.json");
}

function loadCustom() {
  return readJson(customPath(), []);
}

function saveCustom(rows) {
  writeJson(customPath(), rows);
}

export function listSkills() {
  return [...BUILTINS, ...loadCustom()];
}

export function getSkill(id) {
  return listSkills().find((s) => s.id === id) || null;
}

export function createSkill(body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Skill name is required");
  const skill = {
    id: randomUUID(),
    name,
    tagline: String(body.tagline || "").trim() || "Custom personality",
    emoji: String(body.emoji || "*").trim().slice(0, 4) || "*",
    tone: String(body.tone || "custom").trim() || "custom",
    personality: String(body.personality || "").trim() || `You are ${name}. Be helpful and precise.`,
    builtin: false,
    created: Date.now(),
  };
  const rows = loadCustom();
  rows.unshift(skill);
  saveCustom(rows);
  return skill;
}

export function updateSkill(id, body) {
  const rows = loadCustom();
  const i = rows.findIndex((s) => s.id === id);
  if (i < 0) throw new Error("Only custom skills can be edited");
  rows[i] = {
    ...rows[i],
    name: body.name != null ? String(body.name).trim() : rows[i].name,
    tagline: body.tagline != null ? String(body.tagline).trim() : rows[i].tagline,
    emoji: body.emoji != null ? String(body.emoji).trim().slice(0, 4) : rows[i].emoji,
    tone: body.tone != null ? String(body.tone).trim() : rows[i].tone,
    personality: body.personality != null ? String(body.personality).trim() : rows[i].personality,
  };
  saveCustom(rows);
  return rows[i];
}

export function deleteSkill(id) {
  const rows = loadCustom().filter((s) => s.id !== id);
  saveCustom(rows);
  const active = getSettings().activeSkillId;
  if (active === id) patchSettings({ activeSkillId: "" });
  return { ok: true };
}

export function activateSkill(id) {
  if (id && !getSkill(id)) throw new Error("Unknown skill");
  const next = patchSettings({ activeSkillId: id || "" });
  const skill = id ? getSkill(id) : null;
  return { activeSkillId: next.activeSkillId, skill };
}

export function activeSkill() {
  const id = getSettings().activeSkillId;
  return id ? getSkill(id) : null;
}

export function skillSystemPrompt(basePrompt) {
  const skill = activeSkill();
  const base = String(basePrompt || "").trim();
  if (!skill) return base;
  return [skill.personality, base].filter(Boolean).join("\n\n");
}
