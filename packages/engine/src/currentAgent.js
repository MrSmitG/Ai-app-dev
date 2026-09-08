import { completeOnce } from "./chat.js";
import { listTree, searchCode, readFileRel, writeFileRel, workspaceRoot } from "./codebase.js";
import { getSettings } from "./settings.js";

function parseJson(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function currentContext(cwd, query) {
  const tree = listTree(cwd, { limit: 180 });
  const hits = query ? searchCode(cwd, query, { limit: 24 }).hits : [];
  return { ...tree, hits, query: query || "" };
}

export async function runCurrent({ cwd, goal, query, apply = false }) {
  const root = workspaceRoot(cwd);
  const ctx = await currentContext(cwd, query || goal);
  const treeHint = ctx.files
    .filter((f) => f.kind === "file")
    .slice(0, 80)
    .map((f) => f.path)
    .join("\n");
  const hitHint = (ctx.hits || [])
    .slice(0, 16)
    .map((h) => `${h.path}:${h.line} ${h.text}`)
    .join("\n");
  const reads = [];
  for (const h of (ctx.hits || []).slice(0, 6)) {
    try {
      const file = readFileRel(cwd, h.path, { max: 12_000 });
      reads.push(`## ${file.path}\n${file.content}`);
    } catch {
      /* skip */
    }
  }
  const user = `Workspace: ${root}
Goal: ${goal}

File tree (sample):
${treeHint || "(empty)"}

Search hits:
${hitHint || "(none)"}

File contents:
${reads.join("\n\n") || "(none)"}

Return JSON only:
{"thought":"...","edits":[{"path":"relative/path","content":"full new file text","reason":"..."}]}
If you only need to explain, use edits: []. Prefer small, real files. Stay inside the workspace.`;

  let parsed = null;
  let usedFallback = false;
  try {
    const once = await completeOnce({
      messages: [
        {
          role: "system",
          content:
            "You are Localmod Code — an agentic coding partner with the whole workspace in view. Coordinate multi-file edits. JSON only.",
        },
        { role: "user", content: user },
      ],
    });
    parsed = parseJson(once.text);
  } catch {
    usedFallback = true;
  }
  if (!parsed) {
    usedFallback = true;
    parsed = {
      thought: "No LLM loaded. Indexed the workspace so you can pick files. Load a model or a Keys provider, then run Code again.",
      edits: [],
    };
  }
  const applied = [];
  const proposed = Array.isArray(parsed.edits) ? parsed.edits : [];
  if (apply) {
    for (const edit of proposed.slice(0, 12)) {
      if (!edit?.path || typeof edit.content !== "string") continue;
      applied.push(writeFileRel(cwd, edit.path, edit.content));
    }
  }
  return {
    root,
    thought: parsed.thought || "",
    edits: proposed.map((e) => ({ path: e.path, reason: e.reason || "", bytes: String(e.content || "").length })),
    applied,
    apply,
    usedFallback,
    filesIndexed: ctx.files.length,
    hits: ctx.hits?.length || 0,
    provider: getSettings().provider,
  };
}

export async function inlineEdit({ cwd, path: rel, instruction, apply = false }) {
  const file = readFileRel(cwd, rel, { max: 40_000 });
  let proposed = file.content;
  let thought = "";
  let usedFallback = false;
  try {
    const once = await completeOnce({
      messages: [
        {
          role: "system",
          content:
            "You are Localmod Editor inline edit. Return JSON {thought, content} where content is the FULL updated file. Do not wrap in markdown.",
        },
        {
          role: "user",
          content: `File: ${rel}\nInstruction: ${instruction}\n\nCurrent file:\n${file.content}`,
        },
      ],
    });
    const parsed = parseJson(once.text);
    if (parsed?.content) {
      proposed = parsed.content;
      thought = parsed.thought || "";
    } else {
      proposed = once.text || file.content;
      thought = "Model returned raw text.";
    }
  } catch (err) {
    usedFallback = true;
    thought = `LLM unavailable (${String(err.message || err).slice(0, 120)}). Showing original.`;
  }
  let applied = null;
  if (apply && proposed !== file.content) {
    applied = writeFileRel(cwd, rel, proposed);
  }
  return {
    path: rel,
    original: file.content,
    proposed,
    thought,
    applied,
    usedFallback,
  };
}
