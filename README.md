# Localmod

Local-first **React + Electron** desktop studio for open-weight models (Windows & macOS). Chat with smart context (pie meter), Loki-style memory tree pivots, LM Studio-style LLM controls, Hugging Face GGUF downloads, agents, skills, Harbor data, voice, images, local RAG, OpenAI-style API, MCP, and Ollama race.

This is original MIT-licensed software. It is not a fork of LM Studio or G0DM0D3.

## Why not a public blockchain

Publishing chats or hashes on a public chain exposes them. Localmod keeps data on your machine: airplane mode, `127.0.0.1` binds, an AES-GCM vault, and a **local** integrity hash chain.

## Run on Windows or Mac

Requires **Node.js 20+**.

```bash
npm install
npm run desktop
```

| Platform | Launcher |
|----------|----------|
| Windows | Double-click `Start Localmod.bat` |
| macOS | Double-click `Start Localmod.command` (or run `npm run desktop`) |

That starts:
1. Local engine (`http://127.0.0.1:4781`)
2. React UI (Vite on `1420`)
3. **Electron** desktop window

Browser-only (no Electron window):

```bash
npm run dev:web
```

### Package installers

Build the UI, then package with electron-builder (artifacts in `release/`):

```bash
npm run build:win    # Windows NSIS installer
npm run build:mac    # macOS DMG (run on a Mac)
```

`desktop:win` / `desktop:mac` are aliases of `npm run desktop` (same cross-platform dev command).

### Headless (`localmodd`)

```bash
npm run cli -- --model D:\models\something.gguf --ngl 20 --airplane
```

OpenAI-style API (when started from the UI or CLI): `http://127.0.0.1:4782/v1/chat/completions`

## Highlights

- **Context pie** — live mix of messages / voice / images vs window size; smart compact + pins
- **Memory tree** — sacred main timeline with Pivot bifurcations (branch from any message)
- **Agent** — workspace coding agent with voice notes, image inbox, and optional Chat context
- **Vision** — attach / paste / drop images in Chat (Ollama & OpenAI-compatible backends)
- **Voice** — Browser speech or local Whisper CLI (WebM→WAV via ffmpeg when available)

## Stack

- **React 19** + Vite + React Router (`HashRouter` for Electron)
- **Electron** shell for Mac + Windows (supported desktop path)
- **Node engine** sidecar for inference, HF, RAG, voice, agents

## Inference

Install [llama.cpp](https://github.com/ggml-org/llama.cpp) so `llama-server` is on PATH, or set **LLM → llama-server path**.

Alternatively run [Ollama](https://ollama.com) locally and use Tools → Race against `http://127.0.0.1:11434`.

GPU: NVIDIA (`nvidia-smi` VRAM HUD + `-ngl`), Apple Metal when llama-server is a Metal build, Vulkan/CPU otherwise.

## Privacy

- Airplane mode blocks Hugging Face.
- Vault passphrase encrypts chat history (AES-256-GCM).
- Integrity log stores **hashes only**.
- API server defaults to loopback. Confirm before LAN bind.

Remote machines: `ssh -L 8080:127.0.0.1:8080 user@box` then point Localmod at localhost.

## Author

Built by **Smit Gaikwad** ([GitHub](https://github.com/MrSmitG) · [LinkedIn](https://www.linkedin.com/in/mr-smit-gaikwad/)).

## Layout

- `apps/desktop` — React + Electron desktop UI
- `packages/engine` — control plane (inference, HF, RAG, API, MCP, context, voice)
- `apps/cli` — `localmodd`
