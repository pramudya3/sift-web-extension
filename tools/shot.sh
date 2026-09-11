#!/usr/bin/env bash
# Screenshot the UI preview: bash tools/shot.sh [light|dark]
# Uses any Chromium-based browser found on the machine.
set -euo pipefail
cd "$(dirname "$0")/.."

BROWSER=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "$(command -v chromium || true)" \
  "$(command -v google-chrome || true)"; do
  [ -x "$candidate" ] && BROWSER="$candidate" && break
done
[ -n "$BROWSER" ] || { echo "no chromium-based browser found"; exit 1; }

MODE="${1:-light}"
STATE="${2:-list}"
FLAGS=(--headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2)

SUFFIX=""; [ "$STATE" = "save" ] && SUFFIX="-save"
OUT="docs/preview-$MODE$SUFFIX.png"
mkdir -p docs
"$BROWSER" "${FLAGS[@]}" --window-size=440,780 \
  --screenshot="$PWD/$OUT" "file://$PWD/tools/preview.html?theme=$MODE&state=$STATE" 2>/dev/null

echo "→ $OUT"
