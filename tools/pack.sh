#!/usr/bin/env bash
# Package the extension as a store-ready zip: manifest.json at the zip root,
# no dev files (tests, package.json). Same artifact works for "load unpacked"
# (after unzip) and for Chrome Web Store upload.
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP="$(date +%Y%m%d-%H%M)"
VERSION="$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")"
OUT="dist/tabrary-v$VERSION.zip"
mkdir -p dist
rm -f dist/tabrary-*.zip dist/sift-extension*.zip

(cd extension && zip -qr "../$OUT" . -x 'test/*' 'package.json' '.DS_Store' '*/.DS_Store' '*.md')

echo "→ $OUT (built $STAMP)"
echo "  reload it: chrome://extensions → Tabrary → ⟳, then close + reopen the side panel"
unzip -l "$OUT" | sed -n '2,40p'
