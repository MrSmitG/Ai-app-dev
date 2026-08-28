# Localmod — agent notes

## Cursor Cloud specific instructions

### Product

Localmod is a local-first **React + Electron** desktop studio for open-weight models (Windows & macOS). The Node engine sidecar plus Vite UI is the path that works in Cloud Agents; Electron packaging is for local Mac/Windows builds.

### Required services (dev)

| Service | Command | URL | Required? |
| --- | --- | --- | --- |
| Engine + Vite UI (browser) | `npm run dev:web` | UI `http://127.0.0.1:1420`, engine `http://127.0.0.1:4781` | **Yes** in Cloud Agents |
| Full desktop (engine + UI + Electron) | `npm run desktop` | Electron window + same URLs | Prefer on Mac/Windows hosts; Electron may be awkward in cloud VMs |
| Engine only | `npm run dev:engine` | `http://127.0.0.1:4781` | Alternative |
| llama-server / Ollama | External | Inference backends | Optional for UI; required for real model chat |

### Install

Root and desktop both need install (`npx vite` runs under `apps/desktop`):

```bash
npm ci
npm --prefix apps/desktop ci
```

If `npm ci` fails with a lockfile mismatch, run `npm install` / `npm --prefix apps/desktop install` once and commit the refreshed lockfiles.

### Lint / test / build

- No dedicated lint or unit-test scripts in root `package.json` yet.
- UI build: `npm run build`
- Desktop installers (local): `npm run build:win` / `npm run build:mac` (needs electron-builder; mac DMG should be built on a Mac)

### Non-obvious gotchas

- Default `npm run dev` / `npm start` now launches **Electron** (`npm run desktop`). In Cloud Agents use **`npm run dev:web`** instead (engine + Vite, no Electron window).
- Engine binds `127.0.0.1:4781`. If the port is in use, Localmod reuses it.
- Chat vault lives under `~/.localmod/`. Save chats as `{ "threads": [...] }`.
- New engine modules include context meter, Cursor agent, skills, voice, folder picker, and **bundles** (`GET /bundles`, `POST /bundles/use`).
- Bundles tab lets users turn on curated packs (starter chat, vision, voice, RAG, agent, privacy). Chat-model packs are exclusive; feature packs stack.
- Full chat completions need `llama-server` or Ollama. Without a loaded model, vault / RAG / settings / UI still work.
- Do not commit Hugging Face tokens or vault passphrases.
