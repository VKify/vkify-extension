// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createVideoCardFramesFeature } from './card-frames-loader.js';
import { sendMessage } from '@/shared/messaging.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
afterEach(() => { vi.mocked(sendMessage).mockReset(); });
it('does not enable after a pending injection has been disabled', async () => {
  let resolve!: (value: { ok: boolean }) => void;
  vi.mocked(sendMessage).mockImplementation(() => new Promise(r => { resolve = r; }) as never);
  const getSetting = vi.fn(), ctx = { getSetting } as unknown as FeatureContext;
  const feature = createVideoCardFramesFeature(ctx), work = feature.enable?.(); feature.disable?.();
  resolve({ ok: true }); await work; expect(getSetting).not.toHaveBeenCalled();
});
it('sends position updates and releases the setting subscription', async () => {
  vi.mocked(sendMessage).mockResolvedValue({ ok: true });
  const off = vi.fn(), onSettingChange = vi.fn((_key: string, _callback: (value: unknown) => void) => off);
  const ctx = { getSetting: async () => 'middle', onSettingChange } as unknown as FeatureContext;
  const events: unknown[] = [], listener = (e: Event) => events.push((e as CustomEvent).detail);
  window.addEventListener('vkify:video-frames:settings', listener);
  const feature = createVideoCardFramesFeature(ctx); await feature.enable?.();
  onSettingChange.mock.calls[0][1]('end'); feature.disable?.();
  expect(events).toEqual([{ enabled: true, position: 'middle' }, { enabled: true, position: 'end' }, { enabled: false, position: undefined }]);
  expect(off).toHaveBeenCalledOnce(); window.removeEventListener('vkify:video-frames:settings', listener);
});
