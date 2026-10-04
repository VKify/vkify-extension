// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { injectAlbumButton } from './bulk.js';
import { requestPlaylist } from './ipc.js';
import { produceTrack } from './pipeline.js';
import { fetchCover } from './meta.js';
import { buildZip } from '@/shared/utils/zip.js';
import { downloadBlob } from '@/shared/utils/download.js';
import { trackCache } from './dom.js';

vi.mock('./ipc.js', () => ({ requestPlaylist: vi.fn() }));
vi.mock('./pipeline.js', () => ({ produceTrack: vi.fn(), partsToBytes: () => new Uint8Array([1, 2, 3]) }));
vi.mock('./meta.js', () => ({ fetchCover: vi.fn() }));
vi.mock('./queue.js', () => ({ acquireSlot: async () => {}, releaseSlot: () => {} }));
vi.mock('@/shared/utils/zip.js', () => ({ buildZip: vi.fn(() => new Blob()) }));
vi.mock('@/shared/utils/download.js', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/content/i18n/index.js', () => ({ t: (s: string) => s }));
vi.mock('../../_shared/index.js', () => ({
  sanitizeFilename: (s: string) => s,
  createBrandButton: () => document.createElement('button'),
  setBrandButtonLabel: () => {},
  downloadCenterJobStart: () => {}, downloadCenterJobUpdate: () => {}, downloadCenterJobDone: () => {},
  downloadCenterJobError: () => {}, downloadCenterJobRemove: () => {},
}));

beforeEach(() => {
  vi.clearAllMocks(); trackCache.clear();
  document.body.innerHTML = `<div data-testid="MusicPlaylistModal">
    <div data-testid="MusicPlaylistModal_Title">Album</div>
    <div data-testid="MusicPlaylistTracks_Header"></div>
    <a href="/music/album/7_1_hash"></a>
  </div>`;
  vi.mocked(requestPlaylist).mockResolvedValue([[42, 7, '', 'Song', 'Artist', 200]]);
  vi.mocked(produceTrack).mockResolvedValue({ filename: 'Artist - Song', parts: [], ext: 'mp3', mime: 'audio/mpeg' });
  vi.mocked(fetchCover).mockResolvedValue({ data: new Uint8Array([4, 5]), mime: 'image/png' });
});
afterEach(() => { document.body.replaceChildren(); trackCache.clear(); });

async function downloadAlbum(): Promise<void> {
  injectAlbumButton();
  document.querySelector<HTMLButtonElement>('[data-vkify-adl-album]')!.click();
  await vi.waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
}

it('reads artwork on the header itself and passes it to tracks for ID3 embedding', async () => {
  const cover = document.createElement('div');
  cover.dataset.testid = 'audiolistboxheader-cover';
  cover.style.backgroundImage = 'url("https://sun1.userapi.com/album.png")';
  document.querySelector('[data-testid="MusicPlaylistModal"]')!.append(cover);
  await downloadAlbum();
  expect(fetchCover).toHaveBeenCalledWith('https://sun1.userapi.com/album.png');
  expect(produceTrack).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: 'https://sun1.userapi.com/album.png' }), expect.any(Function), expect.any(AbortSignal));
  expect(buildZip).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'cover.png' })]));
});

it('uses playlist artwork if the album header has no cover', async () => {
  const tuple = [42, 7, '', 'Song', 'Artist', 200];
  tuple[14] = 'https://sun1.userapi.com/song.jpg';
  vi.mocked(requestPlaylist).mockResolvedValue([tuple]);
  await downloadAlbum();
  expect(fetchCover).toHaveBeenCalledWith('https://sun1.userapi.com/song.jpg');
  expect(buildZip).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'cover.png' })]));
});

it('refreshes an incomplete DOM cache with the large artwork used by the mini player', async () => {
  trackCache.set('7_42', { trackId: '7_42', title: 'Song', performer: 'Artist', coverUrl: '', audioData: [42, 7] });
  const tuple = [42, 7, '', 'Song', 'Artist', 200];
  tuple[14] = ',https://sun9-1.vkuserphoto.ru/large.jpg';
  vi.mocked(requestPlaylist).mockResolvedValue([tuple]);
  await downloadAlbum();
  expect(fetchCover).toHaveBeenCalledWith('https://sun9-1.vkuserphoto.ru/large.jpg');
  expect(produceTrack).toHaveBeenCalledWith(expect.objectContaining({ coverUrl: 'https://sun9-1.vkuserphoto.ru/large.jpg' }), expect.any(Function), expect.any(AbortSignal));
});

it('adds artwork discovered during track reload to the album archive', async () => {
  vi.mocked(produceTrack).mockImplementation(async entry => {
    entry.coverUrl = 'https://sun1.userapi.com/reloaded.jpg';
    return { filename: 'Artist - Song', parts: [], ext: 'mp3', mime: 'audio/mpeg' };
  });
  await downloadAlbum();
  expect(fetchCover).toHaveBeenCalledWith('https://sun1.userapi.com/reloaded.jpg');
  expect(buildZip).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'cover.png' })]));
});

it('still saves the album when optional artwork cannot be downloaded', async () => {
  vi.mocked(fetchCover).mockResolvedValue(null);
  await downloadAlbum();
  expect(buildZip).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: '1. Artist - Song.mp3' })]));
});
