import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function dataDir() {
  const dir = process.env.LOCALMOD_HOME || path.join(os.homedir(), ".localmod");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "models"), { recursive: true });
  fs.mkdirSync(path.join(dir, "downloads"), { recursive: true });
  fs.mkdirSync(path.join(dir, "rag"), { recursive: true });
  fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
  return dir;
}

export function modelsDir() {
  return path.join(dataDir(), "models");
}

export function chatsPath() {
  return path.join(dataDir(), "chats.json");
}

export function settingsPath() {
  return path.join(dataDir(), "settings.json");
}

export function vaultMetaPath() {
  return path.join(dataDir(), "vault.json");
}

export function integrityPath() {
  return path.join(dataDir(), "integrity.jsonl");
}

export function mcpAuditPath() {
  return path.join(dataDir(), "mcp-audit.jsonl");
}

export function apiInspectorPath() {
  return path.join(dataDir(), "api-inspector.jsonl");
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

