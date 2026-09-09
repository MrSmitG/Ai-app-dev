# Blackwhale

Chat — deep-sea hub

This is a **standalone Vite + React** app. It only does this app's work.

## Setup

From the Localmod repo root (installs React/Vite once):

```bash
npm install
npm --prefix apps/desktop install
```

Then start **this** app:

```bash
npm run blackwhale
```

Or from this folder:

```bash
npx vite --host 127.0.0.1 --strictPort
```

- Windows: `Start-Windows.bat`
- macOS: `Start-macOS.command`

UI: `http://127.0.0.1:1421` · engine: `http://127.0.0.1:4781`

## This app's tasks

- Chat with the loaded model
- Keep the thread on this machine

## Not this app

- Multi-file coding → Nightweaver
- API keys → Obsidian
- Races → Mako
- Inline edit → The Trench
- CLI loops → Ironmantis

Start another app when you want it (`npm run blackwhale`, `npm run nightweaver`, …).
