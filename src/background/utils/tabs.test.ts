import { afterEach, describe, expect, it, vi } from 'vitest';
import { TabsHelper } from './tabs.js';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('player settings links', () => {
  it.each([
    'chrome://settings/content/siteDetails?site=https%3A%2F%2Fvk.ru',
    'opera://settings/content/siteDetails?site=https%3A%2F%2Fvk.ru',
    'chrome://extensions/shortcuts',
    'https://vk.ru/audios',
  ])('opens an explicitly allowed URL: %s', async (url) => {
    const create = vi.fn().mockResolvedValue({});
    vi.stubGlobal('chrome', { tabs: { create } });
    await TabsHelper.openTab(url);
    expect(create).toHaveBeenCalledExactlyOnceWith({ url });
  });

  it.each([
    'chrome://settings/passwords',
    'chrome://settings/content/siteDetails?site=https%3A%2F%2Fexample.com',
    'javascript:alert(1)',
    'file:///C:/private.txt',
  ])('keeps unrelated privileged URLs blocked: %s', async (url) => {
    const create = vi.fn();
    vi.stubGlobal('chrome', { tabs: { create } });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await TabsHelper.openTab(url);
    expect(create).not.toHaveBeenCalled();
  });
});
