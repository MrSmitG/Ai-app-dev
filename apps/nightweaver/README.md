# Nightweaver

Agentic coding

This is a **standalone Vite + React** app. It only does this app's work.

## Setup

From the Localmod repo root (installs React/Vite once):

```bash
npm install
npm --prefix apps/desktop install
```

Then start **this** app:

```bash
npm run nightweaver
```

Or from this folder:

```bash
npx vite --host 127.0.0.1 --strictPort
```

- Windows: `Start-Windows.bat`
- macOS: `Start-macOS.command`

UI: `http://127.0.0.1:1422` · engine: `http://127.0.0.1:4781`

## This app's tasks

- Index a project folder
- Search the tree
- Plan and apply multi-file edits

## Not this app

- Open-ended chat → Blackwhale
- Keys → Obsidian
- Single-file polish → The Trench
- CLI → Ironmantis

Start another app when you want it (`npm run blackwhale`, `npm run nightweaver`, …).
