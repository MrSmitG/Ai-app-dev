import { useEffect, useState } from "react";
import { api } from "../api";
import { LabelWithTip, Tip, bytes } from "./ui";

const PRESETS = ["quality", "balanced", "creative", "precise", "cpu", "longctx"] as const;
const LLM_SECTIONS = [
  ["load", "Model load"],
  ["gpu", "GPU & hardware"],
  ["sampling", "Sampling"],
  ["penalties", "Penalties"],
  ["advanced", "Advanced"],
  ["prompt", "Prompt"],
] as const;

function SliderField({
  label,
  tip,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  tip: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label className="slider-field">
      <div className="slider-head">
        <LabelWithTip tip={tip}>{label}</LabelWithTip>
        <span className="mono">{value}
          {suffix || ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function LlmPanel({
  settings,
  hw,
  library,
  patch,
  refresh,
  setError,
  setTab,
}: {
  settings: any;
  hw: any;
  library: any[];
  patch: (p: Record<string, unknown>) => Promise<any>;
  refresh: () => Promise<void>;
  setError: (s: string) => void;
  setTab: (t: any) => void;
}) {
  const [section, setSection] = useState<(typeof LLM_SECTIONS)[number][0]>("load");
  const [estimate, setEstimate] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any>(`/inference/estimate?model=${encodeURIComponent(settings.loadedModel || "")}`)
      .then(setEstimate)
      .catch(() => setEstimate(null));
  }, [settings.loadedModel, settings.gpuLayers, hw?.inference?.running]);

  async function loadModel(modelPath: string) {
    setBusy(true);
    setError("");
    try {
      await patch({ loadedModel: modelPath });
      await api("/inference/start", { method: "POST", body: JSON.stringify({ modelPath }) });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function applyAndReload(partial: Record<string, unknown>) {
    await patch(partial);
    if (hw?.inference?.running && settings.loadedModel) {
      setBusy(true);
      try {
        await api("/inference/reload", { method: "POST" });
        await refresh();
      } catch (e: any) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }
  }

  const meta = estimate?.info || hw?.inference?.modelMeta;
  const fit = estimate?.fit;
  const gpu = hw?.gpus?.[0];

  return (
    <section className="view llm-view flow-in">
      <div className="hero-banner">
        <div>
          <div className="hero-kicker">
            LLM <Tip text="Full local inference controls similar to LM Studio: load, GPU offload, sampling, cache, RoPE, and more." />
          </div>
          <h2>Inference studio</h2>
          <p className="muted">Configure llama.cpp / Ollama like a pro workstation — then chat with the exact stack you dialed in.</p>
        </div>
        <div className="row">
          <button className="btn" disabled={busy || !settings.loadedModel} onClick={() => applyAndReload({})}>
            {busy ? "Working…" : "Reload engine"}
          </button>
          <button className="btn" disabled={!hw?.inference?.running} onClick={async () => { await api("/inference/stop", { method: "POST" }); refresh(); }}>
            Unload
          </button>
          <button className="btn primary" onClick={() => setTab("chat")}>Open Chat</button>
        </div>
      </div>

      <div className="llm-status-grid">
        <div className="panel compact">
          <div className="section-label">Engine</div>
          <div className={hw?.inference?.running ? "ok-text" : "muted"}>
            {hw?.inference?.running ? `Running · pid ${hw.inference.pid}` : "Idle — load a model"}
          </div>
          <div className="mono muted tiny">{settings.llamaHost}:{settings.llamaPort}</div>
        </div>
        <div className="panel compact">
          <div className="section-label">Model</div>
          <div>{meta?.name || "None selected"}</div>
          <div className="muted tiny">{meta?.quant || "—"} · {meta?.sizeMb ? `${meta.sizeMb} MB` : "—"}</div>
        </div>
        <div className="panel compact">
          <div className="section-label">VRAM fit</div>
          <div>{fit ? (fit.fits ? "Likely fits" : "May be tight") : "—"}</div>
          <div className="muted tiny">{fit ? `~${fit.needVramMb} MB GPU · ~${fit.needRamMb} MB RAM` : "Select a model"}</div>
        </div>
        <div className="panel compact">
          <div className="section-label">Hardware</div>
          <div>{gpu?.name || hw?.backendHint || "CPU"}</div>
          <div className="muted tiny">
            {gpu ? `${gpu.vramUsedMb}/${gpu.vramTotalMb} MB VRAM` : `${Math.round((hw?.ramUsedMb || 0) / 1024)}/${Math.round((hw?.ramTotalMb || 0) / 1024)} GB RAM`}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="section-label">Presets</div>
        <div className="row">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`btn ${settings.preset === p ? "primary" : ""}`}
              title={`Apply ${p} preset`}
              onClick={() => api("/settings/preset", { method: "POST", body: JSON.stringify({ name: p }) }).then(() => refresh())}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="row check">
          <input type="checkbox" checked={!!settings.autotune} onChange={(e) => patch({ autotune: e.target.checked })} />
          <LabelWithTip tip="Auto-adjust sampling from the latest user message style.">AutoTune sampling per message</LabelWithTip>
        </label>
      </div>

      <div className="seg">
        {LLM_SECTIONS.map(([id, label]) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </div>

      {section === "load" && (
        <div className="stack">
          <div className="form-grid two-col">
            <label>
              <LabelWithTip tip="llama.cpp HTTP server binary, or leave blank if llama-server is on PATH.">llama-server path</LabelWithTip>
              <input value={settings.llamaServerPath || ""} onChange={(e) => patch({ llamaServerPath: e.target.value })} placeholder="C:\...\llama-server.exe" />
            </label>
            <label>
              <LabelWithTip tip="Chat backend: llama.cpp server or Ollama.">Provider</LabelWithTip>
              <select value={settings.provider || "llama"} onChange={(e) => patch({ provider: e.target.value })}>
                <option value="llama">llama.cpp (llama-server)</option>
                <option value="ollama">Ollama</option>
              </select>
            </label>
            <label>
              <LabelWithTip tip="Bind host for llama-server (keep 127.0.0.1 for local-only).">Host</LabelWithTip>
              <input value={settings.llamaHost || "127.0.0.1"} onChange={(e) => patch({ llamaHost: e.target.value })} />
            </label>
            <label>
              <LabelWithTip tip="Port for llama-server OpenAI-compatible API.">Port</LabelWithTip>
              <input type="number" value={settings.llamaPort ?? 8080} onChange={(e) => patch({ llamaPort: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Ollama base URL when provider is Ollama.">Ollama URL</LabelWithTip>
              <input value={settings.ollamaUrl || ""} onChange={(e) => patch({ ollamaUrl: e.target.value })} />
            </label>
            <label>
              <LabelWithTip tip="How long Ollama keeps a model in memory (e.g. 5m, 0, -1).">Ollama keep_alive</LabelWithTip>
              <input value={settings.ollamaKeepAlive || "5m"} onChange={(e) => patch({ ollamaKeepAlive: e.target.value })} />
            </label>
          </div>
          <div className="section-label">Library — click to load</div>
          <div className="cards two">
            {library.map((m) => (
              <div className={`panel ${settings.loadedModel === m.path ? "active-model" : ""}`} key={m.path}>
                <div className="panel-title">{m.name}</div>
                <div className="muted">{bytes(m.size)} · {m.quant}</div>
                <div className="mono muted">{m.path}</div>
                <button className="btn primary" disabled={busy} onClick={() => loadModel(m.path)}>
                  {settings.loadedModel === m.path && hw?.inference?.running ? "Reload" : "Load model"}
                </button>
              </div>
            ))}
            {!library.length && (
              <div className="muted">
                No GGUF files yet. <button className="btn" onClick={() => setTab("models")}>Download models</button>
              </div>
            )}
          </div>
        </div>
      )}

      {section === "gpu" && (
        <div className="stack">
          <SliderField
            label="GPU layers (-ngl)"
            tip="How many transformer layers to offload to GPU. 0 = CPU only. 99 ≈ full offload."
            value={settings.gpuLayers ?? 20}
            min={0}
            max={99}
            onChange={(n) => patch({ gpuLayers: n })}
          />
          {estimate?.suggestedNgl != null && (
            <button className="btn" onClick={() => patch({ gpuLayers: estimate.suggestedNgl })}>
              Use suggested ngl ({estimate.suggestedNgl}) for this GPU
            </button>
          )}
          <SliderField
            label="Context length"
            tip="Max tokens of conversation + generation context. Higher uses more RAM/VRAM."
            value={settings.contextLength ?? 4096}
            min={512}
            max={131072}
            step={512}
            onChange={(n) => patch({ contextLength: n })}
          />
          <div className="form-grid two-col">
            <label>
              <LabelWithTip tip="Tokens reserved for the model reply so history does not fill the whole window.">Reply reserve</LabelWithTip>
              <input type="number" value={settings.contextReserveTokens ?? 1024} onChange={(e) => patch({ contextReserveTokens: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="How many recent messages to keep before compacting older ones.">Keep recent msgs</LabelWithTip>
              <input type="number" value={settings.contextKeepRecent ?? 24} onChange={(e) => patch({ contextKeepRecent: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Estimated tokens charged per attached image (vision models).">Image token cost</LabelWithTip>
              <input type="number" value={settings.imageTokenCost ?? 768} onChange={(e) => patch({ imageTokenCost: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Max images on one user turn.">Max images / turn</LabelWithTip>
              <input type="number" value={settings.maxImagesPerTurn ?? 8} onChange={(e) => patch({ maxImagesPerTurn: Number(e.target.value) })} />
            </label>
          </div>
          <div className="row checks">
            <label className="row check">
              <input type="checkbox" checked={settings.contextCompact !== false} onChange={(e) => patch({ contextCompact: e.target.checked })} />
              <LabelWithTip tip="Summarize older turns instead of silently truncating — better long-thread context than a raw dump.">Smart compact</LabelWithTip>
            </label>
            <label className="row check">
              <input type="checkbox" checked={settings.visionEnabled !== false} onChange={(e) => patch({ visionEnabled: e.target.checked })} />
              <LabelWithTip tip="Send image parts to vision-capable backends (Ollama / OpenAI-compatible).">Vision images</LabelWithTip>
            </label>
          </div>
          <div className="form-grid two-col">
            <label>
              <LabelWithTip tip="CPU threads for prompt eval (0 = auto).">Threads</LabelWithTip>
              <input type="number" value={settings.threads ?? 0} onChange={(e) => patch({ threads: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="CPU threads for batch processing (0 = auto).">Batch threads</LabelWithTip>
              <input type="number" value={settings.threadsBatch ?? 0} onChange={(e) => patch({ threadsBatch: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Prompt processing batch size.">Batch size</LabelWithTip>
              <input type="number" value={settings.batchSize ?? 512} onChange={(e) => patch({ batchSize: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Micro-batch size for physical batches.">Ubatch size</LabelWithTip>
              <input type="number" value={settings.ubatchSize ?? 512} onChange={(e) => patch({ ubatchSize: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Primary GPU index when multiple GPUs exist.">Main GPU</LabelWithTip>
              <input type="number" value={settings.mainGpu ?? 0} onChange={(e) => patch({ mainGpu: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Optional tensor split across GPUs, e.g. 3,1">Tensor split</LabelWithTip>
              <input value={settings.tensorSplit || ""} onChange={(e) => patch({ tensorSplit: e.target.value })} placeholder="e.g. 3,1" />
            </label>
          </div>
          <div className="row checks">
            <label className="row check">
              <input type="checkbox" checked={!!settings.flashAttention} onChange={(e) => patch({ flashAttention: e.target.checked })} />
              <LabelWithTip tip="Flash Attention — faster attention, often less VRAM.">Flash Attention</LabelWithTip>
            </label>
            <label className="row check">
              <input type="checkbox" checked={!!settings.mlock} onChange={(e) => patch({ mlock: e.target.checked })} />
              <LabelWithTip tip="Lock model weights in RAM (prevents swap thrash).">mlock</LabelWithTip>
            </label>
            <label className="row check">
              <input type="checkbox" checked={!!settings.noMmap} onChange={(e) => patch({ noMmap: e.target.checked })} />
              <LabelWithTip tip="Disable memory-mapping; load fully into RAM.">no-mmap</LabelWithTip>
            </label>
            <label className="row check">
              <input type="checkbox" checked={settings.contBatching !== false} onChange={(e) => patch({ contBatching: e.target.checked })} />
              <LabelWithTip tip="Continuous batching for parallel requests.">Continuous batching</LabelWithTip>
            </label>
          </div>
          <button className="btn primary" disabled={busy || !hw?.inference?.running} onClick={() => applyAndReload({})}>
            Apply GPU settings & reload
          </button>
        </div>
      )}

      {section === "sampling" && (
        <div className="stack">
          <SliderField label="Temperature" tip="Higher = more creative / random. 0 ≈ greedy." value={Number(settings.temperature ?? 0.7)} min={0} max={2} step={0.01} onChange={(n) => patch({ temperature: n })} />
          <SliderField label="Top P (nucleus)" tip="Sample from the smallest set of tokens whose cumulative probability ≥ P." value={Number(settings.topP ?? 0.95)} min={0} max={1} step={0.01} onChange={(n) => patch({ topP: n })} />
          <SliderField label="Top K" tip="Only consider the K most likely next tokens. 0 disables." value={Number(settings.topK ?? 40)} min={0} max={200} onChange={(n) => patch({ topK: n })} />
          <SliderField label="Min P" tip="Drop tokens below this probability relative to the top token." value={Number(settings.minP ?? 0.05)} min={0} max={1} step={0.01} onChange={(n) => patch({ minP: n })} />
          <SliderField label="Typical P" tip="Locally typical sampling. 1 disables." value={Number(settings.typicalP ?? 1)} min={0} max={1} step={0.01} onChange={(n) => patch({ typicalP: n })} />
          <div className="form-grid two-col">
            <label>
              <LabelWithTip tip="RNG seed. -1 = random each run.">Seed</LabelWithTip>
              <input type="number" value={settings.seed ?? -1} onChange={(e) => patch({ seed: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Max new tokens per reply. -1 = model / server default.">Max tokens</LabelWithTip>
              <input type="number" value={settings.maxTokens ?? -1} onChange={(e) => patch({ maxTokens: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="0 off, 1 Mirostat, 2 Mirostat 2.0">Mirostat mode</LabelWithTip>
              <select value={settings.mirostat ?? 0} onChange={(e) => patch({ mirostat: Number(e.target.value) })}>
                <option value={0}>Off</option>
                <option value={1}>Mirostat</option>
                <option value={2}>Mirostat 2.0</option>
              </select>
            </label>
            <label>
              <LabelWithTip tip="Mirostat target entropy (tau).">Mirostat tau</LabelWithTip>
              <input type="number" step={0.1} value={settings.mirostatTau ?? 5} onChange={(e) => patch({ mirostatTau: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Mirostat learning rate (eta).">Mirostat eta</LabelWithTip>
              <input type="number" step={0.01} value={settings.mirostatEta ?? 0.1} onChange={(e) => patch({ mirostatEta: Number(e.target.value) })} />
            </label>
            <label className="row check">
              <input type="checkbox" checked={settings.streamChat !== false} onChange={(e) => patch({ streamChat: e.target.checked })} />
              Stream tokens
            </label>
          </div>
        </div>
      )}

      {section === "penalties" && (
        <div className="stack">
          <SliderField label="Repeat penalty" tip="Penalize repeating the same tokens. 1.0 = off." value={Number(settings.repeatPenalty ?? 1.1)} min={1} max={2} step={0.01} onChange={(n) => patch({ repeatPenalty: n })} />
          <SliderField label="Presence penalty" tip="Penalize tokens that already appeared at all." value={Number(settings.presencePenalty ?? 0)} min={-2} max={2} step={0.05} onChange={(n) => patch({ presencePenalty: n })} />
          <SliderField label="Frequency penalty" tip="Penalize tokens proportional to how often they appeared." value={Number(settings.frequencyPenalty ?? 0)} min={-2} max={2} step={0.05} onChange={(n) => patch({ frequencyPenalty: n })} />
          <label>
            <LabelWithTip tip="Comma or newline separated stop strings.">Stop sequences</LabelWithTip>
            <textarea value={settings.stopSequences || ""} onChange={(e) => patch({ stopSequences: e.target.value })} placeholder={"</s>\nUser:"} rows={3} />
          </label>
        </div>
      )}

      {section === "advanced" && (
        <div className="stack">
          <div className="form-grid two-col">
            <label>
              <LabelWithTip tip="KV cache type for K (f16, q8_0, q4_0…). Lower = less VRAM.">Cache type K</LabelWithTip>
              <select value={settings.cacheTypeK || "f16"} onChange={(e) => patch({ cacheTypeK: e.target.value })}>
                {["f16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <LabelWithTip tip="KV cache type for V.">Cache type V</LabelWithTip>
              <select value={settings.cacheTypeV || "f16"} onChange={(e) => patch({ cacheTypeV: e.target.value })}>
                {["f16", "q8_0", "q4_0", "q4_1", "q5_0", "q5_1"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <LabelWithTip tip="Parallel decode slots.">Parallel slots</LabelWithTip>
              <input type="number" value={settings.parallelSlots ?? 1} onChange={(e) => patch({ parallelSlots: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="RoPE base frequency override. 0 = model default.">RoPE freq base</LabelWithTip>
              <input type="number" value={settings.ropeFreqBase ?? 0} onChange={(e) => patch({ ropeFreqBase: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="RoPE frequency scale for long context. 0 = default.">RoPE freq scale</LabelWithTip>
              <input type="number" step={0.01} value={settings.ropeFreqScale ?? 0} onChange={(e) => patch({ ropeFreqScale: Number(e.target.value) })} />
            </label>
            <label>
              <LabelWithTip tip="Optional draft GGUF for speculative decoding (experimental).">Draft model path</LabelWithTip>
              <input value={settings.draftModel || ""} onChange={(e) => patch({ draftModel: e.target.value })} placeholder="optional .gguf" />
            </label>
          </div>
          <label className="row check">
            <input type="checkbox" checked={!!settings.speculative} onChange={(e) => patch({ speculative: e.target.checked })} />
            Speculative decoding (needs draft model support in your llama-server build)
          </label>
          <label className="row check">
            <input type="checkbox" checked={settings.keepModelLoaded !== false} onChange={(e) => patch({ keepModelLoaded: e.target.checked })} />
            Prefer keeping model loaded between chats
          </label>
          {hw?.inference?.args?.length > 0 && (
            <div className="panel">
              <div className="section-label">Last launch args</div>
              <pre className="mono muted args-pre">{(hw.inference.args || []).join(" ")}</pre>
            </div>
          )}
          <button className="btn primary" disabled={busy || !hw?.inference?.running} onClick={() => applyAndReload({})}>
            Apply advanced & reload
          </button>
        </div>
      )}

      {section === "prompt" && (
        <div className="stack">
          <label>
            <LabelWithTip tip="Base system prompt. Active Skills are prepended automatically.">System prompt</LabelWithTip>
            <textarea value={settings.systemPrompt || ""} onChange={(e) => patch({ systemPrompt: e.target.value })} rows={10} />
          </label>
          <div className="muted">Tip: pair this with Skills for personality overlays without rewriting the base prompt.</div>
        </div>
      )}
    </section>
  );
}
