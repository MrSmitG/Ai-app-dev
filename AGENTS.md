# Localmod — agent notes

## Cursor Cloud specific instructions

### Product

Localmod is a local-first **React Router 7** framework app (SPA) with an Electron shell for open-weight models (Windows & macOS). The Node engine sidecar plus React Router UI is the path that works in Cloud Agents; Electron packaging is for local Mac/Windows builds.

### Required services (dev)

| Service | Command | URL | Required? |
| --- | --- | --- | --- |
| Engine + React UI (browser) | `npm run dev:web` | UI `http://127.0.0.1:1420`, engine `http://127.0.0.1:4781` | **Yes** in Cloud Agents |
| Full desktop (engine + UI + Electron) | `npm run desktop` | Electron window + same URLs | Prefer on Mac/Windows hosts; Electron may be awkward in cloud VMs |
| Engine only | `npm run dev:engine` | `http://127.0.0.1:4781` | Alternative |
| llama-server / Ollama | External | Inference backends | Optional for UI; required for real model chat |

### Install

Root and desktop both need install (`react-router dev` runs under `apps/desktop`):

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

- Default `npm run dev` / `npm start` now launches **Electron** (`npm run desktop`). In Cloud Agents use **`npm run dev:web`** instead (engine + React Router, no Electron window).
- Engine binds `127.0.0.1:4781`. If the port is in use, Localmod reuses it.
- Chat vault lives under `~/.localmod/`. Save chats as `{ "threads": [...] }`.
- New engine modules include context meter, Cursor agent, skills, voice, folder picker, and **bundles** (`GET /bundles`, `POST /bundles/use`).
- Bundles tab lets users turn on curated packs (starter chat, vision, voice, RAG, agent, privacy). Chat-model packs are exclusive; feature packs stack.
- Suite apps are **six different React products** (own layout, CSS, Vite): Blackwhale chat 1421, Nightweaver IDE 1422, Obsidian vault 1423, Mako HUD 1424, The Trench editor 1425, Ironmantis terminal 1426. Start with `npm run blackwhale`, then `npm run nightweaver`, and so on. The hub on 1420 does not embed them.
- Suite tab installs to a chosen folder path on Mac and Windows (`GET /install`, `POST /install/pick`, `POST /install`).
- Full chat completions need `llama-server` or Ollama. Without a loaded model, vault / RAG / settings / UI still work.
- Do not commit Hugging Face tokens or vault passphrases.
