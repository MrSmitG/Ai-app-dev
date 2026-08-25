import http from "node:http";
import { getSettings } from "./settings.js";
import { llamaBase } from "./inference.js";
import { ollamaChat, ollamaTags } from "./ollama.js";
import { listLibrary } from "./hf.js";
import { apiInspectorPath } from "./paths.js";
import fs from "node:fs";

let server = null;
const inspector = [];

function logInspector(row) {
  inspector.unshift(row);
  if (inspector.length > 200) inspector.pop();
  fs.appendFileSync(apiInspectorPath(), JSON.stringify(row) + "\n");
}

export function inspectorLog() {
  return inspector;
}

export function apiStatus() {
  return {
    running: Boolean(server?.listening),
    port: getSettings().apiPort,
    bind: getSettings().apiBindLan ? "0.0.0.0" : "127.0.0.1",
  };
}

export function startApiServer() {
  if (server) return apiStatus();
  const s = getSettings();
  const host = s.apiBindLan ? "0.0.0.0" : "127.0.0.1";
  server = http.createServer(async (req, res) => {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const started = Date.now();
    try {
      if (s.apiKey) {
        const auth = req.headers.authorization || "";
        if (auth !== `Bearer ${s.apiKey}`) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: "invalid api key" }));
          return;
        }
      }
      if (req.url === "/v1/models" && req.method === "GET") {
        const local = listLibrary().map((m) => ({ id: m.name, object: "model" }));
        let ollama = [];
        try {
          ollama = (await ollamaTags()).map((m) => ({ id: `ollama/${m.name}`, object: "model" }));
        } catch {
          ollama = [];
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: [...local, ...ollama] }));
        logInspector({ t: Date.now(), path: "/v1/models", ms: Date.now() - started, status: 200 });
        return;
      }
      if (req.url === "/v1/chat/completions" && req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        const target = body.model?.startsWith("ollama/") ? "ollama" : "llama";
        if (target === "ollama") {
          const r = await ollamaChat({
            model: body.model.replace(/^ollama\//, ""),
            messages: body.messages,
            stream: body.stream,
            params: { temperature: body.temperature, topP: body.top_p },
          });
          if (body.stream) {
            res.writeHead(200, { "Content-Type": "text/event-stream" });
            for await (const chunk of r.body) res.write(chunk);
            res.end();
          } else {
            const text = await r.text();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(text);
          }
        } else {
          const r = await fetch(`${llamaBase()}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json" });
          if (body.stream && r.body) {
            for await (const chunk of r.body) res.write(chunk);
            res.end();
          } else {
            res.end(Buffer.from(await r.arrayBuffer()));
          }
        }
        logInspector({
          t: Date.now(),
          path: "/v1/chat/completions",
          model: body.model,
          ms: Date.now() - started,
          status: 200,
          tokens: 0,
        });
        return;
      }
      res.writeHead(404);
      res.end("not found");
    } catch (err) {
      logInspector({ t: Date.now(), path: req.url, ms: Date.now() - started, status: 500, error: String(err) });
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(err.message || err) }));
    }
  });
  server.listen(s.apiPort, host);
  return apiStatus();
}

export function stopApiServer() {
  server?.close();
  server = null;
  return apiStatus();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
