# Localmod

Local-first desktop studio for open-weight models. Chat, Hugging Face GGUF discovery, GPU offload via `llama-server`, encrypted vault, local RAG, OpenAI-style API, MCP permissions, multi-model race, AutoTune, and an Ollama sidecar.

This is original MIT-licensed software. It is not a fork of LM Studio or G0DM0D3.

## Why not a public blockchain

Publishing chats or hashes on a public chain exposes them. Localmod keeps data on your machine: airplane mode, `127.0.0.1` binds, an AES-GCM vault, and a **local** integrity hash chain.

## Run (Node sidecar + React UI)

Rust/Tauri is laid out under `crates/` and `apps/desktop/src-tauri/` for a native shell. Until `rustc` is installed, the product runs as:

```bash
npm install
npm run dev
```

Or double-click `Start Localmod.bat`. The React UI opens at `http://localhost:1420` (keep the terminal open). The engine is `http://127.0.0.1:4781`. If that port is already in use, Localmod reuses it and still starts the UI.

### Headless (`localmodd`)

```bash
npm run cli -- --model D:\models\something.gguf --ngl 20 --airplane
```

OpenAI-style API (when started from the UI or CLI): `http://127.0.0.1:4782/v1/chat/completions`

## Inference

Install [llama.cpp](https://github.com/ggml-org/llama.cpp) so `llama-server` is on PATH, or set **Settings → llama-server path**.

Alternatively run [Ollama](https://ollama.com) locally and use Discover/Race against `http://127.0.0.1:11434`.

GPU: NVIDIA (`nvidia-smi` VRAM HUD + `-ngl`), Apple Metal when llama-server is a Metal build, Vulkan/CPU otherwise. MLX is detected on Apple Silicon for a later backend switch.

## Privacy

- Airplane mode blocks Hugging Face.
- Vault passphrase encrypts chat history (AES-256-GCM).
- Integrity log stores **hashes only**.
- API server defaults to loopback. Confirm before LAN bind.

Remote machines: `ssh -L 8080:127.0.0.1:8080 user@box` then point Localmod at localhost.

## Layout

- `apps/desktop` — React + Tauri shell
- `packages/engine` — control plane (inference, HF, RAG, API, MCP)
- `apps/cli` — `localmodd`
- `crates/*` — native libraries for the Tauri path
