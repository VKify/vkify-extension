import { afterEach, expect, it, vi } from 'vitest';
import { UPLOAD_LIMITS, validateUploadFiles, pacedUploadApi, UPLOAD_API_DELAY_MS, uploadErrorReason, uploadErrorDetails } from './upload-policy.js';

afterEach(() => vi.useRealTimers());
it.each(['photo', 'video', 'doc'] as const)('rejects empty/oversized files and excessive batches for %s', kind => {
  const name = kind === 'photo' ? 'photo.png' : kind === 'video' ? 'video.mp4' : 'report.pdf';
  const valid = { name, size: UPLOAD_LIMITS[kind].bytes, type: '' };
  expect(validateUploadFiles(kind, [valid])).toEqual([]);
  expect(validateUploadFiles(kind, [{ ...valid, size: valid.size + 1 }])).toContainEqual({ key: 'too_large', name });
  expect(validateUploadFiles(kind, [{ ...valid, size: 0 }])).toContainEqual({ key: 'empty_file', name });
  expect(validateUploadFiles(kind, Array.from({ length: UPLOAD_LIMITS[kind].files + 1 }, () => valid))).toContainEqual({ key: 'too_many' });
});
it('checks formats and MIME types even for dropped files', () => {
  expect(validateUploadFiles('photo', [{ name: 'photo.exe', size: 100, type: 'image/png' }])[0]?.key).toBe('unsupported');
  expect(validateUploadFiles('photo', [{ name: 'photo.png', size: 100, type: 'text/plain' }])[0]?.key).toBe('unsupported');
  expect(validateUploadFiles('photo', [{ name: 'PHOTO.JPG', size: 100, type: '' }])).toEqual([]);
  expect(validateUploadFiles('video', [{ name: 'video.mkv', size: 100, type: 'application/octet-stream' }])).toEqual([]);
});
it('spaces metadata calls and aborts an API wait without dispatching the next write', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2090-01-01'));
  const raw = vi.fn().mockResolvedValue({}), controller = new AbortController(), waiting = vi.fn();
  const api = pacedUploadApi(raw, controller.signal, waiting);
  await api('photos.getUploadServer', {});
  const saved = api('photos.save', {});
  await vi.advanceTimersByTimeAsync(UPLOAD_API_DELAY_MS - 1); expect(raw).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); await saved; expect(raw).toHaveBeenCalledTimes(2);
  const cancelled = api('photos.save', {}), assertion = expect(cancelled).rejects.toThrow('UPLOAD_CANCELLED');
  controller.abort(); await assertion; expect(raw).toHaveBeenCalledTimes(2);
});
it.each([['6', 'rate_limit'], ['9', 'rate_limit'], ['29', 'rate_limit'], ['14', 'captcha'], ['7', 'access'], ['100', 'invalid_parameter'], ['121', 'invalid_parameter'], ['122', 'invalid_parameter'], ['EMPTY_PHOTO_UPLOAD', 'empty_photo'], ['HTTP_413', 'file_rejected'], ['NETWORK_ERROR', 'network'], ['ACCOUNT_CHANGED', 'account_changed']])('explains error %s', (code, reason) => {
  expect(uploadErrorReason({ code })).toBe(reason);
});
it('keeps the VK explanation while removing credentials and signed URLs', () => {
  const details = uploadErrorDetails({ code: '100', method: 'photos.save', message: 'photos_list is invalid; access_token=secret hash=signed https://pu.vk.ru/upload?hash=secret' });
  expect(details).toContain('photos.save: (100): photos_list is invalid');
  expect(details).not.toContain('secret'); expect(details).not.toContain('hash=signed');
});
