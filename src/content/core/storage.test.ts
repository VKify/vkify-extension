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

describe('tab-local theme preview', () => {
  it('overrides all reads without writes, then restores the latest saved values', async () => {
    let saved = { custom_theme: '#111111' };
    let changed!: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
    vi.stubGlobal('chrome', { runtime: { id: 'test' }, storage: {
      local: { get: vi.fn(async () => ({ ...saved })), set: vi.fn() },
      onChanged: { addListener: vi.fn(cb => { changed = cb; }), removeListener: vi.fn() },
    } });
    const storage = new StorageManager();
    const listener = vi.fn();
    storage.onChange(listener);
    await storage.setPreview({ custom_theme: '#abcdef' });
    expect(await storage.get('custom_theme')).toBe('#abcdef');
    expect(await storage.getAll()).toEqual({ custom_theme: '#abcdef' });
    expect(await storage.getMultiple(['custom_theme'])).toEqual({ custom_theme: '#abcdef' });
    saved = { custom_theme: '#222222' };
    changed({ custom_theme: { newValue: '#222222' } }, 'local');
    expect(listener).toHaveBeenLastCalledWith('custom_theme', '#abcdef');
    await storage.setPreview({});
    expect(await storage.get('custom_theme')).toBe('#222222');
    expect(listener).toHaveBeenLastCalledWith('custom_theme', '#222222');
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
    storage.cleanup();
  });
});
