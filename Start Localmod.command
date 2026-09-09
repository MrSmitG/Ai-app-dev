#!/bin/bash
# Download the ready-to-run React desktop app from GitHub. No Node.js or npm.
set -euo pipefail
cd "$(dirname "$0")"
URL="https://github.com/mrsmitg/ai-app-dev/releases/latest/download/Localmod.dmg"
DIR="${HOME}/Library/Application Support/Localmod"
APP="${DIR}/Localmod.dmg"
if [[ -f "./Localmod.dmg" ]]; then
  APP="$(pwd)/Localmod.dmg"
fi
if [[ -d "/Applications/Localmod.app" ]]; then
  open -a Localmod
  exit 0
fi
mkdir -p "$DIR"
if [[ ! -f "$APP" ]]; then
  echo "Downloading Localmod for macOS..."
  echo "$URL"
  curl -fL --retry 3 --retry-delay 2 -o "$APP" "$URL"
fi
open "$APP"
echo "Drag Localmod to Applications if asked, then click the Localmod icon."
