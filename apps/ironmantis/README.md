# Ironmantis

Autonomous builder

This is a **standalone Vite + React** app. It only does this app's work.

## Setup

From the Localmod repo root (installs React/Vite once):

```bash
npm install
npm --prefix apps/desktop install
```

Then start **this** app:

```bash
npm run ironmantis
```

Or from this folder:

```bash
npx vite --host 127.0.0.1 --strictPort
```

- Windows: `Start-Windows.bat`
- macOS: `Start-macOS.command`

UI: `http://127.0.0.1:1426` · engine: `http://127.0.0.1:4781`

## This app's tasks

- Multi-step autonomous tasks
- Read/write files
- Allowlisted CLI

## Not this app

- Single-file edit → The Trench
- Search-plan without CLI → Nightweaver
- Chat → Blackwhale

Start another app when you want it (`npm run blackwhale`, `npm run nightweaver`, …).
