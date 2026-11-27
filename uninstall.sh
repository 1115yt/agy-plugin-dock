#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="$HOME/.gemini/config/plugins/agy-plugin-dock"
if [ -d "$TARGET_DIR" ]; then
  rm -rf "$TARGET_DIR"
  echo "[agy-plugin-dock] Removed $TARGET_DIR"
else
  echo "[agy-plugin-dock] Not installed ($TARGET_DIR does not exist)."
fi
