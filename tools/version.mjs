#!/usr/bin/env node
// Bump the version everywhere it appears, so no string is left behind:
// manifest.json (version + the name label used while testing), the preview
// harness chip, and the README. Run: node tools/version.mjs [patch|minor|major|x.y.z]
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'extension/manifest.json';
const SYNCED = ['tools/preview.html', 'README.md'];

const manifestPath = new URL(`../${MANIFEST}`, import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const current = manifest.version;

function nextVersion(kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [major, minor, patch] = current.split('.').map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`usage: version.mjs [patch|minor|major|x.y.z] (got "${kind}")`);
}

const next = nextVersion(process.argv[2] ?? 'patch');
if (next === current) {
  console.log(`already at ${current}`);
  process.exit(0);
}

manifest.version = next;
manifest.name = manifest.name.replace(/v\d+\.\d+\.\d+/, `v${next}`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

for (const relative of SYNCED) {
  const path = new URL(`../${relative}`, import.meta.url).pathname;
  const before = readFileSync(path, 'utf8');
  const after = before.split(`v${current}`).join(`v${next}`);
  if (after === before) console.warn(`  ${relative}: no "v${current}" found to update`);
  else writeFileSync(path, after);
}

console.log(`${current} -> ${next}`);
