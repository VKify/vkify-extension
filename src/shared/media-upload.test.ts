// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { photoUploadReceipt, uploadMedia, uploadUrl } from './media-upload.js';

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
const photo = new File(['bytes'], 'photo.png', { type: 'image/png' });
const file = new File(['bytes'], 'movie.mp4', { type: 'video/mp4' });
beforeEach(() => { UploadRequest.instances = []; vi.stubGlobal('XMLHttpRequest', UploadRequest); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

it.each(['[]', ' [ ] ', '', '   ', undefined, null, []])('rejects empty or incorrectly typed photo receipts %s', photos_list => {
  expect(() => photoUploadReceipt({ server: 123, hash: 'signed', photos_list }, 9)).toThrow();
});
it.each(['opaque-signed-receipt', '{"data":"signed-receipt"}', '[{"id":"signed-receipt"}]'])('forwards the opaque VK photos_list unchanged: %s', photos_list => {
  expect(photoUploadReceipt({ server: 123, hash: 'signed', photos_list }, 9)).toEqual({ album_id: 9, server: 123, hash: 'signed', photos_list });
});
it('describes a missing receipt without revealing response values', () => {
  expect(() => photoUploadReceipt({ request_id: 'secret-request', files: [{ hash: 'secret-file' }], hash: 'secret-hash' }, 9))
    .toThrow('response fields: request_id:string(14), files:array(1), hash:string(11)');
});
it('preserves the exact signed string and verifies the receipt album', () => {
  const photos_list = ' [ { "photo": "accepted", "sizes": [] } ] ';
  expect(photoUploadReceipt({ aid: 9, server: 123, hash: 'signed', photos_list }, 9).photos_list).toBe(photos_list);
  expect(() => photoUploadReceipt({ aid: 10, server: 123, hash: 'signed', photos_list }, 9)).toThrow('another album');
});
it('stops after three empty receipts without dispatching photos.save', async () => {
  vi.useFakeTimers();
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' });
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toMatchObject({ code: 'EMPTY_PHOTO_UPLOAD', method: 'upload' });
  await flush();
  for (let attempt = 0; attempt < 3; attempt++) {
    const xhr = UploadRequest.instances[attempt];
    xhr.response = { server: 123, hash: 'signed', photos_list: ' [ ] ' }; xhr.onload?.();
    await vi.advanceTimersByTimeAsync(attempt === 0 ? 5000 : attempt === 1 ? 10000 : 0);
  }
  await rejected;
  expect(api).toHaveBeenCalledTimes(3);
  expect(api.mock.calls.every(([method]) => method === 'photos.getUploadServer')).toBe(true);
});
it('gets a fresh upload server after an empty receipt, then saves only the accepted receipt once', async () => {
  vi.useFakeTimers(); let servers = 0;
  const api = vi.fn().mockImplementation(async method => method === 'photos.getUploadServer'
    ? { upload_url: `https://pu.vk.ru/upload-${++servers}` } : [{ id: 42 }]);
  const retry = vi.fn();
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn(), '', '', retry);
  await flush(); UploadRequest.instances[0].response = { server: 1, hash: 'first', photos_list: '[]' };
  UploadRequest.instances[0].onload?.();
  await vi.advanceTimersByTimeAsync(4999); expect(UploadRequest.instances).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); const second = UploadRequest.instances[1];
  expect(second.open).toHaveBeenCalledWith('POST', 'https://pu.vk.ru/upload-2');
  second.response = { server: 2, hash: 'second', photos_list: 'accepted-receipt' }; second.onload?.(); await result;
  expect(retry).toHaveBeenCalledWith(2, 3);
  expect(api.mock.calls.filter(([method]) => method === 'photos.save')).toHaveLength(1);
  expect(api).toHaveBeenLastCalledWith('photos.save', { album_id: 9, server: 2, hash: 'second', photos_list: 'accepted-receipt', caption: '' });
});
it('cancels a pending retry without another transfer or save', async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' });
  const result = uploadMedia('photo', photo, 9, api, controller.signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('UPLOAD_CANCELLED');
  await flush(); UploadRequest.instances[0].response = { server: 1, hash: 'signed', photos_list: '[]' };
  UploadRequest.instances[0].onload?.(); await vi.advanceTimersByTimeAsync(0);
  controller.abort(); await rejected; await vi.advanceTimersByTimeAsync(20000);
  expect(UploadRequest.instances).toHaveLength(1);
  expect(api).toHaveBeenCalledTimes(1);
});
it('retains the original VK parameter error and failing method', async () => {
  const api = vi.fn().mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' })
    .mockRejectedValueOnce(Object.assign(new Error('One of the parameters specified was missing or invalid: photos_list is invalid'), { code: '100' }));
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toMatchObject({ code: '100', method: 'photos.save', message: expect.stringContaining('photos_list is invalid') });
  await flush(); UploadRequest.instances[0].response = { server: 123, hash: 'signed', photos_list: '[{"photo":"accepted"}]' };
  UploadRequest.instances[0].onload?.(); await rejected;
});
it('sends an opaque receipt to photos.save and only confirms success after receiving a photo ID', async () => {
  const api = vi.fn().mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' }).mockResolvedValueOnce([{ id: 42 }]);
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn());
  await flush(); const xhr = UploadRequest.instances[0];
  xhr.response = { server: 123, hash: 'signed', photos_list: 'opaque-signed-receipt' };
  xhr.onload?.(); await result;
  expect(api).toHaveBeenLastCalledWith('photos.save', { album_id: 9, server: 123, hash: 'signed', photos_list: 'opaque-signed-receipt', caption: '' });
});

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
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn(), '', 'Caption');
  await flush(); const xhr = UploadRequest.instances[0];
  expect(xhr.body?.get('file1')).toBeInstanceOf(File);
  xhr.response = { server: 123, photos_list: '[{"photo":"uploaded"}]', hash: 'signed' }; xhr.onload?.(); await result;
  expect(api).toHaveBeenLastCalledWith('photos.save', { album_id: 9, server: 123, photos_list: '[{"photo":"uploaded"}]', hash: 'signed', caption: 'Caption' });
});
it('does not save a failed photo upload', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' });
  const result = uploadMedia('photo', photo, 9, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('HTTP_500');
  await flush(); const xhr = UploadRequest.instances[0]; xhr.status = 500; xhr.onload?.(); await rejected;
  expect(api).toHaveBeenCalledTimes(1);
});
it('aborts an in-flight transfer without saving a photo', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' }), controller = new AbortController();
  const result = uploadMedia('photo', photo, 9, api, controller.signal, vi.fn());
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
it('uploads documents using the file field and saves the title and tags', async () => {
  const api = vi.fn().mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' }).mockResolvedValueOnce({ type: 'doc', doc: { id: 42, owner_id: 1 } });
  const result = uploadMedia('doc', file, null, api, new AbortController().signal, vi.fn(), 'Report.pdf', 'work,reports');
  await flush(); const xhr = UploadRequest.instances[0];
  expect(api).toHaveBeenCalledWith('docs.getUploadServer', {});
  expect(xhr.body?.get('file')).toBeInstanceOf(File);
  xhr.response = { file: 'uploaded-file' }; xhr.onload?.(); await result;
  expect(api).toHaveBeenLastCalledWith('docs.save', { file: 'uploaded-file', title: 'Report.pdf', tags: 'work,reports', return_tags: 1 });
});
it('does not save documents when the upload response is invalid', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' });
  const result = uploadMedia('doc', file, null, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('INVALID_UPLOAD_RESPONSE');
  await flush(); UploadRequest.instances[0].response = {}; UploadRequest.instances[0].onload?.(); await rejected;
  expect(api).toHaveBeenCalledTimes(1);
});
it('does not save an aborted document transfer', async () => {
  const api = vi.fn().mockResolvedValue({ upload_url: 'https://pu.vk.ru/upload' }), controller = new AbortController();
  const result = uploadMedia('doc', file, null, api, controller.signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('UPLOAD_CANCELLED');
  await flush(); controller.abort(); await rejected; expect(api).toHaveBeenCalledTimes(1);
});
it('rejects a document save response without a valid document ID', async () => {
  const api = vi.fn().mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' }).mockResolvedValueOnce({ type: 'audio_message', audio_message: { id: 42 } });
  const result = uploadMedia('doc', file, null, api, new AbortController().signal, vi.fn());
  const rejected = expect(result).rejects.toThrow('INVALID_SAVE_RESPONSE');
  await flush(); UploadRequest.instances[0].response = { file: 'uploaded-file' }; UploadRequest.instances[0].onload?.(); await rejected;
});
