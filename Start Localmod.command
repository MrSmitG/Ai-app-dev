#!/bin/bash
cd "$(dirname "$0")"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 20+ from https://nodejs.org then run this again."
  echo "Or download an installer from the Releases page — no Node required."
  read -r _
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
if [ ! -d apps/desktop/node_modules ]; then
  npm --prefix apps/desktop install
fi
echo "Starting Localmod desktop app for macOS..."
echo "Engine + React UI + Electron window. Keep this terminal open."
npm run desktop
