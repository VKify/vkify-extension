import { afterEach, expect, it, vi } from 'vitest';
import { downloadCatalogZip, downloadCatalogFiles, resolveCatalogFile, catalogFilename } from './catalog-download.js';
import { selectVideoDownloadFile } from './video-download-quality.js';
import { crc32 } from './utils/zip.js';

const item = (key: string, source = `https://cdn.userapi.com/${key}`) => ({ key, title: 'same/name', filename: 'same/name.txt', source });
afterEach(() => vi.unstubAllGlobals());
it('uses the same best and nearest available MP4 quality as the playlist', () => {
  const files = { mp4_360: '360', mp4_1080: '1080', mp4_2160: '2160', hls: 'hls' };
  expect(selectVideoDownloadFile(files)?.url).toBe('2160');
  expect(selectVideoDownloadFile(files, 720)?.url).toBe('360');
  expect(selectVideoDownloadFile({ mp4_1080: '1080' }, 720)?.url).toBe('1080');
  expect(selectVideoDownloadFile({ hls: 'hls' })).toBeNull();
});
it('reads ZIP sources with session cookies and a granted CDN permission', async () => {
  const contains = vi.fn().mockResolvedValue(true), fetcher = vi.fn().mockResolvedValue(new Response('bytes'));
  vi.stubGlobal('chrome', { permissions: { contains } }); vi.stubGlobal('fetch', fetcher);
  const result = await downloadCatalogZip('video', [item('1', 'https://sun9-1.userapi.com/file.mp4')], vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
  expect(result.saved).toEqual(['1']);
  expect(contains).toHaveBeenCalledWith({ origins: ['https://sun9-1.userapi.com/*'] });
  expect(fetcher).toHaveBeenCalledWith('https://sun9-1.userapi.com/file.mp4', expect.objectContaining({ credentials: 'include' }));
});
it('reports the missing server permission rather than an unexplained fetch failure', async () => {
  vi.stubGlobal('chrome', { permissions: { contains: vi.fn().mockResolvedValue(false) } });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const result = await downloadCatalogZip('video', [item('1', 'https://video.vkuser.net/file.mp4')], vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
  expect(result.failed).toEqual([{ key: '1', title: 'same/name', code: 'HOST_PERMISSION', host: 'video.vkuser.net' }]);
  expect(fetcher).not.toHaveBeenCalled();
});
it('distinguishes a network rejection from an HTTP response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  const result = await downloadCatalogZip('doc', [item('1')], vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
  expect(result.failed[0].code).toBe('NETWORK_ERROR');
});
it('queues multiple videos through the browser downloader without fetching file bytes', async () => {
  const fetcher = vi.fn(), queue = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', fetcher);
  const call = vi.fn().mockResolvedValue({ items: [{ files: { mp4_360: 'https://cdn.userapi.com/360.mp4', mp4_1080: 'https://cdn.userapi.com/1080.mp4' } }] });
  const result = await downloadCatalogFiles('video', [{ ...item('1'), videoReference: '123_1' }, { ...item('2'), videoReference: '123_2' }], call, new AbortController().signal, queue, vi.fn(), 720);
  expect(result.saved).toEqual(['1', '2']);
  expect(queue).toHaveBeenCalledWith('https://cdn.userapi.com/360.mp4', '1-same_name.txt');
  expect(queue).toHaveBeenCalledWith('https://cdn.userapi.com/360.mp4', '2-same_name.txt');
  expect(fetcher).not.toHaveBeenCalled();
});
/** Read STORE local headers to verify the archive contains actual bytes, paths and CRCs. */
async function entries(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), rows: { name: string; data: Uint8Array }[] = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + length));
    const start = offset + 30 + length, data = bytes.slice(start, start + size);
    expect(view.getUint32(offset + 14, true)).toBe(crc32(data));
    rows.push({ name, data }); offset = start + size;
  }
  return rows;
}
it.each(['photo', 'video', 'doc'] as const)('packages selected %s files as real binary entries with safe distinct names', async kind => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'application/octet-stream' } })));
  const archives: Blob[] = [], controller = new AbortController();
  const result = await downloadCatalogZip(kind, [item('1_1'), item('1_2')], vi.fn(), controller.signal, vi.fn(), blob => archives.push(blob));
  expect(result.saved).toEqual(['1_1', '1_2']); expect(result.failed).toEqual([]); expect(archives).toHaveLength(1);
  const files = await entries(archives[0]);
  expect(files.map(f => f.name)).toEqual([`${kind === 'photo' ? 'photos' : kind === 'video' ? 'videos' : 'documents'}/1_1-same_name.txt`, `${kind === 'photo' ? 'photos' : kind === 'video' ? 'videos' : 'documents'}/1_2-same_name.txt`]);
  expect(files[0].data).toEqual(new Uint8Array([1, 2, 3]));
});
it('keeps successful files and a report when another file fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('good')).mockResolvedValueOnce(new Response('bad', { status: 403 })));
  const archives: Blob[] = [];
  const result = await downloadCatalogZip('doc', [item('1_1'), item('1_2')], vi.fn(), new AbortController().signal, vi.fn(), blob => archives.push(blob));
  expect(result.saved).toEqual(['1_1']); expect(result.failed[0].code).toBe('HTTP_403');
  expect((await entries(archives[0])).map(f => f.name)).toEqual(['documents/1_1-same_name.txt', '_download-report.json']);
});
it('splits archives by size and preserves each file only once', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('1234')));
  const archives: Blob[] = [];
  const result = await downloadCatalogZip('photo', [item('1_1'), item('1_2')], vi.fn(), new AbortController().signal, vi.fn(), blob => archives.push(blob), { partBytes: 5 });
  expect(result.archives).toHaveLength(2); expect(result.archives[0]).toContain('part-001.zip');
  expect((await entries(archives[0]))[0].name).toContain('1_1-'); expect((await entries(archives[1]))[0].name).toContain('1_2-');
});
it('saves completed files on cancellation and does not fetch the next file', async () => {
  const controller = new AbortController(), archives: Blob[] = [];
  const fetcher = vi.fn().mockResolvedValue(new Response('complete')); vi.stubGlobal('fetch', fetcher);
  const result = await downloadCatalogZip('doc', [item('1_1'), item('1_2')], vi.fn(), controller.signal,
    done => { if (done === 1) controller.abort(); }, blob => archives.push(blob));
  expect(result.saved).toEqual(['1_1']); expect(result.remaining).toEqual(['1_2']); expect(result.cancelled).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1); expect(archives).toHaveLength(1);
});
it('resolves the highest MP4 quality and retains private video references', async () => {
  const call = vi.fn().mockResolvedValue({ items: [{ files: { mp4_360: 'https://cdn.userapi.com/360', mp4_1080: 'https://cdn.userapi.com/1080', external: 'https://example.com/embed' } }] });
  expect(await resolveCatalogFile({ ...item('1_2'), videoReference: '1_2_private' }, call)).toBe('https://cdn.userapi.com/1080');
  expect(call).toHaveBeenCalledWith('video.get', { videos: '1_2_private', extended: 0 });
  await expect(resolveCatalogFile({ ...item('1_2'), videoReference: '1_2' }, vi.fn().mockResolvedValue({ items: [{ files: { hls: 'https://cdn.userapi.com/index.m3u8' } }] }))).rejects.toThrow('NO_SOURCE');
});
it('rejects declared oversized files without buffering them and keeps other files', async () => {
  const response = new Response('oversized', { headers: { 'content-length': String(4 * 1024 ** 3) } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce(new Response('good')));
  const result = await downloadCatalogZip('video', [item('1_1'), item('1_2')], vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
  expect(result.failed[0].code).toBe('FILE_TOO_LARGE'); expect(result.saved).toEqual(['1_2']);
});
it('never interprets a web page or missing URL as a downloaded image', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } })));
  const result = await downloadCatalogZip('photo', [item('1_1'), { ...item('1_2'), source: null }], vi.fn(), new AbortController().signal, vi.fn(), vi.fn());
  expect(result.failed.map(f => f.code)).toEqual(['NOT_A_FILE', 'NO_SOURCE']); expect(result.archives).toEqual([]);
  expect(catalogFilename('../unsafe/фото.jpg', '1_1')).not.toContain('/');
});
it('stops metadata requests on an account change and leaves all files unstarted', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const call = vi.fn().mockRejectedValue(Object.assign(new Error('Account changed'), { code: 'ACCOUNT_CHANGED' }));
  const result = await downloadCatalogZip('video', [1, 2].map(id => ({ ...item(`1_${id}`), videoReference: `1_${id}` })), call, new AbortController().signal, vi.fn(), vi.fn());
  expect(result.stoppedCode).toBe('ACCOUNT_CHANGED'); expect(result.remaining).toEqual(['1_1', '1_2']);
  expect(fetcher).not.toHaveBeenCalled(); expect(call).toHaveBeenCalledTimes(1);
});
it('calculates the archive CRC across multiple response chunks', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('1234')); controller.enqueue(new TextEncoder().encode('56789')); controller.close(); } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
  const archives: Blob[] = [];
  await downloadCatalogZip('doc', [item('1_1')], vi.fn(), new AbortController().signal, vi.fn(), blob => archives.push(blob));
  const files = await entries(archives[0]); expect(new TextDecoder().decode(files[0].data)).toBe('123456789');
});
