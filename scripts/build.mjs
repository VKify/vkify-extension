// Orchestrates the split build (see vite.config.ts header).
//
//   1. modules target   → popup + background (ES), wipes dist, emits manifest
//   2. each classic entry → self-contained IIFE appended into the same dist
//
// Pass --dev to produce a dev build (keeps console.*, injects the
// http://localhost/* site-bridge match into the manifest).

import { build } from 'vite';
import { CLASSIC_ENTRY_NAMES } from './classic-entries.mjs';

const mode = process.argv.includes('--dev') ? 'development' : 'production';

async function run(target) {
  process.env.VKIFY_TARGET = target;
  await build({ mode, logLevel: 'warn' });
}

console.log(`[vkify] Building (${mode})…`);

await run('modules');
console.log('✓ modules (popup + background)');

for (const name of CLASSIC_ENTRY_NAMES) {
  await run(`classic:${name}`);
  console.log(`✓ classic: ${name}`);
}

console.log('\n✅ Extension build complete!\n');
