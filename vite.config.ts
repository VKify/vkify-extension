import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { transform } from 'esbuild';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { CLASSIC_ENTRIES as CLASSIC_ENTRY_PATHS } from './scripts/classic-entries.mjs';

// Collects every per-feature `.css` colocated under src/content/features/** and
// concatenates them, sorted by path for deterministic output. Each file gates
// most rules behind `html[data-vkify-<id>]`, so they stay inert until the
// content script toggles the marker (see FeatureManager.enableCss). The theme
// system (theme tokens, accent, fonts, glass, block radius) lives here too — the
// only thing still shipped from public/ is the unconditional base reset
// (styles/content.css). Output is minified at build time (see minifyAllCss).
function collectFeatureCss(dir: string): string {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) files.push(full);
    }
  };
  walk(dir);
  const root = resolve(__dirname);
  const rel = (f: string) => f.slice(root.length).replace(/\\/g, '/').replace(/^\//, '');
  // The theme stylesheet defines the design tokens consumed by everything else,
  // so it leads. The rest are gated by their own data-vkify-<id> marker, so
  // order among them is irrelevant.
  const PRIORITY = ['src/content/features/appearance/theme/theme.css'];
  const rank = (f: string) => { const i = PRIORITY.indexOf(rel(f)); return i === -1 ? PRIORITY.length : i; };
  files.sort((a, b) => (rank(a) - rank(b)) || rel(a).localeCompare(rel(b)));
  return files
    .map(f => `/* ${rel(f)} */\n${readFileSync(f, 'utf-8').trim()}`)
    .join('\n\n');
}

// Minifies every .css emitted into the build dir (the aggregated features.css,
// the copied public styles, and Vite's own popup.css) so the shipped extension
// carries no unminified CSS. esbuild's css loader is comment-stripping and
// whitespace-collapsing; re-minifying an already-minified file is a no-op.
async function minifyAllCss(distDir: string): Promise<void> {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = resolve(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.css')) files.push(full);
    }
  };
  if (existsSync(distDir)) walk(distDir);
  for (const f of files) {
    const { code } = await transform(readFileSync(f, 'utf-8'), { loader: 'css', minify: true });
    writeFileSync(f, code);
  }
}

// tsconfig.node.json has no @types/node; declare the few Node globals we use.
declare const process: { env: Record<string, string | undefined> };
declare const __dirname: string;

//
// Build is split into independent targets (orchestrated by scripts/build.mjs):
//
//   VKIFY_TARGET=modules        → popup (React/HTML) + background, ES modules
//   VKIFY_TARGET=classic:<name> → one classic entry, self-contained IIFE
//
// Why per-entry classic builds: content scripts and injected <script src> are
// loaded as CLASSIC scripts — top-level ESM `import` breaks them. A single
// multi-input Rollup build extracts shared chunks (ESM imports) the moment two
// entries share a module, which silently breaks every classic script. Building
// each classic entry on its own, as `format: 'iife'`, makes Rollup INLINE all
// shared imports into that one file — so classic scripts can finally import from
// src/shared/** (the single source of truth) instead of hand-duplicating it.
//

const CLASSIC_ENTRIES: Record<string, string> = Object.fromEntries(
  Object.entries(CLASSIC_ENTRY_PATHS).map(([name, rel]) => [name, resolve(__dirname, rel)]),
);

function classicOutputName(name: string): string {
  if (name === 'content') return 'content.js';
  if (name === 'site-bridge') return 'site-bridge.js';
  if (name === 'embed') return 'embed.js';
  if (name.startsWith('injected-')) return `injected/${name.replace('injected-', '')}.js`;
  return `assets/${name}.js`;
}

type Json = Record<string, unknown>;

