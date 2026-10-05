// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDocumentCatalog } from './useDocumentCatalog.js';
import { sendMessage } from '@/shared/messaging.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
const send = vi.mocked(sendMessage);
let root: Root, catalog: ReturnType<typeof useDocumentCatalog>;
function Harness({ owner = '1' }: { owner?: string }) { catalog = useDocumentCatalog(owner); return null; }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); send.mockReset();
  root = createRoot(document.createElement('div')); await act(async () => root.render(React.createElement(Harness)));
});
afterEach(async () => { await act(async () => root.unmount()); });
it('paginates by consumed rows, deduplicates files and adjusts the next offset after deletion', async () => {
  send.mockResolvedValueOnce({ success: true, data: { count: 4, items: [{ id: 1, owner_id: 1 }, { id: 0, owner_id: 1 }] } });
  await act(async () => { await catalog.load(); });
  send.mockResolvedValueOnce({ success: true, data: { count: 4, items: [{ id: 1, owner_id: 1 }, { id: 2, owner_id: 1 }] } });
  await act(async () => { await catalog.load(); });
  expect(send.mock.lastCall?.[0]).toMatchObject({ method: 'docs.get', params: { owner_id: '1', offset: 2, return_tags: 1 } });
  expect(catalog.documents).toHaveLength(2); expect(catalog.more).toBe(false);
  await act(async () => catalog.removeDocument('1_1'));
  expect(catalog.documents.map(d => d.key)).toEqual(['1_2']); expect(catalog.total).toBe(3);
});
it('ignores a late response after switching accounts', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof sendMessage>>) => void;
  send.mockImplementationOnce(() => new Promise(r => { resolve = r; }) as ReturnType<typeof sendMessage>);
  let pending!: Promise<void>; await act(async () => { pending = catalog.load(); });
  await act(async () => root.render(React.createElement(Harness, { owner: '2' })));
  await act(async () => { resolve({ success: true, data: { count: 1, items: [{ id: 1, owner_id: 1 }] } }); await pending; });
  expect(catalog.documents).toHaveLength(0); expect(catalog.total).toBeNull();
});
it('keeps loaded documents after an access error', async () => {
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ id: 1, owner_id: 1 }] } });
  await act(async () => { await catalog.load(); });
  send.mockResolvedValueOnce({ success: false, code: '7', error: 'Denied' });
  await act(async () => { await catalog.load(); });
  expect(catalog.error).toBe('access_error'); expect(catalog.documents).toHaveLength(1);
});
