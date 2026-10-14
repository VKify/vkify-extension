// Isolated Chromium fixture; no VK account, settings export or network requests.
// node scripts/perf-dom-index.mjs --baseline=155fdf3 --comments=5000 --loops=20 --repeats=3
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const baseline = option('baseline', '155fdf3');
const comments = Number(option('comments', '5000')), loops = Number(option('loops', '20')), repeats = Number(option('repeats', '3'));
if (![comments, loops, repeats].every(value => Number.isInteger(value) && value > 0)) throw new Error('Expected positive integer fixture dimensions');
const tracker = 'src/content/features/ads-blocking/recommendations/tracker.ts';
const relations = 'src/content/services/style-relations.ts';
const bundles = {};
for (const version of ['baseline', 'current']) {
  const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import { createRecommendationTracker, RECOMMENDATION_SECTIONS } from './${tracker}';
    import { startStyleRelations } from './${relations}';
    window.chrome ??= {}; window.chrome.runtime ??= { id: 'dom-benchmark' };
    window.loggedBlocks = 0;
    const tracker = createRecommendationTracker({ loadStats: async () => {}, recordBlock: () => window.loggedBlocks++ });
    for (const section of Object.keys(RECOMMENDATION_SECTIONS)) tracker.enable(section);
    startStyleRelations();
  ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') }, define: { 'import.meta.env.DEV': 'false' },
  plugins: version === 'baseline' ? [{ name: 'baseline', setup(plugin) {
    plugin.onLoad({ filter: /(?:recommendations[\\/]tracker|services[\\/]style-relations)\.ts$/ }, args => {
      const file = args.path.endsWith('tracker.ts') ? tracker : relations;
      return { contents: execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }), loader: 'ts', resolveDir: resolve(file, '..') };
    });
  } }] : [] });
  bundles[version] = result.outputFiles[0].text;
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
const results = [];
try {
  for (let repeat = 0; repeat < repeats; repeat++) for (const version of repeat % 2 ? ['current', 'baseline'] : ['baseline', 'current']) {
    const page = await browser.newPage();
    await page.setContent(`<html data-vkify-hide_profile_right_column data-vkify-communities_swap_columns data-vkify-hide_feed_right_column data-vkify-edge_sidebar data-vkify-minimalistic_sidebar><body>
      <header id="page_header_cont"><div class="TopNavigation__logo--hash"></div></header>
      <div id="page_layout"><div class="LayoutWrapper__body--hash"><aside id="layout_sidebar"><nav data-testid="leftmenu"><ol><li data-testid="leftmenuitem"></li></ol></nav></aside>
      <main id="spa_layout_content"><div id="context"><div id="group_tabs"></div><header data-testid="profile-header"></header></div><div id="comments"></div></main></div></div>
    </body></html>`);
    await page.evaluate(count => {
      document.getElementById('comments').innerHTML = Array.from({ length: count }, (_, i) => `<article><div class="reply"><section><a href="/user${i}">Author</a><div><span>Reply ${i}</span><button>Like</button></div></section></div></article>`).join('');
      // Test-only instrumentation to attribute native query time, never shipped in the extension.
      window.queryStats = { calls: 0, global: 0, milliseconds: 0 };
      for (const prototype of [Document.prototype, Element.prototype]) {
        const native = prototype.querySelectorAll;
        prototype.querySelectorAll = function(...args) {
          const start = performance.now();
          try { return native.apply(this, args); }
          finally {
            window.queryStats.calls++;
            if (this === document || this === document.body || this === document.documentElement) window.queryStats.global++;
            window.queryStats.milliseconds += performance.now() - start;
          }
        };
      }
    }, comments);
    await page.addScriptTag({ content: bundles[version] });
    await page.waitForTimeout(150);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const before = (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'ScriptDuration').value;
    await page.evaluate(() => { window.queryStats = { calls: 0, global: 0, milliseconds: 0 }; });
    for (let i = 0; i < loops; i++) {
      await page.evaluate(i => {
        const comments = document.getElementById('comments');
        comments.insertAdjacentHTML('beforeend', `<article><div><span>New reply ${i}</span>${i % 5 === 0 ? `<section data-testid="similar-group-block">Suggested ${i}</section>` : ''}</div></article>`);
        comments.firstElementChild.remove();
      }, i);
      // Let both implementations finish their existing scheduling before the next commit.
      await page.waitForTimeout(85);
    }
    const after = (await cdp.send('Performance.getMetrics')).metrics.find(metric => metric.name === 'ScriptDuration').value;
    const result = await page.evaluate(() => ({ ...window.queryStats, loggedBlocks: window.loggedBlocks }));
    results.push({ version, repeat, ...result, scriptMs: (after - before) * 1000 });
    console.log(JSON.stringify(results[results.length - 1]));
    await page.close();
  }
} finally { await browser.close(); }
await mkdir('temp', { recursive: true });
await writeFile('temp/dom-index-benchmark.json', JSON.stringify({ baseline, comments, loops, repeats, results }, null, 2));
