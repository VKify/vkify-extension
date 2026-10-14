import type { Page } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

let bundle: Promise<string> | undefined;
/** CSS fixtures run the same structural-marker lifecycle as the content app. */
export async function installStyleRelations(page: Page): Promise<void> {
  bundle ??= build({ stdin: { resolveDir: process.cwd(), contents: `
    import { startStyleRelations } from './src/content/services/style-relations.ts';
    window.chrome ??= {}; window.chrome.runtime ??= { id: 'style-fixture' };
    window.stopStyleFixture = startStyleRelations();
  ` }, bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
  define: { 'import.meta.env.DEV': 'false' } }).then(result => result.outputFiles[0].text);
  await page.addScriptTag({ content: await bundle });
}
