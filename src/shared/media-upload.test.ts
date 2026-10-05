// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { uploadMedia, uploadUrl } from './media-upload.js';

class UploadRequest {
  static instances: UploadRequest[] = [];
  response: unknown = { video_id: 42 }; status = 200; responseType = ''; timeout = 0;
  upload = { onprogress: null as ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null; onabort: (() => void) | null = null;
  body?: FormData;
  open = vi.fn();
  send(body: FormData) { this.body = body; UploadRequest.instances.push(this); }
  abort() { this.onabort?.(); }
}
const file = new File(['bytes'], 'movie.mp4', { type: 'video/mp4' });
beforeEach(() => { UploadRequest.instances = []; vi.stubGlobal('XMLHttpRequest', UploadRequest); });
afterEach(() => vi.unstubAllGlobals());
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

it.each(['http://pu.vk.ru/upload', 'https://vk.ru.evil.test/upload', 'https://user:pass@pu.vk.ru/upload', 'https://evil.test/upload'])('rejects an untrusted upload server %s', url => {
  expect(() => uploadUrl(url)).toThrow();
});
it('uploads binary video directly with metadata and no wall post', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload', video_id: 42 }), progress = vi.fn();
  const result = uploadMedia('video', file, 9, api, new AbortController().signal, progress, 'Title', 'Description');
  await flush();
  const xhr = UploadRequest.instances[0];
  expect(api).toHaveBeenCalledWith('video.save', { name: 'Title', description: 'Description', wallpost: 0, album_id: 9 });
  expect(xhr.body?.get('video_file')).toBeInstanceOf(File);
  xhr.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
  expect(progress).toHaveBeenCalledWith(50);
  xhr.onload?.(); await result;
  expect(api).toHaveBeenCalledTimes(1);
});
it('saves photos only after the server accepts the file', async () => {
  const api = vi.fn().mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' }).mockResolvedValueOnce([{ id: 42 }]);
  const result = uploadMedia('photo', file, 9, api, new AbortController().signal, vi.fn(), '', 'Caption');
  await flush(); const xhr = UploadRequest.instances[0];
  expect(xhr.body?.get('file1')).toBeInstanceOf(File);
  xhr.response = { server: 123, photos_list: '[{"photo":"uploaded"}]', hash: 'signed' }; xhr.onload?.(); await result;
  expect(api).toHaveBeenLastCalledWith('photos.save', { album_id: 9, server: 123, photos_list: '[{"photo":"uploaded"}]', hash: 'signed', caption: 'Caption' });
});
it('does not save a failed photo upload', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' });
  const result = uploadMedia('photo', file, 9, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('UPLOAD_FAILED');
  await flush(); const xhr = UploadRequest.instances[0]; xhr.status = 500; xhr.onload?.(); await rejected;
  expect(api).toHaveBeenCalledTimes(1);
});
it('aborts an in-flight transfer without saving a photo', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' }), controller = new AbortController();
  const result = uploadMedia('photo', file, 9, api, controller.signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('UPLOAD_CANCELLED');
  await flush(); controller.abort(); await rejected;
  expect(api).toHaveBeenCalledTimes(1);
});
it('does not start a transfer after cancellation while obtaining its server', async () => {
  const controller = new AbortController();
  const api = vi.fn().mockImplementation(async () => { controller.abort(); return { upload_url: 'https://pu.vk.ru/upload' }; });
  await expect(uploadMedia('video', file, null, api, controller.signal, vi.fn())).rejects.toThrow('UPLOAD_CANCELLED');
  expect(UploadRequest.instances).toHaveLength(0);
});
