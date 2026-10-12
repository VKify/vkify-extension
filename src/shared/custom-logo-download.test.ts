import { describe, expect, it, vi } from 'vitest';
import { readLogoResponse } from './custom-logo-download.js';
import { MAX_LOGO_FILE_SIZE } from './custom-logo.js';

describe('bounded logo downloads', () => {
  it('accepts supported image responses with MIME parameters', async () => {
    const image = await readLogoResponse(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } }));
    expect(image.type).toBe('image/svg+xml');
    expect(await image.text()).toBe('<svg/>');
  });
  it('cancels oversized streams without a content length before reading the rest', async () => {
    const cancel = vi.fn();
    let reads = 0;
    const stream = new ReadableStream({
      pull(controller) { reads++; controller.enqueue(new Uint8Array(MAX_LOGO_FILE_SIZE + 1)); }, cancel,
    }, { highWaterMark: 0 });
    await expect(readLogoResponse(new Response(stream, { headers: { 'content-type': 'image/png' } }))).rejects.toThrow('size limit');
    expect(reads).toBe(1);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects invalid or oversized headers without reading the body', async () => {
    const cases: Record<string, string>[] = [{ 'content-type': 'text/html' }, { 'content-type': 'image/png', 'content-length': String(MAX_LOGO_FILE_SIZE + 1) }];
    for (const headers of cases) {
      const cancel = vi.fn(); const pull = vi.fn();
      const body = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
      await expect(readLogoResponse(new Response(body, { headers }))).rejects.toThrow('Invalid logo');
      expect(pull).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
    }
  });
});
