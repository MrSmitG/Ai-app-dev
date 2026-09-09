# The Trench

Deep-work editor

This is a **standalone Vite + React** app. It only does this app's work.

## Setup

From the Localmod repo root (installs React/Vite once):

```bash
npm install
npm --prefix apps/desktop install
```

Then start **this** app:

```bash
npm run trench
```

Or from this folder:

```bash
npx vite --host 127.0.0.1 --strictPort
```

- Windows: `Start-Windows.bat`
- macOS: `Start-macOS.command`

UI: `http://127.0.0.1:1425` · engine: `http://127.0.0.1:4781`

## This app's tasks

- Inline-edit one file
- Preview / apply
- Local API for VS Code

## Not this app

- Multi-file plans → Nightweaver
- Autonomous CLI → Ironmantis
- General chat → Blackwhale

Start another app when you want it (`npm run blackwhale`, `npm run nightweaver`, …).
