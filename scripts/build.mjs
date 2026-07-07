// Orchestrates the split, per-browser build (see vite.config.ts header).
//
//   For each target browser (chrome | firefox | opera):
//     1. modules target    → popup + background (ES), wipes dist/<browser>,
//                             emits the merged manifest for that browser
//     2. each classic entry → self-contained IIFE appended into dist/<browser>
//
// Usage:
//   node scripts/build.mjs                  → chrome (default)
//   node scripts/build.mjs --browser=firefox
//   node scripts/build.mjs --all            → chrome + firefox + opera
//   node scripts/build.mjs --dev            → dev build (keeps console.*, adds
//                                             http://localhost/* site-bridge match)

import { build } from 'vite';
import { CLASSIC_ENTRY_NAMES } from './classic-entries.mjs';

const SUPPORTED = ['chrome', 'firefox', 'opera'];

const mode = process.argv.includes('--dev') ? 'development' : 'production';

// `--analyze`: build ONLY the chrome modules target (popup + background) with the
// rollup-plugin-visualizer treemap → dist/stats.html. Skips the classic IIFE
// entries (they're single-input and not what we're profiling here). Set as an
// in-process env var so it works cross-platform without shell env syntax.
const analyze = process.argv.includes('--analyze');
if (analyze) process.env.VKIFY_ANALYZE = '1';

function selectedBrowsers() {
  if (process.argv.includes('--all')) return SUPPORTED;
  const arg = process.argv.find(a => a.startsWith('--browser='));
  const name = arg ? arg.split('=')[1] : 'chrome';
  if (!SUPPORTED.includes(name)) {
    throw new Error(`[vkify] Unknown browser "${name}". Supported: ${SUPPORTED.join(', ')}`);
  }
  return [name];
}

async function run(browser, target) {
  process.env.VKIFY_BROWSER = browser;
  process.env.VKIFY_TARGET = target;
  await build({ mode, logLevel: 'warn' });
}

for (const browser of selectedBrowsers()) {
  console.log(`\n[vkify] Building ${browser} (${mode}) → dist/${browser}…`);

  await run(browser, 'modules');
  console.log('✓ modules (popup + background)');

  if (analyze) {
    console.log('✓ analyze: treemap → dist/stats.html (modules only, classic entries skipped)');
    continue;
  }

  for (const name of CLASSIC_ENTRY_NAMES) {
    await run(browser, `classic:${name}`);
    console.log(`✓ classic: ${name}`);
  }

  console.log(`✅ ${browser} build complete → dist/${browser}`);
}

console.log('\n✅ Extension build(s) complete!\n');
