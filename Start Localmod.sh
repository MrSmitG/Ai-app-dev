#!/bin/bash
# Download the ready-to-run React desktop app from GitHub. No Node.js or npm.
set -euo pipefail
cd "$(dirname "$0")"
URL="https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.AppImage"
DIR="${XDG_DATA_HOME:-$HOME/.local/share}/Localmod"
APP="${DIR}/Localmod.AppImage"
if [[ -f "./Localmod.AppImage" ]]; then
  APP="$(pwd)/Localmod.AppImage"
fi
mkdir -p "$DIR"
if [[ ! -f "$APP" ]]; then
  echo "Downloading Localmod for Linux..."
  echo "$URL"
  curl -fL --retry 3 --retry-delay 2 -o "$APP" "$URL"
fi
chmod +x "$APP"
echo "Starting Localmod..."
exec "$APP" --no-sandbox "$@"
