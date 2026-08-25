import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { modelsDir, dataDir } from "./paths.js";
import { getSettings, patchSettings } from "./settings.js";
import { hardwareSnapshot, fitEstimate } from "./hardware.js";

const execFileAsync = promisify(execFile);

const downloads = new Map();

function assertOnline() {
  if (getSettings().airplane) {
    throw new Error("Airplane mode is on — Hugging Face is blocked");
  }
}

export async function searchModels(query) {
  assertOnline();
  const q = encodeURIComponent(query || "gguf");
  const url = `https://huggingface.co/api/models?search=${q}&filter=gguf&sort=downloads&limit=24`;
  const headers = { Accept: "application/json", "User-Agent": "Localmod/0.1" };
  const token = getSettings().hfToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Hugging Face search failed (${res.status})`);
  const rows = await res.json();
  const hw = await hardwareSnapshot();
  return rows.map((m) => {
    const sizeBytes = guessSize(m);
    return {
      id: m.id,
      downloads: m.downloads,
      likes: m.likes,
      pipeline: m.pipeline_tag,
      tags: (m.tags || []).slice(0, 12),
      lastModified: m.lastModified,
      sizeBytes,
      fit: fitEstimate({
        fileSizeBytes: sizeBytes,
        ramTotalMb: hw.ramTotalMb,
        vramTotalMb: hw.vramTotalMb,
        gpuLayers: getSettings().gpuLayers,
      }),
    };
  });
}

function guessSize(m) {
  const tag = (m.tags || []).find((t) => /\d+(\.\d+)?(GB|MB|B)/i.test(t));
  if (!tag) return 4 * 1024 * 1024 * 1024;
  const n = parseFloat(tag);
  if (/GB/i.test(tag)) return n * 1024 * 1024 * 1024;
  if (/MB/i.test(tag)) return n * 1024 * 1024;
  return 4 * 1024 * 1024 * 1024;
}

export async function listRepoFiles(repoId) {
  assertOnline();
  const url = `https://huggingface.co/api/models/${repoId}/tree/main`;
  const headers = { Accept: "application/json", "User-Agent": "Localmod/0.1" };
  const token = getSettings().hfToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Could not list ${repoId}`);
  const tree = await res.json();
  const files = flattenTree(tree).filter((f) => f.path.toLowerCase().endsWith(".gguf"));
  const hw = await hardwareSnapshot();
  return files.map((f) => ({
    path: f.path,
    size: f.size,
    oid: f.oid,
    quant: detectQuant(f.path),
    fit: fitEstimate({
      fileSizeBytes: f.size || 0,
      ramTotalMb: hw.ramTotalMb,
      vramTotalMb: hw.vramTotalMb,
      gpuLayers: getSettings().gpuLayers,
    }),
  }));
}

function flattenTree(nodes, acc = []) {
  for (const n of nodes || []) {
    if (n.type === "file") acc.push(n);
    if (n.type === "directory" && n.children) flattenTree(n.children, acc);
  }
  return acc;
}

function detectQuant(filename) {
  const m = filename.toUpperCase().match(/Q[2-8]_[K0-9M]+|IQ\d_\w+|F16|F32|BF16/);
  return m ? m[0] : "unknown";
}

export function libraryDir() {
  const custom = String(getSettings().libraryPath || "").trim();
  const dir = custom || modelsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listLibrary() {
  const dir = libraryDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  walk(dir, out);
  return out.sort((a, b) => b.mtime - a.mtime);
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.toLowerCase().endsWith(".gguf")) {
      out.push({
        path: p,
        name,
        size: st.size,
        mtime: st.mtimeMs,
        quant: detectQuant(name),
      });
    }
  }
}

export function importModel(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File not found");
  const dest = path.join(libraryDir(), path.basename(filePath));
  if (path.resolve(filePath) !== path.resolve(dest)) {
    fs.copyFileSync(filePath, dest);
  }
  return { path: dest };
}

export async function startDownload(body) {
  assertOnline();
  const repo = body.repoId || body.repo;
  const file = body.file;
  const id = `${repo}:${file}`;
  const folder = String(body.destDir || body.dest || "").trim() || libraryDir();
  fs.mkdirSync(folder, { recursive: true });
  const dest = path.join(folder, file.replace(/[/\\]/g, "_"));
  const tmp = dest + ".part";
  let existing = 0;
  if (fs.existsSync(tmp)) existing = fs.statSync(tmp).size;
  const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
  const headers = { "User-Agent": "Localmod/0.1" };
  const token = getSettings().hfToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (existing) headers.Range = `bytes=${existing}-`;
  const ctrl = new AbortController();
  downloads.set(id, { dest, tmp, received: existing, total: existing, status: "running", ctrl });
  const res = await fetch(url, { headers, signal: ctrl.signal, redirect: "follow" });
  if (!res.ok && res.status !== 206) {
    downloads.set(id, { ...downloads.get(id), status: `error ${res.status}` });
    throw new Error(`Download failed (${res.status})`);
  }
  const total = existing + Number(res.headers.get("content-length") || 0);
  const stream = fs.createWriteStream(tmp, { flags: existing ? "a" : "w" });
  const reader = res.body.getReader();
  let received = existing;
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        stream.write(Buffer.from(value));
        received += value.length;
        downloads.set(id, { ...downloads.get(id), received, total, status: "running" });
      }
      stream.end();
      fs.renameSync(tmp, dest);
      let sha = null;
      downloads.set(id, { dest, received, total, status: "verifying" });
      sha = await sha256File(dest);
      downloads.set(id, { dest, received, total, status: "done", sha256: sha });
    } catch (err) {
      stream.destroy();
      downloads.set(id, { ...downloads.get(id), status: String(err.message || err) });
    }
  })();
  return { id, dest, resumed: existing > 0 };
}

export function downloadStatus() {
  return [...downloads.entries()].map(([id, d]) => ({
    id,
    dest: d.dest,
    received: d.received,
    total: d.total,
    status: d.status,
    sha256: d.sha256,
  }));
}

export function cancelDownload(id) {
  downloads.get(id)?.ctrl?.abort();
}

async function sha256File(file) {
  const crypto = await import("node:crypto");
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(file)
      .on("data", (c) => hash.update(c))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

export function airplaneGuardFetch(url) {
  if (getSettings().airplane && !isLoopback(url)) {
    throw new Error("Airplane mode blocks outbound network");
  }
}

function isLoopback(url) {
  try {
    const u = new URL(url);
    return ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

export async function pickLibraryDir() {
  let selected = "";
  try {
    if (process.platform === "win32") {
      const script = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
        "$d.Description = 'Choose where Localmod saves GGUF models'",
        "$d.ShowNewFolderButton = $true",
        "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }",
      ].join("; ");
      const { stdout } = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        { timeout: 300000, windowsHide: false, encoding: "utf8" }
      );
      selected = String(stdout || "").trim();
    } else if (process.platform === "darwin") {
      const { stdout } = await execFileAsync("osascript", [
        "-e",
        'POSIX path of (choose folder with prompt "Choose where Localmod saves GGUF models")',
      ]);
      selected = String(stdout || "").trim();
    }
  } catch {
    selected = "";
  }
  if (!selected) return { cancelled: true, path: libraryDir() };
  patchSettings({ libraryPath: selected });
  return { cancelled: false, path: libraryDir() };
}

export { dataDir };
