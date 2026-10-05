// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePhotoCatalog } from './usePhotoCatalog.js';
import { sendMessage } from '@/shared/messaging.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
const send = vi.mocked(sendMessage);
let root: Root, catalog: ReturnType<typeof usePhotoCatalog>;
function Harness({ owner = '1' }: { owner?: string }) { catalog = usePhotoCatalog(owner); return null; }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); send.mockReset();
  root = createRoot(document.createElement('div')); await act(async () => root.render(React.createElement(Harness)));
});
afterEach(async () => { await act(async () => root.unmount()); });
it('loads saved photos and albums independently and paginates by consumed API rows', async () => {
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ id: 1, owner_id: 1 }] } });
  await act(async () => { await catalog.loadPhotos(); });
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ id: 1, owner_id: -2 }] } });
  await act(async () => { await catalog.loadPhotos(); });
  expect(send.mock.lastCall?.[0]).toMatchObject({ method: 'photos.getAll', params: { owner_id: '1', offset: 1 } });
  expect(catalog.photos).toHaveLength(2); expect(catalog.more).toBe(false);
  send.mockResolvedValueOnce({ success: false, code: '7', error: 'Denied' });
  await act(async () => { await catalog.loadAlbums(); });
  expect(catalog.albumTask.error).toBe('access_error'); expect(catalog.photos).toHaveLength(2);
});
it('ignores a late old-album response and resets account-specific data', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof sendMessage>>) => void;
  send.mockImplementationOnce(() => new Promise(r => { resolve = r; }) as ReturnType<typeof sendMessage>);
  let pending!: Promise<void>; await act(async () => { pending = catalog.loadPhotos(); });
  send.mockResolvedValueOnce({ success: true, data: { count: 1, items: [{ id: 2, owner_id: 1 }] } });
  await act(async () => catalog.chooseAlbum(5));
  await act(async () => { resolve({ success: true, data: { count: 1, items: [{ id: 1, owner_id: 1 }] } }); await pending; });
  expect(catalog.album).toBe(5); expect(catalog.photos.map(v => v.key)).toEqual(['1_2']);
  expect(send.mock.calls[1]?.[0]).toMatchObject({ method: 'photos.get', params: { album_id: 5, offset: 0 } });
  await act(async () => root.render(React.createElement(Harness, { owner: '2' })));
  expect(catalog.photos).toHaveLength(0); expect(catalog.album).toBeNull();
});

