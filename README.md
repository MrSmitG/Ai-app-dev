# Localmod

A **React** desktop suite you download and run on **Windows and macOS**. Six standalone React apps — **Blackwhale**, **Nightweaver**, **Obsidian**, **Mako**, **The Trench**, **Ironmantis**. Start one, then start the next.

This is original MIT-licensed software. It is not a fork of LM Studio, Cursor, or G0DM0D3.

## Suite

| App | Usage | Files | Start |
|---|---|---|---|
| **Blackwhale** | Chat — deep-sea hub | `apps/blackwhale` | `npm run blackwhale` → `:1421` |
| **Nightweaver** | Agentic coding — webs of code | `apps/nightweaver` | `npm run nightweaver` → `:1422` |
| **Obsidian** | API keys — unbreakable vault | `apps/obsidian` | `npm run obsidian` → `:1423` |
| **Mako** | Speed — fastest in the water | `apps/mako` | `npm run mako` → `:1424` |
| **The Trench** | Editor — deep work | `apps/trench` | `npm run trench` → `:1425` |
| **Ironmantis** | Autonomous builder | `apps/ironmantis` | `npm run ironmantis` → `:1426` |

Each app is a **different React product** (own `App.tsx`, CSS, fonts, layout) — not one shell with six titles. The engine stays on `127.0.0.1:4781`. Double-click `Start-Windows.bat` or `Start-macOS.command` inside an app folder to launch just that app.

## Install to a folder

In the app open **Suite**, type or browse a folder path, then:

- **Copy all files here** — copies this React suite into `{folder}/Localmod/` (Mac and Windows)
- **Download Windows** — saves `Localmod.exe` into that folder
- **Download Mac** — saves `Localmod.dmg` into that folder
- **Download all Android APKs** — saves `blackwhale.apk`, `nightweaver.apk`, `obsidian.apk`, `mako.apk`, `trench.apk`, and `ironmantis.apk` into that folder

Then run `Start Localmod.bat` (Windows) or `Start Localmod.command` (macOS). Each app folder also has its own Start script.

## Download and run

No install toolchain. Files come from [GitHub Releases](https://github.com/mrsmitg/ai-app-dev/releases/latest). After the file finishes, **click the Localmod icon**.

If you cloned this repo, double-click **Start Localmod** instead — it downloads that same ready-to-run app (`.bat` on Windows, `.command` on Mac, `.sh` on Linux).

| | |
|---|---|
| **[Windows](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.exe)** | Click the Windows icon / this link. Then click `Localmod.exe` (or the desktop Localmod shortcut). |
| **[macOS](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.dmg)** | Click the Apple icon. Open the DMG, drag Localmod to Applications, click the icon. |
| **[Linux](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.AppImage)** | Click the Linux icon. Then double-click `Localmod.AppImage`. |
| **[blackwhale.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/blackwhale.apk)** | Chat app. Allow unknown apps, then tap to install. |
| **[nightweaver.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/nightweaver.apk)** | Agentic coding app. Installs next to Blackwhale. |
| **[obsidian.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/obsidian.apk)** | API-key vault. |
| **[mako.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/mako.apk)** | Speed / race HUD. |
| **[trench.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/trench.apk)** | One-file editor. |
| **[ironmantis.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/ironmantis.apk)** | Autonomous builder. |

In the app, **About** shows the desktop OS icons plus one Android tile per APK.

If a download 404s, the latest GitHub Release is still building. Tag `v0.2.3` (or newer) so Actions can attach `Localmod.exe`, `Localmod.dmg`, `Localmod.AppImage`, and the six `*.apk` files.

## Why not a public blockchain

Publishing chats or hashes on a public chain exposes them. Localmod keeps data on your machine: airplane mode, `127.0.0.1` binds, an AES-GCM vault, and a **local** integrity hash chain.

## Run from source (developers)

Requires **Node.js 20+**.

```bash
npm install
```

Start **one React app at a time** (the first command also starts the engine on `:4781`):

```bash
npm run blackwhale     # :1421 chat messenger
npm run nightweaver    # :1422 three-column IDE
npm run obsidian       # :1423 API-key vault
npm run mako           # :1424 latency HUD
npm run trench         # :1425 one-file editor
npm run ironmantis     # :1426 autonomous terminal
```

Or double-click `Start-Windows.bat` / `Start-macOS.command` / `Start-Linux.sh` inside an app folder.

```bash
npm run check:apps     # confirm all six setups
npm run build:apps     # production-build all six
```

Hub (React Router + optional Electron):

```bash
npm --prefix apps/desktop install
npm run dev:web      # browser hub on :1420
npm run desktop      # Electron window
```

### Package installers

```bash
npm run build:win    # Localmod.exe + Localmod-Setup.exe
npm run build:mac    # Localmod.dmg (run on a Mac)
npm run build:linux  # Localmod.AppImage
npm run build:android # blackwhale.apk … ironmantis.apk (needs Android SDK)
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

- **React 19** + **React Router 7** (framework mode, SPA) in `apps/desktop`
- **Electron** shell for Mac + Windows (loads the React app)
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

- `apps/desktop` — Localmod hub (install + studio chat + models). Cards launch the six apps on their own ports.
- `apps/blackwhale` — chat messenger (port 1421)
- `apps/nightweaver` — three-column coding IDE (port 1422)
- `apps/obsidian` — API-key vault (port 1423)
- `apps/mako` — latency race HUD (port 1424)
- `apps/trench` — one-file paper editor (port 1425)
- `apps/ironmantis` — autonomous CRT terminal (port 1426)
- `apps/keep`, `apps/hands` — VS Code extensions used by The Trench and Ironmantis
- `packages/engine` — control plane (inference, HF, RAG, API, MCP, context, voice, install-to-path)
- `apps/cli` — `localmodd`
