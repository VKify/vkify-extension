// Synthetic Chromium benchmark of real VKify modules. No VK login/network.
// Baseline comes from git, without modifying the checkout. No timing assertions.
// node scripts/perf-dom-benchmark.mjs --baseline=4a30b5b --seconds=30 --repeats=2
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const baseline = option('baseline', '4a30b5b');
const seconds = Number(option('seconds', '30'));
const repeats = Number(option('repeats', '2'));
if (!(seconds > 0 && repeats > 0 && Number.isInteger(repeats))) throw new Error('Invalid duration/repeats');
const entry = `
import { createMiniPlayerFeature } from './src/content/features/center/music/playback/mini-player/index.ts';
import { domObserver } from './src/content/core/dom/dom-observer.ts';
import { findReadingScroller } from './src/content/features/center/communities/discussions/reading.ts';
const store = {};
window.chrome = { runtime: { id: 'fixture' }, storage: {
  local: { get: async () => ({ ...store }), set: async patch => Object.assign(store, patch), remove: async key => delete store[key] },
  onChanged: { addListener() {}, removeListener() {} }
}};
const feature = createMiniPlayerFeature({
  getAllSettings: async () => ({ mini_player_visualizer: false }),
  getSetting: async () => null, onStorageChange: () => () => {}, setSetting: async () => {},
  injectScript: name => queueMicrotask(() => window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name } })))
}).music_mini_player;
window.startFixture = async () => {
  await feature.enable();
  // Same scanner used by global reading scroll; no synthetic geometry loop.
  domObserver.observeChanges(findReadingScroller);
  const state = { track: { id: '7_42', title: 'A long test track title', artist: 'Artist', cover: '' }, playing: true, currentTime: 0, duration: 240, volume: .5, rate: 1, controllable: true };
  window.addEventListener('vkify:mini-player:request', () => window.dispatchEvent(new CustomEvent('vkify:mini-player:state', { detail: state })));
};
`;
async function bundle(ref) {
  return (await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, minify: true, format: 'iife', alias: { '@': resolve('src') },
    define: { 'import.meta.env.DEV': 'false', __VKIFY_SITE_URL__: '"https://vkify.ru"', __VKIFY_BROWSER__: '"chrome"' },
    plugins: ref ? [{ name: 'git-baseline', setup(b) {
      b.onLoad({ filter: /[/\\]src[/\\].*\.(ts|css)$/ }, args => {
        const path = args.path.slice(process.cwd().length + 1).replaceAll('\\', '/');
        return { contents: execFileSync('git', ['show', ref + ':' + path], { encoding: 'utf8', maxBuffer: 8e6 }), loader: path.endsWith('.css') ? 'text' : 'ts' };
      });
    } }] : [], loader: { '.css': 'text' },
  })).outputFiles[0].text;
}
const bundles = { baseline: await bundle(baseline), optimized: await bundle() };
const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
const results = [];
try {
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const variant of repeat % 2 ? ['optimized', 'baseline', 'without'] : ['without', 'baseline', 'optimized']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.setContent('<style>body{margin:0;background:#eef} .MEApp__mainPanel{height:500px;overflow:auto} .row{padding:8px;border-bottom:1px solid #ccc}</style><main class="MEApp__mainPanel"><div class="ConvoHistory__messageBlock">' + '<div class="row">Message</div>'.repeat(1200) + '</div></main><div id="churn"></div>');
      if (variant !== 'without') { await page.addScriptTag({ content: bundles[variant] }); await page.evaluate(() => window.startFixture()); }
      await page.waitForTimeout(1000);
      await page.evaluate(() => {
        window.fixtureMetrics = { callbacks: 0, records: 0, rectReads: 0, clientRectReads: 0, longTasks: 0, longTaskMs: 0 };
        const metrics = window.fixtureMetrics;
        // Instrumentation is confined to this test page, never production.
        for (const [name, key] of [['getBoundingClientRect', 'rectReads'], ['getClientRects', 'clientRectReads']]) {
          const original = Element.prototype[name];
          Element.prototype[name] = function(...args) { metrics[key]++; return original.apply(this, args); };
        }
        new MutationObserver(records => { metrics.callbacks++; metrics.records += records.length; }).observe(document.body, { childList: true, attributes: true, characterData: true, subtree: true });
        new PerformanceObserver(list => { for (const e of list.getEntries()) { metrics.longTasks++; metrics.longTaskMs += e.duration; } }).observe({ type: 'longtask' });
        let n = 0;
        window.churnTimer = setInterval(() => { document.getElementById('churn').textContent = String(++n); }, 100);
      });
      const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
      const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const before = await get();
      await page.waitForTimeout(seconds * 1000);
      const after = await get();
      const elapsed = after.Timestamp - before.Timestamp;
      const counters = await page.evaluate(() => { clearInterval(window.churnTimer); return window.fixtureMetrics; });
      const metrics = Object.fromEntries(['RecalcStyleCount', 'RecalcStyleDuration', 'LayoutCount', 'LayoutDuration', 'ScriptDuration', 'TaskDuration'].map(key => [key, (after[key] - before[key]) / elapsed]));
      const result = { variant, repeat: repeat + 1, elapsedSeconds: elapsed, perSecond: metrics, counters };
      results.push(result); console.log(JSON.stringify(result)); await page.close();
    }
  }
} finally { await browser.close(); }
await mkdir('temp', { recursive: true });
await writeFile('temp/perf-dom-benchmark.json', JSON.stringify({ baseline, seconds, repeats, browser: browser.version(), results }, null, 2));
