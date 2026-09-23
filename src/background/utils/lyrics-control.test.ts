import { afterEach, expect, it, vi } from 'vitest';
import { TabsHelper } from './tabs.js';

afterEach(() => vi.unstubAllGlobals());
it('routes a bounded lyrics command to the active VK tab', async () => {
  const sendMessage = vi.fn(async () => ({ track: { title: 'Song' }, result: null }));
  vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => [{ id: 12, url: 'https://vk.ru/music' }]), sendMessage } });
  expect(await TabsHelper.controlLyrics('snapshot')).toMatchObject({ success: true, data: { track: { title: 'Song' } } });
  expect(sendMessage).toHaveBeenCalledWith(12, expect.objectContaining({ type: 'VKIFY_LYRICS_SNAPSHOT' }));
});
it('does not control an unrelated active tab or fall back to another VK tab', async () => {
  const sendMessage = vi.fn();
  vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => [{ id: 12, url: 'https://example.com/' }]), sendMessage } });
  expect(await TabsHelper.controlLyrics('edit')).toMatchObject({ success: false });
  expect(sendMessage).not.toHaveBeenCalled();
});
