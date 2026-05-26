#!/usr/bin/env node
/** Build dist/ once if missing so phones/tablets can open http://<server-ip>:3847 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distIndex = path.join(__dirname, '../dist/index.html');

if (fs.existsSync(distIndex)) {
  process.exit(0);
}

console.log('[FacilityOS] Building web UI for phone & tablet access (one-time)…');
execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
console.log('[FacilityOS] Web UI ready at port 3847');
