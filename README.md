# Localmod

Local-first **React + Electron** desktop studio for open-weight models (Windows, macOS, and Linux). Chat with smart context, agents, skills, Harbor data, voice, images, local RAG, an OpenAI-style API, MCP, and Ollama race.

This is original MIT-licensed software. It is not a fork of LM Studio or G0DM0D3.

## Download and run (no Node.js)

Grab the latest installer from **[Releases](https://github.com/mrsmitg/ai-app-dev/releases/latest)** and double-click it.

| Platform | File | How to run |
|----------|------|------------|
| Windows | `Localmod-Setup-*.exe` | Run the installer (desktop + Start Menu shortcuts) |
| Windows (portable) | `Localmod-*-portable.exe` | Double-click — no install |
| macOS | `Localmod-*-mac.dmg` | Drag to Applications. If macOS blocks it: right-click the app → **Open** |
| Linux | `Localmod-*-linux.AppImage` | `chmod +x` the file, then double-click or run it |

The packaged app starts the local engine by itself. You do **not** need Node.js, Git, or a terminal.

On first launch, open **Models** to download a GGUF, or use [Ollama](https://ollama.com) if it is already installed. Chat needs a loaded model; vault, settings, and the rest of the UI work immediately.

Unsigned builds: Windows SmartScreen or macOS Gatekeeper may warn on the first open. Choose **More info → Run anyway** (Windows) or right-click **Open** (macOS).

Maintainers: pushing a `v*` tag (for example `git tag v0.2.0 && git push origin v0.2.0`) builds installers on GitHub Actions and attaches them to that release.

## Run from source

Requires **Node.js 20+**.

```bash
npm install
npm --prefix apps/desktop install
npm run desktop
```

| Platform | Launcher |
|----------|----------|
| Windows | Double-click `Start Localmod.bat` |
| macOS | Double-click `Start Localmod.command` |

That starts the engine (`http://127.0.0.1:4781`), the React UI (Vite on `1420`), and an **Electron** window.

Browser-only (no Electron window):

```bash
npm run dev:web
```

### Build installers locally

```bash
npm run build:win     # Windows NSIS + portable (run on Windows)
npm run build:mac     # macOS DMG (run on a Mac)
npm run build:linux   # Linux AppImage
```

Artifacts land in `release/`.

## Why not a public blockchain

Publishing chats or hashes on a public chain exposes them. Localmod keeps data on your machine: airplane mode, `127.0.0.1` binds, an AES-GCM vault, and a **local** integrity hash chain.

### Headless (`localmodd`)

```bash
npm run cli -- --model /path/to/model.gguf --ngl 20 --airplane
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
- **Electron** shell for Mac, Windows, and Linux
- **Node engine** sidecar for inference, HF, RAG, voice, agents (bundled in the installer)

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

## Support

Donations and public notes go through a Web3 wallet on the About tab (Ethereum donate + on-chain message). The account address is configured in `apps/desktop/src/web3.ts` (or `VITE_WEB3_ADDRESS`) once it exists.

## Layout

- `apps/desktop` — React + Electron desktop UI
- `packages/engine` — control plane (inference, HF, RAG, API, MCP, context, voice)
- `apps/cli` — `localmodd`
