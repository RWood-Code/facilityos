#!/usr/bin/env node
/**
 * One-time helper: add async/await to handler db calls.
 * Safe to re-run (skips existing await).
 */
const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../shared/db/handlers.js'),
  path.join(__dirname, '../shared/db/handlers-extended.js'),
  path.join(__dirname, '../shared/db/handlers-v15.js'),
];

function asyncify(content) {
  let c = content;

  // h('channel', ( -> h('channel', async (
  c = c.replace(/\bh\(\s*(['`][^'"`]+['`]|`\$\{prefix\}:[^`]+`)\s*,\s*(?!async\s)\(/g, (m) => m.replace(/,\s*\(/, ', async ('));

  // registerCrud inner patterns already use h(`${prefix}:list`,

  // await run(, get(, all( — skip if already awaited
  for (const fn of ['run', 'get', 'all']) {
    c = c.replace(new RegExp(`(?<!await\\s)\\b${fn}\\(`, 'g'), `await ${fn}(`);
  }

  c = c.replace(/await await /g, 'await ');

  // Fix .map on promise: return all(...).map -> const rows = await all(...); return rows.map
  c = c.replace(/return\s+all\(([^;]+)\)\.map\(/g, 'return (await all($1)).map(');

  // writeAudit and enqueueIfCloudEnabled
  c = c.replace(/(?<!await )writeAudit\(/g, 'await writeAudit(');
  c = c.replace(/await await writeAudit/g, 'await writeAudit');
  c = c.replace(/(?<!await )enqueueIfCloudEnabled\(/g, 'await enqueueIfCloudEnabled(');
  c = c.replace(/await await enqueueIfCloudEnabled/g, 'await enqueueIfCloudEnabled');

  return c;
}

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = asyncify(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log('Updated', path.relative(process.cwd(), file));
  } else {
    console.log('No changes', path.relative(process.cwd(), file));
  }
}
