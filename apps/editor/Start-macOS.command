#!/bin/bash
cd "$(dirname "$0")/../.."
if [ -x "./Start-macOS.command" ]; then
  bash "./Start-macOS.command" &
fi
sleep 4
open "http://127.0.0.1:1420/editor"
