// Bundle-size budget: measures gzipped size of the shipped entry bundles and
// fails if any exceeds its budget. content.js is the one that matters most — it
// loads at document_start and directly delays vk.com rendering. Run after build.
//
// Budgets are in KB (gzip) with ~15% headroom over the current size; bump them
// deliberately (in this file, in the same PR) when a feature genuinely needs it,
// so growth is a conscious decision visible in review.

import { readFileSync, readdirSync } from 'fs';
import { gzipSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(root, 'dist', 'chrome'); // JS is ~identical across browsers; chrome is the reference

// file (relative to dist/chrome) → budget in KB (gzip). '*' = lazy popup chunks total.
const BUDGETS = {
  'content.js':       70,
  'background.js':    10,
  'embed.js':         6,
  'site-bridge.js':   4,
  'assets/popup.js':  80,
  'assets/*.js':      185, // popup entry + all lazily-loaded tab chunks
};

function gzKB(buf) {
  return gzipSync(buf).length / 1024;
}

function sizeOf(pattern) {
  if (pattern === 'assets/*.js') {
    let total = 0;
    for (const f of readdirSync(resolve(DIST, 'assets'))) {
      if (f.endsWith('.js')) total += gzipSync(readFileSync(resolve(DIST, 'assets', f))).length;
    }
    return total / 1024;
  }
  return gzKB(readFileSync(resolve(DIST, pattern)));
}

console.log('Bundle size budget (gzip):\n');
console.log('  ' + 'file'.padEnd(20) + 'size'.padStart(10) + 'budget'.padStart(10) + '   usage');

let failed = false;
for (const [file, budget] of Object.entries(BUDGETS)) {
  let size;
  try {
    size = sizeOf(file);
  } catch {
    console.log('  ' + file.padEnd(20) + '       — (missing)');
    continue;
  }
  const pct = (size / budget) * 100;
  const over = size > budget;
  if (over) failed = true;
  const bar = over ? '❌' : pct > 90 ? '⚠️ ' : '✅';
  console.log(
    '  ' + file.padEnd(20) +
    `${size.toFixed(1)} KB`.padStart(10) +
    `${budget} KB`.padStart(10) +
    `   ${pct.toFixed(0)}% ${bar}`,
  );
}

if (failed) {
  console.error('\n❌ Bundle size budget exceeded. Trim the code or bump the budget in scripts/check-size.mjs (consciously).');
  process.exit(1);
}
console.log('\n✅ All bundles within budget.');
