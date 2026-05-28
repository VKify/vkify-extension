import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { CLASSIC_ENTRIES as CLASSIC_ENTRY_PATHS } from './scripts/classic-entries.mjs';

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

// Writes dist/manifest.json from the root manifest. In dev mode it additionally
// (a) injects the http://localhost/* site-bridge match so vkify.ru can be
// developed locally (never shipped to prod — S2), and (b) repoints
// `homepage_url` to the dev site so chrome://extensions surfaces the right URL.
function emitManifest(isDev: boolean, siteUrl: string): Plugin {
  return {
    name: 'vkify-emit-manifest',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf-8'));

      if (isDev) {
        const bridge = (manifest.content_scripts as Array<{ js: string[]; matches: string[] }>)
          .find(cs => cs.js?.includes('site-bridge.js'));
        if (bridge && !bridge.matches.includes('http://localhost/*')) {
          bridge.matches.push('http://localhost/*');
        }
        manifest.homepage_url = siteUrl;
      }

      writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      console.log(`✓ manifest.json${isDev ? ` (dev: localhost bridge, homepage_url=${siteUrl})` : ''}`);

      const cssSource = resolve(__dirname, 'public/content.css');
      if (existsSync(cssSource)) {
        copyFileSync(cssSource, resolve(distDir, 'content.css'));
        console.log('✓ content.css');
      }
    },
  };
}

// Safety net: even though every classic entry is built as a standalone IIFE,
// assert no ES `import` survived. Catches misconfiguration at build time.
function assertClassicScriptsHaveNoImports(): Plugin {
  return {
    name: 'assert-classic-scripts-no-imports',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');
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
  };

  if (isClassic) {
    const name = target.slice('classic:'.length);
    const entry = CLASSIC_ENTRIES[name];
    if (!entry) throw new Error(`[vkify] Unknown classic entry: ${name}`);

    return {
      root: '.',
      base: './',
      plugins: [assertClassicScriptsHaveNoImports()],
      esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
      define: { 'import.meta.env.DEV': JSON.stringify(isDev), ...sharedDefine },
      resolve: { alias: { '@': resolve(__dirname, 'src') } },
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        minify: true,
        copyPublicDir: false,
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
    plugins: [react(), emitManifest(isDev, siteUrl)],
    esbuild: { drop: mode === 'production' ? ['console', 'debugger'] : [] },
    define: sharedDefine,
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
    build: {
      outDir: 'dist',
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