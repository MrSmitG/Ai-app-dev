# Localmod

Local-first **React + Electron** desktop studio for open-weight models (Windows, macOS, Linux). Chat with smart context (pie meter), Loki-style memory tree pivots, LM Studio-style LLM controls, Hugging Face GGUF downloads, agents, skills, Harbor data, voice, images, local RAG, OpenAI-style API, MCP, and Ollama race.

This is original MIT-licensed software. It is not a fork of LM Studio or G0DM0D3.

## Download (click an icon)

No Node.js, Git, or terminal. Files come from [GitHub Releases](https://github.com/mrsmitg/ai-app-dev/releases/latest). After the file finishes, **click the Localmod icon** to run.

| | |
|---|---|
| **[Windows](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.exe)** | Click the Windows icon / this link. Then click `Localmod.exe` (or the desktop Localmod shortcut). |
| **[macOS](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.dmg)** | Click the Apple icon. Open the DMG, drag Localmod to Applications, click the icon. |
| **[Linux](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.AppImage)** | Click the Linux icon. Then double-click `Localmod.AppImage`. |

In the app, **About** shows the same three OS icons.

If a download 404s, the latest GitHub Release is still building. Tag `v0.2.0` (or newer) so Actions can attach `Localmod.exe`, `Localmod.dmg`, and `Localmod.AppImage`.

## Why not a public blockchain

Publishing chats or hashes on a public chain exposes them. Localmod keeps data on your machine: airplane mode, `127.0.0.1` binds, an AES-GCM vault, and a **local** integrity hash chain.

## Run from source (developers)

Requires **Node.js 20+**.

```bash
npm install
npm --prefix apps/desktop install
npm run desktop
```

That starts:
1. Local engine (`http://127.0.0.1:4781`)
2. React UI (Vite on `1420`)
3. **Electron** desktop window

Browser-only (no Electron window — use this in Cloud Agents):

```bash
npm run dev:web
```

### Package installers

```bash
npm run build:win    # Localmod.exe + Localmod-Setup.exe
npm run build:mac    # Localmod.dmg (run on a Mac)
npm run build:linux  # Localmod.AppImage
```

Artifacts land in `release/`. GitHub Actions on `v*` tags uploads those stable names.

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

## Layout

- `apps/desktop` — React + Electron desktop UI
- `packages/engine` — control plane (inference, HF, RAG, API, MCP, context, voice)
- `apps/cli` — `localmodd`
