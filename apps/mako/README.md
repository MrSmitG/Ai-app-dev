# Mako

Speed / race

This is a **standalone Vite + React** app. It only does this app's work.

## Setup

From the Localmod repo root (installs React/Vite once):

```bash
npm install
npm --prefix apps/desktop install
```

Then start **this** app:

```bash
npm run mako
```

Or from this folder:

```bash
npx vite --host 127.0.0.1 --strictPort
```

- Windows: `Start-Windows.bat`
- macOS: `Start-macOS.command`

UI: `http://127.0.0.1:1424` · engine: `http://127.0.0.1:4781`

## This app's tasks

- Ping backends
- Race one prompt
- Show lowest latency

## Not this app

- Entering keys → Obsidian
- Chat threads → Blackwhale
- CLI → Ironmantis

Start another app when you want it (`npm run blackwhale`, `npm run nightweaver`, …).
