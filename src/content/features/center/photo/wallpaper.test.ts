// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureContext } from '@/content/core/feature-context.js';
import { DEFAULT_SETTINGS } from '@/shared/constants/defaults.js';
import { createPhotoWallpaperFeature, WALLPAPER_BTN_ID } from './wallpaper.js';
import { createPhotoDownloadFeature } from './index.js';
import { PV_BTN_ID } from './constants.js';
import { removeBrandTooltip } from '../_shared/brand-tooltip.js';

const mocks = vi.hoisted(() => ({
  fetchPhoto: vi.fn(),
  findCurrentPhotoId: vi.fn(),
  setMultiple: vi.fn(),
}));
vi.mock('./api.js', () => ({
  isVkHost: () => true,
  fetchPhoto: mocks.fetchPhoto,
  findCurrentPhotoId: mocks.findCurrentPhotoId,
  getBestPhotoUrl: (sizes: { url: string; width: number }[]) => [...sizes].sort((a, b) => b.width - a.width)[0]?.url ?? null,
  parseAlbumPath: () => null,
}));
vi.mock('@/content/core/services/index.js', () => ({
  SERVICES: { storage: 'storage' },
  getService: () => ({ setMultiple: mocks.setMultiple }),
}));
vi.mock('../_shared/index.js', () => ({
  attachBrandTooltip: vi.fn(), removeBrandTooltip: vi.fn(), ensureDownloadCenter: vi.fn(),
}));
vi.mock('./zip-album.js', () => ({ downloadAlbumAll: vi.fn() }));

describe('photo wallpaper action', () => {
  let feature: ReturnType<typeof createPhotoWallpaperFeature>;
  let scan: () => void;
  const off = vi.fn();
  const viewer = (): void => {
    document.body.innerHTML = '<div id="pv_box"><div class="pv_bottom_actions"><button>Delete</button><span class="divider"></span><button class="pv_actions_more">More</button></div></div>';
  };
  const button = (): HTMLButtonElement => document.getElementById(WALLPAPER_BTN_ID) as HTMLButtonElement;

  beforeEach(() => {
    vi.clearAllMocks();
    viewer();
    mocks.findCurrentPhotoId.mockReturnValue({ ownerId: -42, photoId: 7 });
    mocks.fetchPhoto.mockResolvedValue({ sizes: [{ url: 'https://example.com/small.jpg', width: 100 }, { url: 'https://example.com/full.jpg', width: 2000 }] });
    mocks.setMultiple.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }),
    }));
    feature = createPhotoWallpaperFeature({
      observeChanges: vi.fn((_id, callback) => { scan = callback; return off; }),
    } as unknown as FeatureContext);
  });

  afterEach(async () => {
    await feature.disable();
    removeBrandTooltip();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('is available with photo downloads disabled and is placed before More', async () => {
    expect(DEFAULT_SETTINGS.photo_download).toBe(false);
    expect(DEFAULT_SETTINGS.photo_wallpaper).toBe(true);
    await feature.enable(true);
    expect(button().disabled).toBe(false);
    expect(button().nextElementSibling?.nextElementSibling?.className).toBe('pv_actions_more');
    button().dispatchEvent(new MouseEvent('mouseenter'));
    const tooltip = document.querySelector('[data-vkify-tip]');
    expect(tooltip?.classList.contains('is-visible')).toBe(true);
    expect(tooltip?.textContent).toBe(button().getAttribute('aria-label'));
    button().dispatchEvent(new MouseEvent('mouseleave'));
    expect(tooltip?.classList.contains('is-visible')).toBe(false);
    scan();
    expect(document.querySelectorAll(`#${WALLPAPER_BTN_ID}`)).toHaveLength(1);
  });

  it('saves the largest photo as an image and clears the previous preset and web metadata', async () => {
    await feature.enable(true);
    button().click();
    expect(button().disabled).toBe(true);
    await vi.waitFor(() => expect(mocks.setMultiple).toHaveBeenCalledOnce());
    expect(fetch).toHaveBeenCalledWith('https://example.com/full.jpg', expect.any(Object));
    expect(mocks.setMultiple).toHaveBeenCalledWith({
      custom_background: expect.stringMatching(/^data:image\/jpeg;base64,/),
      background_type: 'image', background_preset_id: '', web_wallpaper_id: '', web_wallpaper_schema: '[]',
    });
    await vi.waitFor(() => expect(button().disabled).toBe(false));
  });

  it('leaves the wallpaper action intact when downloads are enabled and disabled', async () => {
    await feature.enable(true);
    const downloads = createPhotoDownloadFeature({ observeChanges: () => () => {} } as unknown as FeatureContext).photo_download;
    await downloads.enable(true);
    expect(document.getElementById(PV_BTN_ID)).not.toBeNull();
    await downloads.disable();
    expect(document.getElementById(PV_BTN_ID)).toBeNull();
    expect(button()).not.toBeNull();
    expect(document.getElementById(`${WALLPAPER_BTN_ID}-style`)).not.toBeNull();
    expect(button().previousElementSibling?.id).toBe(`${WALLPAPER_BTN_ID}-divider`);
  });

  it('preserves existing settings if the image cannot be fetched', async () => {
    mocks.fetchPhoto.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await feature.enable(true);
    button().click();
    await vi.waitFor(() => expect(button().disabled).toBe(false));
    expect(mocks.setMultiple).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('restores the action after the viewer is recreated and cleans up its own UI', async () => {
    await feature.enable(true);
    viewer();
    scan();
    expect(button()).not.toBeNull();
    await feature.disable();
    expect(button()).toBeNull();
    expect(document.getElementById(`${WALLPAPER_BTN_ID}-divider`)).toBeNull();
    expect(document.getElementById(`${WALLPAPER_BTN_ID}-style`)).toBeNull();
    expect(off).toHaveBeenCalled();
    expect(document.querySelector('.pv_actions_more')).not.toBeNull();
  });
});
