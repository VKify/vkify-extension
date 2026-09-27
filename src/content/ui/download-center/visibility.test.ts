// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '@/content/core/storage.js';
import { DOWNLOAD_CENTER_OPEN, widgetVisibilityPatch } from '@/shared/widget-visibility.js';
import { dlCenter } from './state.js';
import { initDownloadCenterVisibility, destroyDownloadCenter, downloadCenterJobStart, downloadCenterJobRemove } from './jobs.js';

const backing: Record<string, unknown> = {};
const flush = async (): Promise<void> => { await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => {
  storage.cleanup(); storage.invalidateCache();
  for (const key of Object.keys(backing)) delete backing[key];
  vi.stubGlobal('chrome', { runtime: { id: 'test' }, storage: {
    local: {
      get: vi.fn(async (keys: string | string[] | null) => keys === null ? { ...backing } : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(k => k in backing).map(k => [k, backing[k]]))),
      set: vi.fn(async (patch: Record<string, unknown>) => { Object.assign(backing, patch); }),
    }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  } });
});
afterEach(() => { destroyDownloadCenter(); storage.cleanup(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('manual download center visibility', () => {
  it('creates and shows an empty panel before any download exists', async () => {
    initDownloadCenterVisibility(); await flush(); expect(dlCenter.widget).toBeNull();
    await storage.setMultiple(widgetVisibilityPatch('download-center', '', true, {})); await flush();
    expect(dlCenter.widget?.isMounted()).toBe(true);
    expect(dlCenter.widget?.root.classList.contains('is-hidden')).toBe(false);
    expect(dlCenter.widget?.body.querySelector('.vkify-dl-center__empty')).not.toBeNull();
  });
  it('keeps an explicitly opened panel after its last task disappears', async () => {
    initDownloadCenterVisibility(); await storage.set(DOWNLOAD_CENTER_OPEN, true); await flush();
    downloadCenterJobStart('a', 'Test'); downloadCenterJobRemove('a');
    expect(dlCenter.widget?.root.classList.contains('is-hidden')).toBe(false);
    expect(dlCenter.widget?.body.querySelector('.vkify-dl-center__empty')).not.toBeNull();
  });
  it('retains automatic cleanup for task-driven panels', () => {
    downloadCenterJobStart('a', 'Test'); downloadCenterJobRemove('a');
    expect(dlCenter.widget?.root.classList.contains('is-hidden')).toBe(true);
  });
  it('restores manual opening on reload and synchronizes the close button', async () => {
    backing[DOWNLOAD_CENTER_OPEN] = true; initDownloadCenterVisibility(); await flush();
    expect(dlCenter.pinned).toBe(true);
    dlCenter.widget?.head.querySelector<HTMLButtonElement>('[data-fw-close]')?.click(); await flush();
    expect(backing[DOWNLOAD_CENTER_OPEN]).toBe(false);
    expect(dlCenter.widget?.root.classList.contains('is-hidden')).toBe(true);
  });
  it('does not recreate a panel after shutdown while the initial read is pending', async () => {
    backing[DOWNLOAD_CENTER_OPEN] = true; initDownloadCenterVisibility(); destroyDownloadCenter(); await flush();
    expect(dlCenter.widget).toBeNull(); expect(document.querySelector('[data-vkify-widget="download-center"]')).toBeNull();
  });
});
