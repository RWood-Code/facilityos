#!/usr/bin/env node
/** Copy Server + Terminal installers and auto-update metadata into dist-electron/ for GitHub release upload. */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'dist-electron');
const serverDir = path.join(root, 'dist-electron-server');
const clientDir = path.join(root, 'dist-electron-client');

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) {
    console.warn('[release] missing:', from);
    return false;
  }
  fs.copyFileSync(from, to);
  console.log('[release] copied', path.basename(to));
  return true;
}

if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });

for (const dir of [serverDir, clientDir]) {
  if (!fs.existsSync(dir)) {
    console.error('[release] build output not found:', dir);
    process.exit(1);
  }
  for (const name of fs.readdirSync(dir)) {
    if (/\.(exe|yml|blockmap)$/i.test(name)) {
      copyIfExists(path.join(dir, name), path.join(out, name));
    }
  }
}

console.log('[release] assets ready in dist-electron/');
