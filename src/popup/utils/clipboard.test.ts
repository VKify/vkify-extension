// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { copyText } from './clipboard.js';

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'execCommand');
});

it('uses the Clipboard API when available', async () => {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  await copyText('theme-url');
  expect(writeText).toHaveBeenCalledWith('theme-url');
});

it('falls back to a selected textarea when Clipboard API is denied', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
  const exec = vi.fn(() => true);
  Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
  await expect(copyText('theme-url')).resolves.toBeUndefined();
  expect(exec).toHaveBeenCalledWith('copy');
  expect(document.querySelector('textarea')).toBeNull();
});
