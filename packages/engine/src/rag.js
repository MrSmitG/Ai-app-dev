import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dataDir, readJson, writeJson } from "./paths.js";

function collectionsPath() {
  return path.join(dataDir(), "rag", "collections.json");
}

function indexPath(id) {
  return path.join(dataDir(), "rag", `${id}.json`);
}

export function listCollections() {
  return readJson(collectionsPath(), []);
}

function saveCollections(rows) {
  writeJson(collectionsPath(), rows);
}

export function createCollection(name) {
  const rows = listCollections();
  const col = { id: crypto.randomUUID(), name, created: Date.now(), docs: 0 };
  rows.push(col);
  saveCollections(rows);
  writeJson(indexPath(col.id), { chunks: [] });
  return col;
}

export function deleteCollection(id) {
  saveCollections(listCollections().filter((c) => c.id !== id));
  const p = indexPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);
  if ([".txt", ".md", ".csv", ".html", ".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".cs", ".rb", ".php", ".yml", ".yaml", ".toml", ".xml", ".sql", ".sh", ".ps1"].includes(ext)) {
    return buf.toString("utf8");
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return r.value || "";
  }
  if (ext === ".pdf") {
    const mod = await import("pdf-parse");
    const pdf = mod.default || mod;
    const r = await pdf(buf);
    return r.text || "";
  }
  throw new Error(`Unsupported type: ${ext}`);
}

function chunkText(text, filename) {
  const pages = text.split(/\f|\n{3,}/);
  const chunks = [];
  pages.forEach((page, pageIdx) => {
    const parts = page.split(/\n{2,}/);
    let buf = "";
    const flush = () => {
      const t = buf.trim();
      if (t.length > 40) {
        chunks.push({
          id: crypto.randomUUID(),
          filename,
          page: pageIdx + 1,
          snippet: t.slice(0, 1200),
          tokens: tokenize(t),
        });
      }
      buf = "";
    };
    for (const p of parts) {
      if ((buf + p).length > 900) flush();
      buf += (buf ? "\n\n" : "") + p;
    }
    flush();
  });
  return chunks;
}

function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export async function ingestFile(collectionId, filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File not found");
  const filename = path.basename(filePath);
  const text = await extractText(filePath);
  const chunks = chunkText(text, filename);
  const idx = readJson(indexPath(collectionId), { chunks: [] });
  idx.chunks.push(...chunks);
  writeJson(indexPath(collectionId), idx);
  const cols = listCollections().map((c) =>
    c.id === collectionId ? { ...c, docs: (c.docs || 0) + 1 } : c
  );
  saveCollections(cols);
  return { chunks: chunks.length, filename };
}

const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".html", ".docx", ".pdf", ".json", ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".cs", ".rb", ".php", ".yml", ".yaml", ".toml", ".xml", ".sql", ".sh", ".ps1"]);

function walkFiles(dir, out, depth = 0) {
  if (depth > 8) return;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") || ent.name === "node_modules" || ent.name === "dist" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(p, out, depth + 1);
    else if (TEXT_EXTS.has(path.extname(ent.name).toLowerCase())) out.push(p);
  }
}

export async function ingestPath(collectionId, targetPath) {
  if (!fs.existsSync(targetPath)) throw new Error("Path not found");
  const st = fs.statSync(targetPath);
  if (st.isFile()) return { ...await ingestFile(collectionId, targetPath), files: 1, errors: [] };
  const files = [];
  walkFiles(targetPath, files);
  let ok = 0;
  let chunks = 0;
  const errors = [];
  for (const f of files.slice(0, 400)) {
    try {
      const r = await ingestFile(collectionId, f);
      ok += 1;
      chunks += r.chunks || 0;
    } catch (err) {
      errors.push({ path: f, error: String(err.message || err) });
    }
  }
  return { files: ok, chunks, errors: errors.slice(0, 20), skipped: Math.max(0, files.length - 400) };
}

export function listSources(collectionId) {
  const idx = readJson(indexPath(collectionId), { chunks: [] });
  const map = new Map();
  for (const c of idx.chunks || []) {
    const key = c.filename || "unknown";
    const row = map.get(key) || { filename: key, chunks: 0 };
    row.chunks += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.chunks - a.chunks);
}

export async function pickDataPath() {
  const { pickFolder } = await import("./pickFolder.js");
  const selected = await pickFolder("Choose a folder to load into Harbor");
  return selected ? { cancelled: false, path: selected } : { cancelled: true, path: "" };
}

function idf(chunks) {
  const df = new Map();
  for (const c of chunks) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) || 0) + 1);
  }
  const n = chunks.length || 1;
  const map = new Map();
  for (const [t, d] of df) map.set(t, Math.log(1 + n / (d + 1)));
  return map;
}

function bm25(queryTokens, chunk, idfMap, avgLen) {
  const tf = new Map();
  for (const t of chunk.tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;
  for (const t of queryTokens) {
    const f = tf.get(t) || 0;
    if (!f) continue;
    const idfv = idfMap.get(t) || 0;
    score += (idfv * f * (k1 + 1)) / (f + k1 * (1 - b + b * (chunk.tokens.length / avgLen)));
  }
  return score;
}

function overlap(queryTokens, chunk) {
  const set = new Set(chunk.tokens);
  let n = 0;
  for (const t of queryTokens) if (set.has(t)) n++;
  return n / Math.max(queryTokens.length, 1);
}

export async function retrieve(collectionId, query, k = 6) {
  const idx = readJson(indexPath(collectionId), { chunks: [] });
  const q = tokenize(query);
  if (!idx.chunks.length) return { citations: [] };
  const idfMap = idf(idx.chunks);
  const avg = idx.chunks.reduce((a, c) => a + c.tokens.length, 0) / idx.chunks.length;
  const ranked = idx.chunks
    .map((c) => ({
      ...c,
      score: bm25(q, c, idfMap, avg) * 0.7 + overlap(q, c) * 0.3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return {
    citations: ranked.map((c) => ({
      id: c.id,
      filename: c.filename,
      page: c.page,
      snippet: c.snippet,
      score: Number(c.score.toFixed(3)),
    })),
  };
}

export function getChunk(collectionId, chunkId) {
  const idx = readJson(indexPath(collectionId), { chunks: [] });
  return idx.chunks.find((c) => c.id === chunkId) || null;
}
