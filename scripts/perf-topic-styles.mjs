// Public VK DOM/CSS isolation: does not log in, post, or inject the settings export.
// node scripts/perf-topic-styles.mjs --settings=C:/path/export.json --repeats=3
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const option = (key, fallback) => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const settingsPath = option('settings');
if (!settingsPath) throw new Error('Provide --settings=path/to/vkify-export.json');
const baseline = option('baseline', '4a30b5b');
const baselineCss = option('baseline-css');
const dynamic = option('dynamic', 'none');
const dynamicBaseline = option('dynamic-baseline', baseline);
if (!['none', 'menu-order', 'hidden-menu', 'avatar', 'all'].includes(dynamic)) throw new Error('Invalid dynamic CSS mode');
const scenario = option('scenario', 'comment');
const extraComments = Number(option('extra-comments', '0'));
const batchSize = Number(option('batch-size', '30'));
const replaceBatch = option('replace-batch', 'false') === 'true';
if (!['comment', 'root-class', 'batch'].includes(scenario) || !Number.isInteger(extraComments) || extraComments < 0 || !Number.isInteger(batchSize) || batchSize < 1) throw new Error('Invalid scenario/extra-comments/batch-size');
const url = option('url', 'https://vk.ru/topic-39921010_30153123?offset=1320');
const repeats = Number(option('repeats', '3')), loops = Number(option('loops', '100'));
if (![repeats, loops].every(value => Number.isInteger(value) && value > 0)) throw new Error('Invalid repeats/loops');
const settings = JSON.parse(await readFile(settingsPath, 'utf8')).settings;
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (path.endsWith('.css')) files.push(path);
  }
  return files;
}
const theme = 'src/content/features/appearance/theme/theme.css';
const files = (await walk('src/content/features')).sort((a, b) => Number(b === theme) - Number(a === theme) || a.localeCompare(b));
const current = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n');
const original = baselineCss ? await readFile(baselineCss, 'utf8') : files.map(file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8', maxBuffer: 8e6 })).join('\n');
// Only markers actually referenced by CSS and six validated theme inputs enter
// the test document. Tokens, account data, histories and URLs stay out of it.
const referenced = new Set([...current.matchAll(/data-vkify-([\w-]+)/g)].map(match => match[1]));
const markers = Object.entries(settings).filter(([key, value]) => value === true && referenced.has(key)).map(([key]) => `data-vkify-${key}`);
const inputs = Object.fromEntries(['custom_theme', 'custom_accent', 'block_opacity', 'glass_blur', 'theme_radius', 'block_depth'].map(key => {
  const value = settings[key];
  const valid = key === 'block_depth' ? typeof value === 'boolean'
    : key.startsWith('custom_') ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    : typeof value === 'number' && Number.isFinite(value);
  return [key, valid ? value : undefined];
}));
// Explicit styling allowlist: never pass the complete export to the page.
const menuIds = value => Array.isArray(value) ? value.filter(id => typeof id === 'string' && /^(l_|sep_)[a-z_]+$/i.test(id)) : [];
const dynamicInputs = {
  order: menuIds(settings.menu_items_order), hidden: menuIds(settings.hidden_menu_items),
  shape: ['drop', 'leaf', 'petal', 'blob', 'arch', 'shield', 'egg', 'pebble', 'pillow'].includes(settings.avatar_radius_shape) ? settings.avatar_radius_shape : '',
  percent: typeof settings.border_radius === 'number' && Number.isFinite(settings.border_radius) ? settings.border_radius : 50,
};
const dynamicSource = `
  import { buildMenuOrderCss } from './src/content/features/hiding/menu/menu-items-order.ts';
  import { buildHiddenMenuItemsCss } from './src/content/features/hiding/menu/hide-menu-items.ts';
  import { createBorderRadiusFeature } from './src/content/features/appearance/theme/border-radius.ts';
  window.buildDynamicFixture = async (mode, data) => {
    let css = '';
    if (mode === 'menu-order' || mode === 'all') {
      const orderCss = buildMenuOrderCss(data.order);
      document.documentElement.toggleAttribute('data-vkify-menu_items_order', !!orderCss);
      css += orderCss || '';
    }
    if (mode === 'hidden-menu' || mode === 'all') css += buildHiddenMenuItemsCss(data.hidden) || '';
    if (mode === 'avatar' || mode === 'all') {
      const feature = createBorderRadiusFeature({
        getSetting: async key => key === 'avatar_radius_shape' ? data.shape : data.percent,
        injectCSS: (_id, text) => { css += text; }, removeCSS: () => {},
      });
      await feature.avatar_radius_shape.enable();
    }
    return css;
  };
`;
const bundle = (await build({ stdin: { resolveDir: process.cwd(), contents: `
  import { applyThemeState } from './src/content/features/appearance/theme/state.ts';
  import { startStyleRelations } from './src/content/services/style-relations.ts';
  window.applyFixtureTheme = applyThemeState; window.startStyleFixture = startStyleRelations;
  ${dynamicSource}
` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
define: { 'import.meta.env.DEV': 'false' } })).outputFiles[0].text;
const baselineDynamicBundle = dynamic === 'none' || dynamicBaseline === 'current' ? '' : (await build({
  stdin: { resolveDir: process.cwd(), contents: dynamicSource }, bundle: true, write: false, format: 'iife',
  alias: { '@': resolve('src') }, define: { 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'baseline-css-builders', setup(builder) {
    builder.onLoad({ filter: /(?:menu-items-order|hide-menu-items|border-radius)\.ts$/ }, args => ({
      contents: execFileSync('git', ['show', `${dynamicBaseline}:${args.path.slice(process.cwd().length + 1).replaceAll('\\', '/')}`], { encoding: 'utf8' }),
      loader: 'ts', resolveDir: resolve(args.path, '..'),
    }));
  } }],
})).outputFiles[0].text;
const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
const results = [];
let documentInfo;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const source = await context.newPage();
  await source.goto(url, { waitUntil: 'load' });
  await source.locator('[data-testid="board-comments-list"]').waitFor();
  await source.locator('[data-testid="comment"]').first().waitFor();
  // Same rendered public DOM and VK styles in every run, without native page
  // timers, ads or SPA script races. No DOM snapshot is written to disk.
  const snapshot = await source.evaluate(() => {
    const html = document.documentElement.cloneNode(true);
    html.querySelectorAll('script, iframe, link[rel="modulepreload"], link[rel="preload"][as="script"]').forEach(node => node.remove());
    for (const element of html.querySelectorAll('*')) {
      for (const attr of [...element.attributes]) if (attr.name.startsWith('on')) element.removeAttribute(attr.name);
    }
    const base = document.createElement('base'); base.href = location.href; html.querySelector('head').prepend(base);
    return '<!doctype html>' + html.outerHTML;
  });
  await source.close();
  const variants = ['without-vkify-css', 'baseline-css', 'optimized-css'];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const variant of repeat % 2 ? [...variants].reverse() : variants) {
      const page = await context.newPage();
      await page.setContent(snapshot, { waitUntil: 'load' });
      await page.evaluate(count => {
        const list = document.querySelector('[data-testid="board-comments-list"]');
        const comment = list.querySelector('[data-testid="comment"]');
        for (let i = 0; i < count; i++) list.append(comment.cloneNode(true));
      }, extraComments);
      await page.addScriptTag({ content: bundle });
      await page.evaluate(({ markers, inputs }) => {
        window.chrome ??= {}; window.chrome.runtime ??= { id: 'style-fixture' };
        for (const marker of markers) document.documentElement.setAttribute(marker, 'true');
        window.applyFixtureTheme(inputs);
      }, { markers, inputs });
      await page.addStyleTag({ content: '.fixture-active{outline-color:red}' + (variant === 'baseline-css' ? original : variant === 'optimized-css' ? current : '') });
      if (dynamic !== 'none' && variant !== 'without-vkify-css') {
        if (variant === 'baseline-css' && baselineDynamicBundle) await page.addScriptTag({ content: baselineDynamicBundle });
        const css = await page.evaluate(({ dynamic, dynamicInputs }) => window.buildDynamicFixture(dynamic, dynamicInputs), { dynamic, dynamicInputs });
        if (css) await page.addStyleTag({ content: css });
      }
      // A working-tree CSS snapshot can already contain the earlier marker
      // rules; run their lifecycle as well so the comparison preserves styling.
      if (variant === 'optimized-css' || (variant === 'baseline-css' && baselineCss)) await page.evaluate(() => { window.stopStyleFixture = window.startStyleFixture(); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      documentInfo ??= await page.evaluate(() => ({ elements: document.querySelectorAll('*').length, comments: document.querySelectorAll('[data-testid="comment"]').length }));
      const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(entry => [entry.name, entry.value]));
      const before = await metrics();
      const wallMs = await page.evaluate(async ({ loops, scenario, batchSize, replaceBatch }) => {
        const nodes = [...document.querySelectorAll('[data-testid="comment"]')];
        let previousBatch = [];
        const start = performance.now();
        for (let i = 0; i < loops; i++) {
          const node = nodes[i % nodes.length]; node.classList.toggle('fixture-active');
          if (scenario === 'root-class') document.documentElement.classList.toggle('fixture-active');
          if (scenario === 'batch') {
            const list = document.querySelector('[data-testid="board-comments-list"]');
            if (replaceBatch) for (const element of previousBatch) element.remove();
            previousBatch = Array.from({ length: batchSize }, () => nodes[0].cloneNode(true));
            list.append(...previousBatch);
            // Let observers process actual connected additions, as in a React
            // commit. Keep batches, so the discussion grows during the run.
            await Promise.resolve(); list.getClientRects();
          } else {
            const child = document.createElement('span'); node.append(child);
            node.getClientRects(); child.remove();
          }
        }
        return performance.now() - start;
      }, { loops, scenario, batchSize, replaceBatch });
      // Include deferred observer work in CPU metrics, not just synchronous reads.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const after = await metrics();
      const result = { variant, repeat: repeat + 1, loops, wallMs,
        styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
        layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
        scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
        styleCount: after.RecalcStyleCount - before.RecalcStyleCount,
        finalComments: await page.locator('[data-testid="comment"]').count() };
      results.push(result); console.log(JSON.stringify(result)); await page.close();
    }
  }
} finally { await browser.close(); }
await mkdir('temp', { recursive: true });
await writeFile('temp/perf-topic-styles.json', JSON.stringify({ baseline: baselineCss ? 'provided-css-snapshot' : baseline, dynamic, dynamicBaseline: dynamic === 'none' ? null : dynamicBaseline, scenario, batchSize, replaceBatch, extraComments, url, browser: browser.version(), repeats, loops,
  cssHashes: Object.fromEntries([['baseline', original], ['current', current]].map(([key, css]) => [key, createHash('sha256').update(css).digest('hex')])),
  documentInfo, markers, themeInputs: inputs, nativePageScripts: false, results }, null, 2));
