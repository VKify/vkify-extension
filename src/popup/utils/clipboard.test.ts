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
  const button = document.createElement('button');
  document.body.append(button);
  button.focus();
  const exec = vi.fn(() => {
    const input = document.activeElement as HTMLTextAreaElement;
    expect(input.tagName).toBe('TEXTAREA');
    expect(input.value).toBe('theme-url');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('theme-url'.length);
    return true;
  });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
  await expect(copyText('theme-url')).resolves.toBeUndefined();
  expect(exec).toHaveBeenCalledWith('copy');
  expect(document.querySelector('textarea')).toBeNull();
  expect(document.activeElement).toBe(button);
  button.remove();
});

it('reports a real copy failure and cleans up the temporary input', async () => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('denied'); }) } });
  Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  await expect(copyText('theme-url')).rejects.toThrow('denied');
  expect(document.querySelector('textarea')).toBeNull();
});
