import crypto from "node:crypto";
import fs from "node:fs";
import { integrityPath } from "./paths.js";

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function appendIntegrity({ provider, model, prompt, response }) {
  let prev = "genesis";
  if (fs.existsSync(integrityPath())) {
    const lines = fs.readFileSync(integrityPath(), "utf8").trim().split("\n").filter(Boolean);
    if (lines.length) {
      try {
        prev = JSON.parse(lines[lines.length - 1]).hash;
      } catch {
        prev = "genesis";
      }
    }
  }
  const record = {
    timestamp: Date.now(),
    provider,
    model,
    promptHash: hash(prompt || ""),
    responseHash: hash(response || ""),
    prev,
  };
  record.hash = hash(JSON.stringify(record));
  fs.appendFileSync(integrityPath(), JSON.stringify(record) + "\n");
  return record;
}

export function readIntegrity(limit = 50) {
  if (!fs.existsSync(integrityPath())) return [];
  const lines = fs.readFileSync(integrityPath(), "utf8").trim().split("\n").filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l));
}

export function verifyIntegrity() {
  const rows = readIntegrity(10000);
  for (let i = 0; i < rows.length; i++) {
    const { hash: h, ...rest } = rows[i];
    const expected = hash(JSON.stringify(rest));
    if (h !== expected) return { ok: false, at: i };
    if (i > 0 && rest.prev !== rows[i - 1].hash) return { ok: false, at: i, reason: "broken-link" };
  }
  return { ok: true, count: rows.length };
}
