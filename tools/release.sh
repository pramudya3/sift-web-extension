#!/usr/bin/env bash
# Cut a release: bump the version, run every check, build the zip, commit, tag,
# push, and publish the zip as a GitHub release — so installing Sift never
# requires cloning the repo.
#
#   bash tools/release.sh            # patch bump  (0.14.0 -> 0.14.1)
#   bash tools/release.sh minor      # minor bump
#   bash tools/release.sh 0.14.0     # publish the current version as-is
#
# Requires: gh (authenticated), a clean working tree, and the branch already
# pushed so the tag lands on a commit GitHub can see.
set -euo pipefail
cd "$(dirname "$0")/.."

BUMP="${1:-patch}"

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit or stash first"; exit 1
fi

echo "▸ version"
node tools/version.mjs "$BUMP"
VERSION="$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")"
TAG="v$VERSION"

echo "▸ checks"
node extension/test/store.test.mjs
python3 tools/contrast.py

echo "▸ screenshots + zip"
bash tools/shot.sh light >/dev/null
bash tools/shot.sh dark >/dev/null
bash tools/shot.sh light save >/dev/null
# no piping into head/awk here: with pipefail an early-closed pipe kills the script
bash tools/pack.sh >/dev/null
ZIP="dist/sift-extension-$TAG.zip"
[ -f "$ZIP" ] || { echo "✗ expected $ZIP"; exit 1; }
echo "  $ZIP ($(du -h "$ZIP" | cut -f1 | tr -d ' '))"

echo "▸ commit, tag, push"
git add -A
# publishing the current version on purpose leaves nothing to commit
git diff --cached --quiet || git commit -q -m "Release $TAG"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "✗ tag $TAG already exists — bump the version instead"; exit 1
fi
git tag -a "$TAG" -m "Sift $TAG"
git push -q
git push -q origin "$TAG"

NOTES="$(mktemp)"
cat > "$NOTES" <<EOF
**Download \`sift-extension-$TAG.zip\` below** — no clone, no build step, no Node.

### Install

1. Unzip the download
2. \`chrome://extensions\` (or \`brave://extensions\`, \`edge://extensions\`)
3. Turn on **Developer mode**
4. **Load unpacked** → pick the unzipped folder
5. Click the Sift icon → the side panel opens

Works on any Chromium browser 114+: Chrome, Brave, Edge, Opera, Vivaldi.

### Updating

An unpacked install does not auto-update. Download the newer zip, unzip over the
same folder, then hit ⟳ on the extension card and reopen the side panel — your
saved projects live in \`chrome.storage.local\`, not in the folder, so they survive.

### Notes

- No account, no server, no network calls. Projects stay in the browser profile.
- This is a pre-store build: unpacked installs show a "developer mode" warning.
- \`chrome://extensions\` shows the version; the panel header stamps it too.
EOF

echo "▸ github release"
gh release create "$TAG" "dist/sift-extension-$TAG.zip" \
  --title "Sift $TAG" \
  --notes-file "$NOTES" \
  --latest
rm -f "$NOTES"

echo "✓ released $TAG"
