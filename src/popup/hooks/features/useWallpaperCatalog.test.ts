// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWallpaperCatalog } from './useWallpaperCatalog.js';
import { wallpaperCatalog } from '@/popup/utils/wallpaperCatalog.js';
import type { WallpaperCatalogPage } from '@/shared/wallpaper-catalog.js';

vi.mock('@/popup/utils/wallpaperCatalog.js', () => ({ wallpaperCatalog: { page: vi.fn(), albums: vi.fn(), refresh: vi.fn() } }));
let root: Root;
let catalog: ReturnType<typeof useWallpaperCatalog>;
const page = vi.mocked(wallpaperCatalog.page);
function Harness() { catalog = useWallpaperCatalog('videos'); return null; }
const item = (id: string) => ({ id, name: id, preview: '', url: 'https://vkvideo.ru/video_ext.php?oid=-1&id=1', type: 'embed' as const, date: 0 });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  vi.mocked(wallpaperCatalog.albums).mockResolvedValue([]);
  root = createRoot(document.createElement('div'));
});
afterEach(async () => { await act(async () => root.unmount()); });

it('ignores a delayed response after choosing another playlist', async () => {
  let resolve!: (value: WallpaperCatalogPage) => void;
  page.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  await act(async () => root.render(React.createElement(Harness)));
  page.mockResolvedValueOnce({ items: [item('new-playlist')], consumed: 1, total: 1 });
  await act(async () => catalog.chooseAlbum(9));
  await act(async () => resolve({ items: [item('old-playlist')], consumed: 1, total: 100 }));
  expect(catalog.items.map(row => row.id)).toEqual(['new-playlist']);
  expect(catalog.total).toBe(1); expect(catalog.busy).toBe(false);
  expect(page).toHaveBeenLastCalledWith('videos', 9, 0);
});

it('advances by raw rows and merges duplicate cards without skipping pagination', async () => {
  page.mockResolvedValueOnce({ items: [item('one')], consumed: 3, total: 5 });
  await act(async () => root.render(React.createElement(Harness)));
  page.mockResolvedValueOnce({ items: [item('one'), item('two')], consumed: 2, total: 5 });
  await act(async () => { await catalog.loadMore(); });
  expect(page).toHaveBeenLastCalledWith('videos', null, 3);
  expect(catalog.items.map(row => row.id)).toEqual(['one', 'two']);
  expect(catalog.more).toBe(false);
});

it('retains loaded cards on failure and retries the same offset', async () => {
  page.mockResolvedValueOnce({ items: [item('one')], consumed: 1, total: 2 });
  await act(async () => root.render(React.createElement(Harness)));
  page.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await catalog.loadMore(); });
  expect(catalog.error).toBe(true); expect(catalog.items).toHaveLength(1);
  page.mockResolvedValueOnce({ items: [item('two')], consumed: 1, total: 2 });
  await act(async () => { await catalog.loadMore(); });
  expect(page).toHaveBeenLastCalledWith('videos', null, 1);
  expect(catalog.items).toHaveLength(2); expect(catalog.error).toBe(false);
});
