// Bundle-size budget: measures gzipped size of the shipped entry bundles and
// fails if any exceeds its budget. content.js is the one that matters most — it
// loads at document_start and directly delays vk.ru rendering. Run after build.
//
// Budgets are in KB (gzip) with ~15% headroom over the current size; bump them
// deliberately (in this file, in the same PR) when a feature genuinely needs it,
// so growth is a conscious decision visible in review.
//
// EVERY built browser is checked against the SAME budgets (the JS is ~identical
// across chrome/firefox/opera — only per-browser `define`s differ). Firefox is
// held to the same original limits, not a looser per-browser number.

import { existsSync, readFileSync, readdirSync } from 'fs';
import { gzipSync } from 'zlib';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSERS = ['chrome', 'firefox', 'opera'];

// file (relative to dist/<browser>) → budget in KB (gzip). '<dir>/*.js' = sum of
// all .js in that dir.
const BUDGETS = {
  // content.js runs at document_start on every vk.ru page. The heavy HLS→MP3
  // encoder (hls.js + lamejs) is NO LONGER here — it ships as audio-encoder.js
  // and is injected on demand by the background (chrome.scripting, ISOLATED
  // world) only when a download starts. This budget guards that hot path and
  // would trip immediately if the encoder ever got re-bundled into content.
  'content.js':       150,
  'background.js':    12,
  'embed.js':         6,
  'site-bridge.js':   4,
  // On-demand audio encoder (hls.js/light + lamejs). Large by design, but off
  // the document_start path — pulled in only for the audio-download feature.
  'audio-encoder.js': 200,
  // PDF-экспорт диалога. Всё это работает в отдельном extension-контексте
  // (offscreen-документ или служебная вкладка) и грузится только когда экспорт
  // реально запущен, поэтому на страницы vk.ru не влияет. Раскладка:
  //   pdf-renderer.js — entry страницы: приём чанков диалога по port;
  //   pdf-render.js   — ленивый чанк рендерера, подтягивается сразу после старта;
  //   pdf-vendor-*    — html2canvas и jsPDF (+fast-png/fflate/iobuffer), а также
  //                     опциональные зависимости jsPDF (canvg + DOMPurify),
  //                     которые он импортирует динамически.
  'pdf-renderer.js':  4,
  'pdf-render.js':    3,
  'pdf-vendor-html2canvas.js': 54,
  'pdf-vendor-jspdf.js': 145,
  'pdf-vendor-index.es.js': 60,
  'pdf-vendor-purify.es.js': 20,
  'assets/popup.js':  105,
  // popup JS: entry + vendor chunks (react/i18next) + all lazily-loaded tab/section
  // chunks. This is a DISK SUM — with aggressive subpage-splitting the user never
  // loads it all at once (popup open ≈ entry+vendors ~119 KB; opening the heaviest
  // tab adds ≤18 KB; a section ≤6 KB). Splitting deliberately trades a few KB of
  // disk total (worse per-chunk gzip + boilerplate) for ~40% smaller per-tab loads,
  // so the budget carries ~15% headroom over that total per this file's convention.
  // Translation dictionaries are NOT here — they ship as data under locales/.
  'assets/*.js':      260,
  // Lazy per-(language, namespace) translation JSON chunks (see popup/i18n.ts +
  // vite chunkFileNames). Data, not code — loaded on demand, only the active
  // language at runtime. Budget covers BOTH languages shipped on disk.
  'locales/*.js':     72,
};

function sizeOf(dist, pattern) {
  // '<dir>/*.js' → sum gzip of every .js in <dir>.
  const dirGlob = pattern.match(/^(.+)\/\*\.js$/);
  if (dirGlob) {
    let total = 0;
    for (const f of readdirSync(resolve(dist, dirGlob[1]))) {
      if (f.endsWith('.js')) total += gzipSync(readFileSync(resolve(dist, dirGlob[1], f))).length;
    }
    return total / 1024;
  }
  return gzipSync(readFileSync(resolve(dist, pattern))).length / 1024;
}

let failed = false;

for (const browser of BROWSERS) {
  const dist = resolve(root, 'dist', browser);
  if (!existsSync(dist)) continue; // only built browsers are checked

  console.log(`\nBundle size budget (gzip) — ${browser}:\n`);
  console.log('  ' + 'file'.padEnd(20) + 'size'.padStart(10) + 'budget'.padStart(10) + '   usage');

  for (const [file, budget] of Object.entries(BUDGETS)) {
    let size;
    try {
      size = sizeOf(dist, file);
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
}

if (failed) {
  console.error('\n❌ Bundle size budget exceeded. Trim the code or bump the budget in scripts/check-size.mjs (consciously).');
  process.exit(1);
}
console.log('\n✅ All bundles within budget.');
