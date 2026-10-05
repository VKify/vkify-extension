// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18next from 'i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '@/locales/en/center.json';
import { downloadCatalogZip, resolveCatalogFile } from '@/shared/catalog-download.js';
import { downloadBlob } from '@/shared/utils/download.js';
import { sendMessage } from '@/shared/messaging.js';
import CatalogDownloads from './CatalogDownloads.js';

const translator = i18next.createInstance();
void translator.init({ lng: 'en', resources: { en: { translation: en } }, initImmediate: false });
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => translator.t(key, values) }) }));
vi.mock('@/shared/catalog-download.js', async original => ({ ...await original<typeof import('@/shared/catalog-download.js')>(), downloadCatalogZip: vi.fn(), resolveCatalogFile: vi.fn() }));
vi.mock('@/shared/utils/download.js', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
const items = [1, 2].map(id => ({ key: `1_${id}`, title: `File ${id}`, filename: `file-${id}.txt`, source: `https://cdn.userapi.com/${id}` }));
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('downloads a single file through the existing background downloader without creating a ZIP', async () => {
  vi.mocked(resolveCatalogFile).mockResolvedValue('https://cdn.userapi.com/file'); vi.mocked(sendMessage).mockResolvedValue({ success: true });
  const saved = vi.fn();
  await act(async () => root.render(<CatalogDownloads kind="doc" ownerId="1" items={items.slice(0, 1)} disabled={false} onBusyChange={() => {}} onSaved={saved} />));
  expect(container.textContent).toContain('Download files · 1');
  await act(async () => container.querySelector('button')!.click());
  expect(sendMessage).toHaveBeenCalledWith({ type: 'DOWNLOAD_ATTACHMENT', url: 'https://cdn.userapi.com/1', filename: 'file-1.txt' });
  expect(downloadCatalogZip).not.toHaveBeenCalled(); expect(saved).toHaveBeenCalledWith(['1_1']);
});
it('does not save an old account archive or clear a new selection after the account changes', async () => {
  let finish!: () => void; let signal!: AbortSignal;
  vi.mocked(downloadCatalogZip).mockImplementation(async (_kind, _items, _call, activeSignal, _progress, save) => {
    signal = activeSignal;
    await new Promise<void>(resolve => { finish = resolve; });
    save!(new Blob(['old account']), 'old.zip');
    return { saved: ['1_1', '1_2'], failed: [], remaining: [], archives: ['old.zip'], cancelled: false };
  });
  const saved = vi.fn(), render = (ownerId: string) => <CatalogDownloads kind="photo" ownerId={ownerId} items={items} disabled={false} onBusyChange={() => {}} onSaved={saved} />;
  await act(async () => root.render(render('1')));
  expect(container.textContent).toContain('Download ZIP · 2');
  await act(async () => container.querySelector('button')!.click());
  await act(async () => root.render(render('2')));
  expect(signal.aborted).toBe(true);
  await act(async () => { finish(); await Promise.resolve(); });
  expect(downloadBlob).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
});
it('offers a browser-download fallback for failed ZIP files and does not repeat successful files', async () => {
  vi.mocked(downloadCatalogZip).mockResolvedValue({ saved: ['1_1'], failed: [{ key: '1_2', title: 'File 2', code: 'NETWORK_ERROR' }], remaining: [], archives: ['partial.zip'], cancelled: false });
  vi.mocked(sendMessage).mockResolvedValue({ success: true });
  const saved = vi.fn();
  await act(async () => root.render(<CatalogDownloads kind="doc" ownerId="1" items={items} disabled={false} onBusyChange={() => {}} onSaved={saved} />));
  await act(async () => container.querySelector('button')!.click());
  expect(container.textContent).toContain('Could not connect to the file server');
  const fallback = [...container.querySelectorAll('button')].find(button => button.textContent === 'Download remaining separately')!;
  await act(async () => fallback.click());
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(sendMessage).toHaveBeenCalledWith({ type: 'DOWNLOAD_ATTACHMENT', url: 'https://cdn.userapi.com/2', filename: 'file-2.txt' });
  expect(saved).toHaveBeenLastCalledWith(['1_2']);
  expect(container.textContent).toContain('Sent to browser downloads: 1');
});
