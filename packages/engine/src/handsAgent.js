import { spawn } from "node:child_process";
import path from "node:path";
import { completeOnce } from "./chat.js";
import { listTree, readFileRel, writeFileRel, workspaceRoot, searchCode } from "./codebase.js";

const ALLOW = new Set([
  "git",
  "ls",
  "dir",
  "pwd",
  "cat",
  "type",
  "echo",
  "npm",
  "node",
  "npx",
  "python",
  "python3",
  "pip",
  "cargo",
  "rustc",
  "go",
  "rg",
  "grep",
  "find",
  "head",
  "wc",
  "which",
  "whoami",
]);
const BLOCK = /\b(rm|sudo|chmod|chown|mkfs|dd|shutdown|reboot|kill|curl|wget|ssh)\b/i;

export function parseCmd(line) {
  const parts = String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts;
}

export async function runCli(cwd, command, { timeoutMs = 15000 } = {}) {
  const root = workspaceRoot(cwd);
  const parts = parseCmd(command);
  if (!parts.length) return { ok: false, error: "Empty command" };
  const bin = parts[0].replace(/^.*[/\\]/, "");
  if (!ALLOW.has(bin)) return { ok: false, error: `Command not allowlisted: ${bin}` };
  if (BLOCK.test(command)) return { ok: false, error: "Command blocked by Hands policy" };
  return new Promise((resolve) => {
    const child = spawn(parts[0], parts.slice(1), {
      cwd: root,
      shell: false,
      env: { ...process.env, CI: "1" },
    });
    let out = "";
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
      resolve({ ok: false, error: "Timed out", stdout: out.slice(0, 8000), command });
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      out += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: String(err.message || err), command });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout: out.slice(0, 8000), command });
    });
  });
}

function parseAction(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

export async function runHands({ cwd, goal, maxSteps = 6 }) {
  const root = workspaceRoot(cwd);
  const log = [];
  const tree = listTree(cwd, { limit: 80 });
  let last = "";
  const cap = Math.max(1, Math.min(10, Number(maxSteps) || 6));

  const fallback = (step) => {
    if (step === 1) return { thought: "Listing the workspace.", action: { name: "list", args: {} } };
    return { thought: "No LLM — finishing with the listing.", action: { name: "finish", args: { summary: last || "Listed workspace." } } };
  };

  for (let i = 1; i <= cap; i++) {
    let parsed = null;
    try {
      const once = await completeOnce({
        messages: [
          {
            role: "system",
            content: `You are Localmod Hands, an autonomous engineer. Workspace: ${root}
Allowed CLI: ${[...ALLOW].join(", ")}. No network, no rm, no sudo.
Return JSON:
{"thought":"...","action":{"name":"list|read|write|search|cli|finish","args":{}}}
cli.args.command is a single allowlisted command. write.args = {path, content}. read/search args = {path} or {query}.`,
          },
          {
            role: "user",
            content: `Goal: ${goal}\nStep ${i}/${cap}\nTree sample:\n${tree.files
              .slice(0, 40)
              .map((f) => f.path)
              .join("\n")}\nLast:\n${last.slice(0, 1500)}`,
          },
        ],
      });
      parsed = parseAction(once.text);
    } catch {
      parsed = fallback(i);
    }
    if (!parsed?.action?.name) parsed = fallback(i);

    const name = parsed.action.name;
    const args = parsed.action.args || {};
    let result = "";
    try {
      if (name === "list") {
        result = listTree(cwd, { limit: 80 })
          .files.map((f) => `${f.kind} ${f.path}`)
          .join("\n");
      } else if (name === "read") {
        result = readFileRel(cwd, args.path || args.file).content.slice(0, 4000);
      } else if (name === "search") {
        result = searchCode(cwd, args.query || args.q || goal)
          .hits.map((h) => `${h.path}:${h.line} ${h.text}`)
          .join("\n");
      } else if (name === "write") {
        const w = writeFileRel(cwd, args.path, args.content || "");
        result = `Wrote ${w.path} (${w.bytes} bytes)`;
      } else if (name === "cli") {
        const cli = await runCli(cwd, args.command || args.cmd);
        result = cli.ok ? cli.stdout : cli.error + (cli.stdout ? `\n${cli.stdout}` : "");
      } else {
        result = args.summary || parsed.thought || "done";
      }
    } catch (err) {
      result = String(err.message || err);
    }
    last = result;
    log.push({ step: i, thought: parsed.thought, action: { name, args }, result: String(result).slice(0, 2500) });
    if (name === "finish") break;
  }

  return { root, goal, status: "done", steps: log.length, log };
}
