import { test, expect } from '@playwright/test';
import { runInNewContext } from 'node:vm';
import { build } from './esbuild-fixture.js';

test('IIFE fixtures resolve Vite environment flags without empty import.meta warnings', async () => {
  for (const dev of [false, true]) {
    const result = await build({ stdin: { contents: 'globalThis.isDev = import.meta.env?.DEV;' }, bundle: true, format: 'iife', write: false,
      ...(dev ? { define: { 'import.meta.env.DEV': 'true' } } : {}) });
    expect(result.warnings).toEqual([]);
    const context: Record<string, unknown> = {};
    runInNewContext(result.outputFiles[0].text, context);
    expect(context.isDev).toBe(dev);
  }
});
