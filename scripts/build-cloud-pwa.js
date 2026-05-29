#!/usr/bin/env node
/** Build hosted FacilityOS Cloud manager PWA (static dist/ for CDN). */
const { execSync } = require('child_process');

const relayUrl = process.env.VITE_CLOUD_RELAY_URL || 'http://127.0.0.1:4850';
console.log('[build:cloud] VITE_CLOUD_RELAY_URL =', relayUrl);

execSync('npm run build', {
  stdio: 'inherit',
  env: { ...process.env, VITE_CLOUD_RELAY_URL: relayUrl },
});

console.log('[build:cloud] Done — deploy dist/ to your CDN or serve statically.');
console.log('[build:cloud] Users sign in with site ID + cloud credentials from Settings → Cloud.');
