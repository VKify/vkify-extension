// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageManager } from './storage.js';

describe('StorageManager change transactions', () => {
  let changed: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'test' },
      storage: {
        local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
        onChanged: {
          addListener: vi.fn((listener) => { changed = listener; }),
          removeListener: vi.fn(),
        },
      },
    });
  });

  it('updates the whole cache before notifying the first changed key', async () => {
    const storage = new StorageManager();
    let settingsSeen: unknown;
    storage.onChange((key) => {
      if (key === 'music_visualizer') void storage.get('music_visualizer_settings').then(value => { settingsSeen = value; });
    });
    changed({
      music_visualizer: { oldValue: false, newValue: true },
      music_visualizer_settings: { oldValue: '{"output":"overlay"}', newValue: '{"output":"widget"}' },
    }, 'local');
    await Promise.resolve();
    expect(settingsSeen).toBe('{"output":"widget"}');
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    storage.cleanup();
  });

  it('couples content-side feature writes to widget visibility', async () => {
    const storage = new StorageManager();
    await storage.set('perf_widget', true);
    expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
      perf_widget: true,
      'widget:perf-widget': expect.objectContaining({ visible: true }),
    }));
    storage.cleanup();
  });
});
