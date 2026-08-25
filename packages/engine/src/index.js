#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as vault from "./vault.js";
import * as settings from "./settings.js";
import * as hardware from "./hardware.js";
import * as integrity from "./integrity.js";
import * as hf from "./hf.js";
import * as inference from "./inference.js";
import * as chat from "./chat.js";
import * as rag from "./rag.js";
import * as apiServer from "./apiServer.js";
import * as mcp from "./mcp.js";
import * as race from "./race.js";
import * as ollama from "./ollama.js";
import * as autotuneMod from "./autotune.js";
import * as cursorAgent from "./cursorAgent.js";
import * as skills from "./skills.js";
import * as voice from "./voice.js";
import * as contextMod from "./context.js";

const PORT = Number(process.env.LOCALMOD_ENGINE_PORT || 4781);

function json(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function grab(mod, name) {
  return (...args) => {
    const want = name.toLowerCase().replace(/_/g, "");
    const key = Object.keys(mod).find(
      (k) => k.toLowerCase().replace(/_/g, "") === want && typeof mod[k] === "function"
    );
    if (!key) throw new Error(`Missing ${name}. Have: ${Object.keys(mod).join(", ")}`);
    return mod[key](...args);
  };
}

const getSettings = grab(settings, "getSettings");
const patchSettings = grab(settings, "patchSettings");
const applyPreset = grab(settings, "applyPreset");
const vaultStatus = grab(vault, "vaultStatus");
const setupVault = grab(vault, "setupVault");
const unlockVault = grab(vault, "unlockVault");
const lockVault = grab(vault, "lockVault");
const exportBackup = grab(vault, "exportBackup");
const loadChats = grab(vault, "loadChats");
const saveChats = grab(vault, "saveChats");
const searchModels = grab(hf, "searchModels");
const listRepoFiles = grab(hf, "listRepoFiles");
const listLibrary = grab(hf, "listLibrary");
const libraryDir = grab(hf, "libraryDir");
const pickLibraryDir = grab(hf, "pickLibraryDir");
const importModel = grab(hf, "importModel");
const startDownload = grab(hf, "startDownload");
const downloadStatus = grab(hf, "downloadStatus");
const cancelDownload = grab(hf, "cancelDownload");
const inferenceStatus = grab(inference, "inferenceStatus");
const startInference = grab(inference, "startInference");
const stopInference = grab(inference, "stopInference");
const reloadInference = grab(inference, "reloadInference");
const loadEstimate = grab(inference, "loadEstimate");
const modelInfo = grab(inference, "modelInfo");
const completeChat = grab(chat, "completeChat");
const logTurn = grab(chat, "logTurn");
const listCollections = grab(rag, "listCollections");
const createCollection = grab(rag, "createCollection");
const deleteCollection = grab(rag, "deleteCollection");
const ingestFile = grab(rag, "ingestFile");
const ingestPath = grab(rag, "ingestPath");
const listSources = grab(rag, "listSources");
const pickDataPath = grab(rag, "pickDataPath");
const retrieve = grab(rag, "retrieve");
const getChunk = grab(rag, "getChunk");
const listSkills = grab(skills, "listSkills");
const createSkill = grab(skills, "createSkill");
const updateSkill = grab(skills, "updateSkill");
const deleteSkill = grab(skills, "deleteSkill");
const activateSkill = grab(skills, "activateSkill");
const activeSkill = grab(skills, "activeSkill");
const getSkill = grab(skills, "getSkill");
const voiceStatus = grab(voice, "voiceStatus");
const transcribeWhisper = grab(voice, "transcribeWhisper");
const apiStatus = grab(apiServer, "apiStatus");
const startApiServer = grab(apiServer, "startApiServer");
const stopApiServer = grab(apiServer, "stopApiServer");
const inspectorLog = grab(apiServer, "inspectorLog");
const listMcp = grab(mcp, "listMcp");
const connectMcp = grab(mcp, "connectMcp");
const pendingPermissions = grab(mcp, "pendingPermissions");
const requestToolCall = grab(mcp, "requestToolCall");
const resolvePermission = grab(mcp, "resolvePermission");
const mcpAudit = grab(mcp, "mcpAudit");
const readIntegrity = grab(integrity, "readIntegrity");
const verifyIntegrity = grab(integrity, "verifyIntegrity");
const hardwareSnapshot = grab(hardware, "hardwareSnapshot");
const ollamaTags = grab(ollama, "ollamaTags");
const autotune = grab(autotuneMod, "autotune");
const raceModels = grab(race, "raceModels");
const cursorStatus = grab(cursorAgent, "cursorStatus");
const listCursorModels = grab(cursorAgent, "listCursorModels");
const listCursorAgents = grab(cursorAgent, "listCursorAgents");
const startCursorRun = grab(cursorAgent, "startCursorRun");
const cancelCursorRun = grab(cursorAgent, "cancelCursorRun");
const getCursorRun = grab(cursorAgent, "getCursorRun");
const cursorHistory = grab(cursorAgent, "cursorHistory");
const pickCursorCwd = grab(cursorAgent, "pickCursorCwd");

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1");
  const aliases = {
    "/models/library": "/models/library",
    "/inference": "/inference",
    "/inference/start": "/inference/start",
    "/inference/stop": "/inference/stop",
    "/rag/collections": "/rag/collections",
    "/rag/ingest": "/rag/ingest",
    "/api-server": "/api-server",
    "/api-server/start": "/api-server/start",
    "/api-server/stop": "/api-server/stop",
    "/api-server/inspector": "/api-server/inspector",
    "/models/downloads": "/models/downloads",
    "/models/search": "/models/search",
    "/models/files": "/models/files",
    "/models/download": "/models/download",
    "/mcp/connect": "/mcp/connect",
    "/mcp/pending": "/mcp/pending",
    "/mcp/permission": "/mcp/permission",
    "/ollama/tags": "/ollama/tags",
    "/vault/setup": "/vault/setup",
    "/settings/preset": "/settings/preset",
  };
  if (aliases[url.pathname]) url.pathname = aliases[url.pathname];
  try {
    if (url.pathname === "/health") return json(res, 200, { ok: true, name: "localmod-engine" });
    if (url.pathname === "/hardware") return json(res, 200, await hardwareSnapshot());
    if (url.pathname === "/settings" && req.method === "GET") return json(res, 200, getSettings());
    if (url.pathname === "/settings" && req.method === "POST") return json(res, 200, patchSettings(await readBody(req)));
    if (url.pathname === "/settings/preset" && req.method === "POST") {
      const { name } = await readBody(req);
      return json(res, 200, applyPreset(name));
    }
    if (url.pathname === "/vault" && req.method === "GET") return json(res, 200, vaultStatus());
    if (url.pathname === "/vault/setup" && req.method === "POST") return json(res, 200, setupVault((await readBody(req)).passphrase));
    if (url.pathname === "/vault/unlock" && req.method === "POST") return json(res, 200, unlockVault((await readBody(req)).passphrase));
    if (url.pathname === "/vault/lock" && req.method === "POST") return json(res, 200, lockVault());
    if (url.pathname === "/vault/export") return json(res, 200, exportBackup());
    if (url.pathname === "/chats" && req.method === "GET") return json(res, 200, loadChats());
    if (url.pathname === "/chats" && req.method === "POST") {
      saveChats(await readBody(req));
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/integrity") return json(res, 200, { rows: readIntegrity(), verify: verifyIntegrity() });
    if (url.pathname === "/models/search") return json(res, 200, await searchModels(url.searchParams.get("q") || ""));
    if (url.pathname === "/models/files") return json(res, 200, await listRepoFiles(url.searchParams.get("repo")));
    if (url.pathname === "/models/library") return json(res, 200, listLibrary());
    if (url.pathname === "/models/dir") return json(res, 200, { path: libraryDir() });
    if (url.pathname === "/models/pick-dir" && req.method === "POST") return json(res, 200, await pickLibraryDir());
    if (url.pathname === "/models/import" && req.method === "POST") return json(res, 200, importModel((await readBody(req)).path));
    if (url.pathname === "/models/download" && req.method === "POST") return json(res, 200, await startDownload(await readBody(req)));
    if (url.pathname === "/models/downloads") return json(res, 200, downloadStatus());
    if (url.pathname === "/models/cancel" && req.method === "POST") {
      cancelDownload((await readBody(req)).id);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/inference" && req.method === "GET") return json(res, 200, inferenceStatus());
    if (url.pathname === "/inference/estimate" && req.method === "GET") {
      return json(res, 200, await loadEstimate(url.searchParams.get("model") || undefined));
    }
    if (url.pathname === "/inference/model" && req.method === "GET") {
      return json(res, 200, modelInfo(url.searchParams.get("path") || undefined));
    }
    if (url.pathname === "/inference/start" && req.method === "POST") return json(res, 200, await startInference(await readBody(req)));
    if (url.pathname === "/inference/stop" && req.method === "POST") return json(res, 200, await stopInference());
    if (url.pathname === "/inference/reload" && req.method === "POST") return json(res, 200, await reloadInference());
    if (url.pathname === "/ollama/tags") return json(res, 200, await ollamaTags());
    if (url.pathname === "/autotune" && req.method === "POST") return json(res, 200, autotune((await readBody(req)).prompt || ""));
    if (url.pathname === "/context/estimate" && req.method === "POST") {
      const body = await readBody(req);
      const s = getSettings();
      if (Array.isArray(body.messages)) {
        const packed = contextMod.packMessages(body.messages, {
          contextLength: body.contextLength ?? s.contextLength,
          reserveTokens: body.reserveTokens ?? s.contextReserveTokens,
          keepRecent: body.keepRecent ?? s.contextKeepRecent,
          compact: body.compact ?? s.contextCompact !== false,
          imageTokenCost: body.imageTokenCost ?? s.imageTokenCost,
          vision: s.visionEnabled !== false,
        });
        return json(res, 200, packed.usage);
      }
      return json(
        res,
        200,
        contextMod.estimatePromptBundle({
          text: body.text || "",
          voice: body.voice || "",
          images: body.images || [],
          contextLength: body.contextLength ?? s.contextLength,
          reserveTokens: body.reserveTokens ?? s.contextReserveTokens,
          imageTokenCost: body.imageTokenCost ?? s.imageTokenCost,
        })
      );
    }
    if (url.pathname === "/chat" && req.method === "POST") {
      const body = await readBody(req);
      const ac = new AbortController();
      req.on("close", () => ac.abort());
      const result = await completeChat({ ...body, signal: ac.signal });
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
      res.write(
        `event: meta\ndata: ${JSON.stringify({
          citations: result.citations,
          tune: result.tune,
          provider: result.provider,
          context: result.context,
        })}\n\n`
      );
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      for await (const chunk of result.stream) {
        buf += decoder.decode(chunk, { stream: true });
        if (result.provider === "ollama") {
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const t = JSON.parse(line).message?.content || "";
              if (t) {
                full += t;
                res.write(`event: token\ndata: ${JSON.stringify(t)}\n\n`);
              }
            } catch { /* ignore */ }
          }
        } else {
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const t = JSON.parse(data).choices?.[0]?.delta?.content || "";
              if (t) {
                full += t;
                res.write(`event: token\ndata: ${JSON.stringify(t)}\n\n`);
              }
            } catch { /* ignore */ }
          }
        }
      }
      const prompt = [...(body.messages || [])].reverse().find((m) => m.role === "user")?.content || "";
      logTurn({ provider: result.provider, model: body.model, prompt, response: full });
      res.write(`event: done\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      res.end();
      return;
    }
    if (url.pathname === "/rag/collections" && req.method === "GET") return json(res, 200, listCollections());
    if (url.pathname === "/rag/collections" && req.method === "POST") return json(res, 200, createCollection((await readBody(req)).name));
    if (url.pathname.startsWith("/rag/collections/") && req.method === "DELETE") {
      deleteCollection(url.pathname.split("/").pop());
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/rag/ingest" && req.method === "POST") {
      const { collectionId, path: p } = await readBody(req);
      return json(res, 200, await ingestPath(collectionId, p));
    }
    if (url.pathname === "/harbor/sources" && req.method === "GET") {
      return json(res, 200, listSources(url.searchParams.get("collectionId")));
    }
    if (url.pathname === "/harbor/pick" && req.method === "POST") return json(res, 200, await pickDataPath());
    if (url.pathname === "/harbor/ingest" && req.method === "POST") {
      const { collectionId, path: p } = await readBody(req);
      return json(res, 200, await ingestPath(collectionId, p));
    }
    if (url.pathname === "/skills" && req.method === "GET") return json(res, 200, listSkills());
    if (url.pathname === "/skills/active" && req.method === "GET") return json(res, 200, { skill: activeSkill(), activeSkillId: getSettings().activeSkillId || "" });
    if (url.pathname === "/skills" && req.method === "POST") return json(res, 200, createSkill(await readBody(req)));
    if (url.pathname === "/skills/activate" && req.method === "POST") return json(res, 200, activateSkill((await readBody(req)).id));
    if (url.pathname.startsWith("/skills/") && req.method === "POST") {
      const id = url.pathname.split("/").pop();
      return json(res, 200, updateSkill(id, await readBody(req)));
    }
    if (url.pathname.startsWith("/skills/") && req.method === "DELETE") {
      return json(res, 200, deleteSkill(url.pathname.split("/").pop()));
    }
    if (url.pathname === "/rag/query" && req.method === "POST") {
      const { collectionId, query, k } = await readBody(req);
      return json(res, 200, await retrieve(collectionId, query, k));
    }
    if (url.pathname === "/rag/chunk") return json(res, 200, getChunk(url.searchParams.get("collectionId"), url.searchParams.get("id")));
    if (url.pathname === "/api-server" && req.method === "GET") return json(res, 200, apiStatus());
    if (url.pathname === "/api-server/start" && req.method === "POST") return json(res, 200, startApiServer());
    if (url.pathname === "/api-server/stop" && req.method === "POST") return json(res, 200, stopApiServer());
    if (url.pathname === "/api-server/inspector") return json(res, 200, inspectorLog());
    if (url.pathname === "/mcp" && req.method === "GET") return json(res, 200, listMcp());
    if (url.pathname === "/mcp/connect" && req.method === "POST") return json(res, 200, await connectMcp(await readBody(req)));
    if (url.pathname === "/mcp/pending") return json(res, 200, pendingPermissions().map(({ resolve, reject, ...r }) => r));
    if (url.pathname === "/mcp/call" && req.method === "POST") return json(res, 200, await requestToolCall(await readBody(req)));
    if (url.pathname === "/mcp/permission" && req.method === "POST") return json(res, 200, await resolvePermission(await readBody(req)));
    if (url.pathname === "/mcp/audit") return json(res, 200, mcpAudit());
    if (url.pathname === "/race" && req.method === "POST") return json(res, 200, await raceModels(await readBody(req)));
    if (url.pathname === "/voice" && req.method === "GET") return json(res, 200, voiceStatus());
    if (url.pathname === "/voice/transcribe" && req.method === "POST") return json(res, 200, await transcribeWhisper(await readBody(req)));
    if (url.pathname === "/cursor" && req.method === "GET") return json(res, 200, cursorStatus());
    if (url.pathname === "/forge" && req.method === "GET") return json(res, 200, cursorStatus());
    if (url.pathname === "/cursor/models" && req.method === "GET") return json(res, 200, await listCursorModels());
    if (url.pathname === "/forge/models" && req.method === "GET") return json(res, 200, await listCursorModels());
    if (url.pathname === "/cursor/agents" && req.method === "GET") return json(res, 200, await listCursorAgents());
    if (url.pathname === "/forge/agents" && req.method === "GET") return json(res, 200, await listCursorAgents());
    if (url.pathname === "/cursor/history" && req.method === "GET") return json(res, 200, cursorHistory());
    if (url.pathname === "/forge/history" && req.method === "GET") return json(res, 200, cursorHistory());
    if (url.pathname === "/cursor/pick-cwd" && req.method === "POST") return json(res, 200, await pickCursorCwd());
    if (url.pathname === "/forge/pick-cwd" && req.method === "POST") return json(res, 200, await pickCursorCwd());
    if (url.pathname === "/cursor/run" && req.method === "GET") return json(res, 200, getCursorRun(url.searchParams.get("id")));
    if (url.pathname === "/forge/run" && req.method === "GET") return json(res, 200, getCursorRun(url.searchParams.get("id")));
    if (url.pathname === "/cursor/cancel" && req.method === "POST") return json(res, 200, await cancelCursorRun((await readBody(req)).id));
    if (url.pathname === "/forge/cancel" && req.method === "POST") return json(res, 200, await cancelCursorRun((await readBody(req)).id));
    if ((url.pathname === "/cursor/run" || url.pathname === "/forge/run") && req.method === "POST") {
      const body = await readBody(req);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      const write = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      try {
        await startCursorRun(body, (msg) => write(msg.type, msg.data));
      } catch (err) {
        write("error", { error: String(err.message || err) });
      }
      res.end();
      return;
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 400, { error: String(err.message || err) });
  }
});

export function startEngine(port = PORT) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Engine already running on http://127.0.0.1:${port} — reusing it`);
        resolve(null);
        return;
      }
      reject(err);
    };
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      console.log(`Localmod engine on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

function spawnUi() {
  const here = fileURLToPath(import.meta.url);
  const desktop = path.resolve(path.dirname(here), "../../../apps/desktop");
  console.log(`Starting React UI from ${desktop}`);
  console.log("Open http://localhost:1420 in your browser if it does not open automatically.");
  const child = spawn("npx", ["vite", "--open"], {
    cwd: desktop,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

const here = fileURLToPath(import.meta.url);
const launchedDirectly = String(process.argv[1] || "")
  .replace(/\\/g, "/")
  .toLowerCase()
  .endsWith("packages/engine/src/index.js");
const spawnVite =
  process.argv.includes("--spawn-vite") || process.argv.includes("--spawn-vite");
if (launchedDirectly || spawnVite) {
  await startEngine();
  if (spawnVite) spawnUi();
}
