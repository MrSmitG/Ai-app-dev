import crypto from "node:crypto";
import fs from "node:fs";
import { chatsPath, vaultMetaPath, readJson, writeJson } from "./paths.js";

const ALGO = "aes-256-gcm";

function deriveKey(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, 32);
}

export function vaultStatus() {
  const meta = readJson(vaultMetaPath(), null);
  const unlocked = Boolean(globalThis.__localmodKey);
  return {
    configured: Boolean(meta?.salt),
    unlocked,
    encrypted: Boolean(meta?.encrypted),
  };
}

export function setupVault(passphrase) {
  const salt = crypto.randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const check = encryptBuffer(Buffer.from("localmod-ok"), key);
  writeJson(vaultMetaPath(), {
    salt: salt.toString("base64"),
    check,
    encrypted: true,
  });
  globalThis.__localmodKey = key;
  return vaultStatus();
}

export function unlockVault(passphrase) {
  const meta = readJson(vaultMetaPath(), null);
  if (!meta?.salt) {
    return setupVault(passphrase);
  }
  const key = deriveKey(passphrase, Buffer.from(meta.salt, "base64"));
  try {
    decryptBuffer(meta.check, key);
  } catch {
    throw new Error("Wrong passphrase");
  }
  globalThis.__localmodKey = key;
  return vaultStatus();
}

export function lockVault() {
  globalThis.__localmodKey = null;
  return vaultStatus();
}

function encryptBuffer(buf, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

function decryptBuffer(payload, key) {
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(payload.data, "base64")),
    decipher.final(),
  ]);
}

export function loadChats() {
  const raw = readJson(chatsPath(), { threads: [] });
  if (raw.encrypted && raw.payload) {
    const key = globalThis.__localmodKey;
    if (!key) return { threads: [], locked: true };
    const json = decryptBuffer(raw.payload, key).toString("utf8");
    return { ...JSON.parse(json), locked: false };
  }
  return { threads: raw.threads || [], locked: false };
}

export function saveChats(state) {
  const meta = readJson(vaultMetaPath(), null);
  const key = globalThis.__localmodKey;
  if (meta?.encrypted && key) {
    writeJson(chatsPath(), {
      encrypted: true,
      payload: encryptBuffer(Buffer.from(JSON.stringify({ threads: state.threads })), key),
    });
    return;
  }
  writeJson(chatsPath(), { threads: state.threads });
}

export function exportBackup() {
  const chats = loadChats();
  if (chats.locked) throw new Error("Vault locked");
  const key = globalThis.__localmodKey;
  if (!key) return { plaintext: true, chats };
  return {
    plaintext: false,
    payload: encryptBuffer(Buffer.from(JSON.stringify(chats)), key),
  };
}
