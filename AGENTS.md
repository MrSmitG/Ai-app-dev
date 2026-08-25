# Localmod — agent notes

## Cursor Cloud specific instructions

### Product

Localmod is a local-first desktop studio for open-weight models (Node engine + React UI; Rust/Tauri layout exists but is optional until a full native build is needed).

### Required services (dev)

| Service | Command | URL | Required? |
| --- | --- | --- | --- |
| Engine + Vite UI | `npm run dev` (from repo root) | UI `http://localhost:1420`, engine `http://127.0.0.1:4781` | Yes |
| Engine only | `npm run dev:engine` | `http://127.0.0.1:4781` | Alternative |
| llama-server / Ollama | External binaries on PATH or Settings | Inference backends | Optional for UI/engine; required for real model chat |

### Install

Root lockfile + desktop app both need install (desktop deps are not hoisted for `npx vite` under `apps/desktop`):

```bash
npm ci
npm --prefix apps/desktop ci
```

### Lint / test / build

- No dedicated lint or unit-test scripts are defined in root `package.json` yet.
- Production UI build: `npm run build` (runs Vite build in `apps/desktop`).
- CLI: `npm run cli -- ...` (see README).

### Non-obvious gotchas

- `npm run dev` starts the engine on `127.0.0.1:4781` and spawns Vite from `apps/desktop`. If the engine port is already in use, Localmod reuses it and still starts the UI.
- Chat vault uses AES-GCM under `~/.localmod/`. After `POST /vault/setup`, save chats as `{ "threads": [...] }` (not a bare array).
- Full chat completions need `llama-server` (or Ollama). Without a loaded model, the UI and engine still work for vault, settings, RAG collections, hardware, and API controls.
- Airplane mode and HF token live in Settings / Options; do not commit secrets.
- Rust workspace (`Cargo.toml`) is for the Tauri path; Node sidecar is the supported Cloud Agent path unless `rustc`/Tauri system deps are intentionally installed.
