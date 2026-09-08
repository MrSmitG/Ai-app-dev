import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getSettings } from "./settings.js";

const SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "release",
  ".next",
  "squashfs-root",
  "coverage",
  ".cache",
]);
const CODE_EXT = new Set([
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".css",
  ".html",
  ".sh",
  ".bat",
]);

export function workspaceRoot(cwd) {
  const raw = String(cwd || getSettings().cursorCwd || process.cwd() || "").trim();
  const resolved = path.resolve(raw || process.cwd());
  const home = os.homedir();
  if (resolved === "/" || resolved === path.parse(resolved).root) {
    throw new Error("Refusing to index a drive root. Pick a project folder.");
  }
  if (!resolved.startsWith(home) && !resolved.startsWith(process.cwd())) {
    /* still allow explicit project paths the user picked */
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error("Workspace folder not found. Set it in Code or Options.");
  }
  return resolved;
}

export function safeJoin(root, rel) {
  const file = path.normalize(path.join(root, String(rel || ".").replace(/^[/\\]+/, "")));
  if (!file.startsWith(root)) throw new Error("Path escapes the workspace.");
  return file;
}

export function listTree(cwd, { limit = 250 } = {}) {
  const root = workspaceRoot(cwd);
  const out = [];
  function walk(dir, depth) {
    if (out.length >= limit || depth > 8) return;
    let ents = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    ents.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of ents) {
      if (out.length >= limit) return;
      if (e.name.startsWith(".") && e.name !== ".github" && e.name !== ".gitignore") continue;
      if (SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).replaceAll("\\", "/");
      if (e.isDirectory()) {
        out.push({ path: rel, kind: "dir" });
        walk(full, depth + 1);
      } else {
        const ext = path.extname(e.name).toLowerCase();
        out.push({ path: rel, kind: "file", ext });
      }
    }
  }
  walk(root, 0);
  return { root, files: out, truncated: out.length >= limit };
}

export function searchCode(cwd, query, { limit = 40 } = {}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { root: workspaceRoot(cwd), hits: [] };
  const { root, files } = listTree(cwd, { limit: 400 });
  const hits = [];
  for (const f of files) {
    if (f.kind !== "file" || !CODE_EXT.has(f.ext)) continue;
    const full = safeJoin(root, f.path);
    let text = "";
    try {
      const st = fs.statSync(full);
      if (st.size > 200_000) continue;
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        hits.push({
          path: f.path,
          line: i + 1,
          text: lines[i].trim().slice(0, 220),
        });
        if (hits.length >= limit) return { root, hits };
        break;
      }
    }
  }
  return { root, hits };
}

export function readFileRel(cwd, rel, { max = 80_000 } = {}) {
  const root = workspaceRoot(cwd);
  const full = safeJoin(root, rel);
  const st = fs.statSync(full);
  if (st.size > max) return { path: rel, truncated: true, content: fs.readFileSync(full, "utf8").slice(0, max) };
  return { path: rel, truncated: false, content: fs.readFileSync(full, "utf8") };
}

export function writeFileRel(cwd, rel, content) {
  const root = workspaceRoot(cwd);
  const full = safeJoin(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, String(content ?? ""), "utf8");
  return { path: rel, bytes: Buffer.byteLength(String(content ?? "")) };
}
