import { afterEach, expect, it, vi } from 'vitest';
import type { ScopedFeatureContext } from '../content/core/features/scoped-context.js';

vi.mock('../content/core/features/index.js', () => ({ cssPlugin: () => ({}), settingsPlugin: () => ({}) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

it('does not start after disabling during injection, and reuses the loaded module on re-enable', async () => {
  let resolve!: (result: unknown) => void;
  const sendMessage = vi.fn(() => new Promise(r => { resolve = r; }));
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  vi.stubGlobal('__VKifyPostSummary', undefined);
  const { postSummaryFeature } = await import('../content/features/center/feed/post-summary.js');
  const plugin = postSummaryFeature.plugins!.find(p => p.name === 'post-summary')!;
  const stop = vi.fn(), start = vi.fn(() => stop);
  const ctx = { getSetting: vi.fn().mockResolvedValue(['perplexity']) } as unknown as ScopedFeatureContext;
  const cleanup = plugin.setup!(ctx) as () => void;
  await flush();
  cleanup();
  vi.stubGlobal('__VKifyPostSummary', start); resolve({ ok: true }); await flush();
  expect(start).not.toHaveBeenCalled();
  const cleanupAgain = plugin.setup!(ctx) as () => void; await flush();
  expect(start).toHaveBeenCalledExactlyOnceWith(ctx, ['perplexity']);
  expect(sendMessage).toHaveBeenCalledExactlyOnceWith({ type: 'INJECT_POST_SUMMARY' });
  cleanupAgain(); expect(stop).toHaveBeenCalledOnce();
});

it('retries failed injection on the next enable', async () => {
  vi.stubGlobal('__VKifyPostSummary', undefined);
  const start = vi.fn(() => () => {});
  const sendMessage = vi.fn().mockResolvedValueOnce({ ok: false }).mockImplementationOnce(async () => {
    vi.stubGlobal('__VKifyPostSummary', start); return { ok: true };
  });
  vi.stubGlobal('chrome', { runtime: { sendMessage } });
  const { postSummaryFeature } = await import('../content/features/center/feed/post-summary.js');
  const plugin = postSummaryFeature.plugins!.find(p => p.name === 'post-summary')!;
  const ctx = { getSetting: vi.fn().mockResolvedValue(['claude']) } as unknown as ScopedFeatureContext;
  const cleanup = plugin.setup!(ctx) as () => void; await flush(); cleanup();
  const retryCleanup = plugin.setup!(ctx) as () => void; await flush();
  expect(sendMessage).toHaveBeenCalledTimes(2);
  expect(start).toHaveBeenCalledExactlyOnceWith(ctx, ['claude']);
  retryCleanup();
});

it('does not load the optional module when all services are disabled', async () => {
  vi.stubGlobal('__VKifyPostSummary', undefined);
  const sendMessage = vi.fn(); vi.stubGlobal('chrome', { runtime: { sendMessage } });
  const { postSummaryFeature } = await import('../content/features/center/feed/post-summary.js');
  const ctx = { getSetting: vi.fn().mockResolvedValue([]) } as unknown as ScopedFeatureContext;
  const cleanup = postSummaryFeature.plugins!.find(p => p.name === 'post-summary')!.setup!(ctx) as () => void;
  await flush(); expect(sendMessage).not.toHaveBeenCalled(); cleanup();
});

it('applies the saved display order while excluding disabled services', async () => {
  const start = vi.fn(() => () => {}); vi.stubGlobal('__VKifyPostSummary', start);
  const { postSummaryFeature } = await import('../content/features/center/feed/post-summary.js');
  const ctx = { getSetting: vi.fn(async (key: string) => key === 'post_summary_order' ? ['claude','perplexity','google'] : ['google','perplexity']) } as unknown as ScopedFeatureContext;
  const cleanup = postSummaryFeature.plugins!.find(p => p.name === 'post-summary')!.setup!(ctx) as () => void;
  await flush(); expect(start).toHaveBeenCalledExactlyOnceWith(ctx, ['perplexity','google']); cleanup();
});
