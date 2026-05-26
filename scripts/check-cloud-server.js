#!/usr/bin/env node
/** Start cloud relay + agent. Requires data server already running (npm run dev or dev:server). */
const net = require('net');

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

(async () => {
  const serverUp = await portOpen(3847);
  if (!serverUp) {
    console.error('[cloud:dev] No data server on port 3847.');
    console.error('  Start one first:  npm run dev   OR   npm run dev:server');
    console.error('  Or use full stack: npm run cloud:dev:full');
    process.exit(1);
  }
  console.log('[cloud:dev] Data server detected on :3847 — starting relay + agent');
})();
