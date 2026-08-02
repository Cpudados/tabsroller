#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_DIR="$ROOT_DIR/icons"
CHROME_BIN="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "Chrome not found at: $CHROME_BIN" >&2
  exit 1
fi

SVG_URL="file:///$(wslpath -m "$ICON_DIR/tabscroll-icon.svg")"

for size in 16 32 48 128; do
  "$CHROME_BIN" \
    --headless \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size="${size},${size}" \
    --virtual-time-budget=1000 \
    --screenshot="$(wslpath -w "$ICON_DIR/tabscroll-${size}.png")" \
    "$SVG_URL"
done