// Deep-merges a per-browser override fragment onto the base manifest.
//   • arrays and `background` are REPLACED wholesale (so Firefox's
//     { scripts } cleanly supplants the base { service_worker } — merging them
//     would yield an invalid manifest with both keys);
//   • plain objects recurse;
//   • keys starting with `_` are dropped (used for human notes in override files).
function mergeManifest(base: Json, override: Json): Json {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (key.startsWith('_')) continue;
    const prev = out[key];
    if (
      key !== 'background' &&
      prev && typeof prev === 'object' && !Array.isArray(prev) &&
      value && typeof value === 'object' && !Array.isArray(value)
    ) {
      out[key] = mergeManifest(prev as Json, value as Json);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Builds dist/<browser>/manifest.json by merging manifest/base.json with the
// per-browser fragment manifest/<browser>.json. In dev mode it additionally
// (a) injects the http://localhost/* site-bridge match so vkify.ru can be
// developed locally (never shipped to prod — S2), and (b) repoints
// `homepage_url` to the dev site so the extensions page surfaces the right URL.
function emitManifest(isDev: boolean, siteUrl: string, outDir: string, browser: string): Plugin {
  return {
    name: 'vkify-emit-manifest',
    async closeBundle() {
      const distDir = resolve(__dirname, outDir);
      const base = JSON.parse(readFileSync(resolve(__dirname, 'manifest/base.json'), 'utf-8')) as Json;
      const overridePath = resolve(__dirname, `manifest/${browser}.json`);
      const override = existsSync(overridePath)
        ? JSON.parse(readFileSync(overridePath, 'utf-8')) as Json
        : {};
      const manifest = mergeManifest(base, override);

      if (isDev) {
        const bridge = (manifest.content_scripts as Array<{ js: string[]; matches: string[] }>)
          .find(cs => cs.js?.includes('site-bridge.js'));
        if (bridge && !bridge.matches.includes('http://localhost/*')) {
          bridge.matches.push('http://localhost/*');
        }
        manifest.homepage_url = siteUrl;
      }

      writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log(`✓ manifest.json [${browser}]${isDev ? ` (dev: localhost bridge, homepage_url=${siteUrl})` : ''}`);

      // Aggregate colocated content CSS → styles/features.css (the single
      // stylesheet referenced by the manifest content_scripts.css). This is the
      // only content stylesheet now — theme/content.css moved under
      // src/content/features/appearance/ and fold in here too.
      const featuresDir = resolve(__dirname, 'src/content/features');
      if (existsSync(featuresDir)) {
        const stylesDir = resolve(distDir, 'styles');
        mkdirSync(stylesDir, { recursive: true });
        writeFileSync(resolve(stylesDir, 'features.css'), collectFeatureCss(featuresDir));
        console.log('✓ styles/features.css');
      }

      // Minify all CSS in the build dir (features.css + copied public styles +
      // Vite's popup.css) so nothing unminified ships.
      await minifyAllCss(distDir);
      console.log('✓ minified css');
    },
  };
}

// Safety net: even though every classic entry is built as a standalone IIFE,
// assert no ES `import` survived. Catches misconfiguration at build time.
function assertClassicScriptsHaveNoImports(outDir: string): Plugin {
  return {
    name: 'assert-classic-scripts-no-imports',
    closeBundle() {
      const distDir = resolve(__dirname, outDir);
      const classicFiles: string[] = [
        resolve(distDir, 'content.js'),
        resolve(distDir, 'site-bridge.js'),
      ];

      const injectedDir = resolve(distDir, 'injected');
      if (existsSync(injectedDir)) {
        for (const f of readdirSync(injectedDir)) {
          if (f.endsWith('.js')) classicFiles.push(resolve(injectedDir, f));
        }
      }

      for (const file of classicFiles) {
        if (!existsSync(file)) continue;
        const src = readFileSync(file, 'utf-8');
        if (/^\s*import[\s{*'"]/m.test(src) || /^\s*export\s/m.test(src)) {
          throw new Error(
            `[vkify] BUILD ERROR: ${file.replace(distDir, 'dist')} contains ES module ` +
            `import/export — it was not built as a self-contained IIFE.`,
          );
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';
  const target = process.env.VKIFY_TARGET ?? 'modules';
  const isClassic = target.startsWith('classic:');

  // Target browser (chrome | firefox | opera) and its output directory.
  // Defaults keep the legacy single-browser flow working: chrome → dist/chrome.
  const browser = process.env.VKIFY_BROWSER ?? 'chrome';
  const outDir = process.env.VKIFY_OUT_DIR ?? `dist/${browser}`;

  // Companion-site base URL — replaces hardcoded https://vkify.ru everywhere
  // in the extension (popup links, share URLs, welcome/changelog/uninstall
  // tabs). Defaults: prod → vkify.ru, dev → localhost:5173 (vite default).
  // Override via env, e.g. VKIFY_SITE_URL=http://localhost:3000 npm run build:dev
  const siteUrl = (process.env.VKIFY_SITE_URL ?? (isDev ? 'http://localhost:5173' : 'https://vkify.ru'))
    .replace(/\/+$/, '');

  // Shared `define` injected into every bundle so popup, background, content
  // and injected agree on the same SITE_URL constant (see shared/constants/site.ts).
  const sharedDefine: Record<string, string> = {
    __VKIFY_SITE_URL__: JSON.stringify(siteUrl),
    __VKIFY_BROWSER__: JSON.stringify(browser),
  };

  if (isClassic) {
    const name = target.slice('classic:'.length);
    const entry = CLASSIC_ENTRIES[name];
    if (!entry) throw new Error(`[vkify] Unknown classic entry: ${name}`);

    return {
      root: '.',
      base: './',
      plugins: [assertClassicScriptsHaveNoImports(outDir)],
      esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
      define: { 'import.meta.env.DEV': JSON.stringify(isDev), ...sharedDefine },
      resolve: { alias: { '@': resolve(__dirname, 'src') } },
      build: {
        outDir,
        emptyOutDir: false,
        minify: true,
        copyPublicDir: false,
        // Classic-вход — это один самодостаточный IIFE (content-/injected-скрипты
        // не умеют ES-import). Его нельзя дробить на чанки, поэтому совет Rollup
        // про code-splitting к нему неприменим: content.js крупный из-за hls.js +
        // lamejs (HLS→MP3 в фиче скачивания аудио). Код уже минифицирован —
        // снимаем неактуальное предупреждение о размере чанка.
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          input: { [name]: entry },
          output: {
            format: 'iife',
            entryFileNames: classicOutputName(name),
            // A single-input IIFE build cannot code-split; this is enforced
            // implicitly by Rollup but kept explicit for clarity.
            inlineDynamicImports: true,
          },
        },
      },
    };
  }

  // Default target: popup + background as ES modules.
  return {
    root: '.',
    base: './',
    plugins: [react(), emitManifest(isDev, siteUrl, outDir, browser)],
    esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
    define: sharedDefine,
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    build: {
      outDir,
      emptyOutDir: true,
      minify: true,
      copyPublicDir: true,
      rollupOptions: {
        input: {
          popup:      resolve(__dirname, 'index.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'popup') return 'assets/popup.js';
            if (chunkInfo.name === 'background') return 'background.js';
            return 'assets/[name].js';
          },
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  };
});