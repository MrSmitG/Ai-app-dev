#!/usr/bin/env node
import { startEngine } from "../../../packages/engine/src/index.js";
import * as settings from "../../../packages/engine/src/settings.js";
import * as inference from "../../../packages/engine/src/inference.js";
import * as apiServer from "../../../packages/engine/src/apiServer.js";
import * as hf from "../../../packages/engine/src/hf.js";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0) return process.argv[i + 1];
  return fallback;
}

const model = arg("model");
const port = Number(arg("port", process.env.LOCALMOD_ENGINE_PORT || "4781"));
const apiPort = Number(arg("api-port", "4782"));
const ngl = arg("ngl");
const airplane = process.argv.includes("--airplane");

if (ngl) settings.patchSettings({ gpuLayers: Number(ngl) });
if (airplane) settings.patchSettings({ airplane: true });
if (model) settings.patchSettings({ loadedModel: model });
settings.patchSettings({ apiPort });

await startEngine(port);
if (model && model !== "path\\to\\model.gguf" && model !== "path/to/model.gguf") {
  try {
    await inference.startInference({ modelPath: model });
    console.log("llama-server started");
  } catch (err) {
    console.error("Inference start skipped:", err.message);
  }
}
apiServer.startApiServer();
console.log(`localmodd headless. Engine :${port}  OpenAI-style API :${apiPort}`);
console.log("Library:", hf.listLibrary().map((m) => m.name).join(", ") || "(empty)");
console.log("Ctrl+C to stop.");
