const path = require('path');
const fs = require('fs');

/** Resolve Vite dist/ in dev and inside Electron asar (incl. asar.unpacked). */
function getDistPath() {
  const candidates = [path.join(__dirname, '../dist')];

  if (__dirname.includes('app.asar')) {
    const asarRoot = path.join(__dirname, '..');
    candidates.push(path.join(asarRoot.replace('app.asar', 'app.asar.unpacked'), 'dist'));
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'dist'));
    }
  }

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return candidates[0];
}

module.exports = { getDistPath };
