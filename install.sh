#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/agy-plugin-dock"
TARGET_DIR="$HOME/.gemini/config/plugins/agy-plugin-dock"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Plugin source folder not found: $SOURCE_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp -R "$SOURCE_DIR/." "$TARGET_DIR/"

echo "[agy-plugin-dock] Installed to $TARGET_DIR"
echo "Restart or reload Antigravity if the top-bar icons do not appear automatically."
