import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callVKApi, type VKTokenManager } from '../utils/vk-api.js';
import { saveSettingsDocument, listSettingsDocuments, readSettingsDocument } from './settings-document.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';

vi.mock('../utils/vk-api.js', () => ({ callVKApi: vi.fn() }));
vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ version: '2.0.0' }) } });
const api = vi.mocked(callVKApi);
const upload = vi.fn();
const manager = {} as VKTokenManager;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', upload);
  api.mockReset();
  api.mockImplementation(async (_manager, method) => {
    if (method === 'users.get') return [{ id: 123 }];
    if (method === 'docs.getUploadServer') return { upload_url: 'https://pu.vk.ru/upload' };
    if (method === 'docs.save') return { type: 'doc', doc: { owner_id: 123, id: 456 } };
    throw new Error('Unexpected method');
  });
  upload.mockReset().mockResolvedValue({ ok: true, json: async () => ({ file: 'uploaded-file' }) });
});

const document = (id: number, extra: Record<string, unknown> = {}) => ({
  id, owner_id: 123, title: `vkify-settings-${id}.json`, date: id * 100,
  size: 200, ext: 'json', tags: ['vkify', 'settings'], url: 'https://sun9.userapi.com/settings.json', ...extra,
});

describe('restoring VK settings documents', () => {
  it('finds tagged JSON files in the current profile and sorts newest first', async () => {
    api.mockResolvedValueOnce([{ id: 123 }]).mockResolvedValueOnce({ count: 5, items: [
      document(1, { title: 'Renamed backup.json' }), document(2), document(3, { tags: ['vkify'] }),
      document(4, { owner_id: 456 }), document(5, { ext: 'txt' }),
    ] });
    const list = await listSettingsDocuments(manager);
    expect(list.userId).toBe('123');
    expect(list.documents.map(doc => doc.id)).toEqual([2, 1]);
    expect(list.documents[0].savedAt).toBe(200_000);
    expect(list.documents[1].title).toBe('Renamed backup.json');
    expect(api).toHaveBeenCalledWith(manager, 'docs.get', { owner_id: '123', count: 1000, offset: 0, return_tags: 1 }, 0, '123');
  });

  it('continues past unrelated documents and returns backups from later pages', async () => {
    api.mockResolvedValueOnce([{ id: 123 }])
      .mockResolvedValueOnce({ count: 2, items: [document(1, { tags: [] })] })
      .mockResolvedValueOnce({ count: 2, items: [document(2)] });
    expect((await listSettingsDocuments(manager)).documents.map(doc => doc.id)).toEqual([2]);
    expect(api).toHaveBeenLastCalledWith(manager, 'docs.get', { owner_id: '123', count: 1000, offset: 1, return_tags: 1 }, 0, '123');
  });

  it('returns an empty list when the profile has no tagged backups', async () => {
    api.mockResolvedValueOnce([{ id: 123 }]).mockResolvedValueOnce({ count: 0, items: [] });
    await expect(listSettingsDocuments(manager)).resolves.toEqual({ documents: [], userId: '123' });
  });

  it('downloads only the selected document and checks the account again afterwards', async () => {
    api.mockResolvedValueOnce([document(2)]).mockResolvedValueOnce([{ id: 123 }]);
    const json = JSON.stringify({ version: '2.0.0', exportedAt: new Date().toISOString(), settings: { hide_stories: true } });
    upload.mockResolvedValueOnce(new Response(json));
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toBe(json);
    expect(api).toHaveBeenNthCalledWith(1, manager, 'docs.getById', { docs: '123_2', return_tags: 1 }, 0, '123');
    expect(upload.mock.calls[0][0]).toBe('https://sun9.userapi.com/settings.json');
    expect(upload.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'follow' });
    expect(api).toHaveBeenLastCalledWith(manager, 'users.get', {}, 0, '123');
  });

  it.each([
    Object.assign(new Error('Unknown method passed'), { code: '3' }),
    new Error('Unknown method passed'),
  ])('falls back to docs.get when docs.getById is unavailable: %s', async (error) => {
    api.mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ count: 2, items: [document(1), document(2)] })
      .mockResolvedValueOnce([{ id: 123 }]);
    const json = '{"settings":{"hide_stories":true}}';
    upload.mockResolvedValueOnce(new Response(json));
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toBe(json);
    expect(api).toHaveBeenNthCalledWith(2, manager, 'docs.get', {
      owner_id: '123', count: 1000, offset: 0, return_tags: 1,
    }, 0, '123');
  });

  it('searches later pages when the selected backup is older', async () => {
    api.mockRejectedValueOnce(Object.assign(new Error('Unknown method passed'), { code: '3' }))
      .mockResolvedValueOnce({ count: 2, items: [document(1)] })
      .mockResolvedValueOnce({ count: 2, items: [document(2)] })
      .mockResolvedValueOnce([{ id: 123 }]);
    upload.mockResolvedValueOnce(new Response('{"settings":{"hide_stories":true}}'));
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toContain('hide_stories');
    expect(api).toHaveBeenNthCalledWith(3, manager, 'docs.get', {
      owner_id: '123', count: 1000, offset: 1, return_tags: 1,
    }, 0, '123');
  });

  it('reports a removed document after falling back', async () => {
    api.mockRejectedValueOnce(Object.assign(new Error('Unknown method passed'), { code: '3' }))
      .mockResolvedValueOnce({ count: 1, items: [document(1)] });
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code: 'VK_DOCUMENT_NOT_FOUND' });
    expect(upload).not.toHaveBeenCalled();
  });

  it.each(['15', 'ACCOUNT_CHANGED'])('preserves API error %s without falling back', async (code) => {
    api.mockRejectedValueOnce(Object.assign(new Error('API error'), { code }));
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code });
    expect(api).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
  });

  it('allows a document link to redirect to its file on the VK CDN', async () => {
    api.mockResolvedValueOnce([document(2, { url: 'https://vk.ru/doc123_2?api=1' })]).mockResolvedValueOnce([{ id: 123 }]);
    const json = '{"settings":{"hide_stories":true}}';
    upload.mockImplementationOnce(async (_url, init: RequestInit) => {
      if (init.redirect === 'error') throw new TypeError('Failed to fetch');
      const response = new Response(json);
      Object.defineProperty(response, 'url', { value: 'https://sun9.userapi.com/settings.json' });
      return response;
    });
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toBe(json);
  });

  it.each(['https://psv4.vkuserphoto.ru/settings.json', 'https://vkuserphoto.ru/settings.json'])('downloads documents from the photo CDN: %s', async (url) => {
    api.mockResolvedValueOnce([document(2, { url })]).mockResolvedValueOnce([{ id: 123 }]);
    const json = '{"settings":{"hide_stories":true}}';
    const response = new Response(json);
    Object.defineProperty(response, 'url', { value: url });
    upload.mockResolvedValueOnce(response);
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toBe(json);
    expect(upload.mock.calls[0][0]).toBe(url);
  });

  it('accepts a redirect from VK to the photo CDN', async () => {
    api.mockResolvedValueOnce([document(2, { url: 'https://vk.ru/doc123_2?api=1' })]).mockResolvedValueOnce([{ id: 123 }]);
    const json = '{"settings":{"hide_stories":true}}';
    const response = new Response(json);
    Object.defineProperty(response, 'url', { value: 'https://psv4.vkuserphoto.ru/settings.json' });
    upload.mockResolvedValueOnce(response);
    await expect(readSettingsDocument(manager, '123', 2)).resolves.toBe(json);
  });

  it.each(['https://psv4.vkuserphoto.ru.evil.test/settings.json', 'https://evilvkuserphoto.ru/settings.json', 'http://psv4.vkuserphoto.ru/settings.json'])('rejects an invalid photo CDN URL: %s', async (url) => {
    api.mockResolvedValueOnce([document(2, { url })]);
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code: 'VK_DOCUMENT_URL' });
    expect(upload).not.toHaveBeenCalled();
  });

  it('rejects a final download URL outside VK servers', async () => {
    api.mockResolvedValueOnce([document(2)]);
    const response = new Response('{"settings":{"hide_stories":true}}');
    Object.defineProperty(response, 'url', { value: 'https://evil.test/settings.json' });
    upload.mockResolvedValueOnce(response);
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code: 'VK_DOCUMENT_URL' });
  });

  it('reports the download stage and original HTTP error', async () => {
    api.mockResolvedValueOnce([document(2)]);
    upload.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code: 'VK_DOCUMENT_DOWNLOAD', message: 'HTTP 403' });
  });

  it.each([
    { owner_id: 456 }, { tags: [] }, { id: 3 }, { ext: 'txt' },
    { url: 'https://evil.test/settings.json' },
  ])('rejects changed metadata before downloading: %j', async (extra) => {
    api.mockResolvedValueOnce([document(2, extra)]);
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it.each(['<html>Error</html>', '{"settings":[]}', '{"settings":{}}', '{"settings":{"vk_access_token":"secret"}}'])('rejects malformed or empty settings: %s', async (json) => {
    api.mockResolvedValueOnce([document(2)]);
    upload.mockResolvedValueOnce(new Response(json));
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toThrow();
  });

  it('rejects an oversized download', async () => {
    api.mockResolvedValueOnce([document(2)]);
    upload.mockResolvedValueOnce(new Response('{}', { headers: { 'content-length': String(33 * 1024 * 1024) } }));
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toThrow('too large');
  });

  it('rejects settings when the account changes during the download', async () => {
    api.mockResolvedValueOnce([document(2)])
      .mockRejectedValueOnce(Object.assign(new Error('Account changed'), { code: 'ACCOUNT_CHANGED' }));
    upload.mockResolvedValueOnce(new Response('{"settings":{"hide_stories":true}}'));
    await expect(readSettingsDocument(manager, '123', 2)).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  });
});

describe('VK settings documents', () => {
  it('uploads an importable file without credentials, caches, migration backups or stats', async () => {
    const result = await saveSettingsDocument(manager, {
      hide_stories: true, custom_css: 'body { color: red; }',
      [StorageKey.VK_ACCESS_TOKEN]: 'secret', [StorageKey.VK_USER_ID]: '123',
      telegram_bot_token: 'secret-bot', schema_version: 17,
      settings_backup_v16: { secret: true }, stats_ads_blocked: 42,
      activity_123: ['private'], friends_audit_v1_123: { friends: [] },
    });
    expect(result.url).toBe('https://vk.ru/doc123_456');
    const [url, options] = upload.mock.calls[0];
    expect(url).toBe('https://pu.vk.ru/upload');
    expect(options).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error' });
    const file = (options.body as FormData).get('file') as File;
    expect(file.name).toMatch(/^vkify-settings-.*\.json$/);
    const data = JSON.parse(await file.text());
    expect(data).toMatchObject({ version: '2.0.0', settings: { hide_stories: true, custom_css: 'body { color: red; }' } });
    expect(Object.keys(data.settings)).toHaveLength(2);
    expect(api).toHaveBeenCalledWith(manager, 'docs.getUploadServer', {}, 0, '123');
    expect(api).toHaveBeenCalledWith(manager, 'docs.save', {
      file: 'uploaded-file', title: file.name, tags: 'vkify,settings',
    }, 0, '123');
  });

  it('coalesces concurrent requests into a single document', async () => {
    const first = saveSettingsDocument(manager, { hide_stories: true });
    const second = saveSettingsDocument(manager, { hide_stories: true });
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('does not save when uploading fails and allows a later retry', async () => {
    upload.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(saveSettingsDocument(manager, {})).rejects.toThrow('HTTP 500');
    expect(api.mock.calls.some(([, method]) => method === 'docs.save')).toBe(false);
    await expect(saveSettingsDocument(manager, {})).resolves.toEqual({ url: 'https://vk.ru/doc123_456' });
  });

  it('rejects a response without an uploaded file', async () => {
    upload.mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'bad file' }) });
    await expect(saveSettingsDocument(manager, {})).rejects.toThrow('did not accept');
    expect(api.mock.calls.some(([, method]) => method === 'docs.save')).toBe(false);
  });

  it.each(['https://vk.ru.evil.test/upload', 'http://pu.vk.ru/upload', 'https://user:pass@pu.vk.ru/upload'])('rejects an untrusted upload URL: %s', async (url) => {
    api.mockResolvedValueOnce([{ id: 123 }]).mockResolvedValueOnce({ upload_url: url });
    await expect(saveSettingsDocument(manager, {})).rejects.toThrow('Invalid VK upload server');
    expect(upload).not.toHaveBeenCalled();
  });

  it('does not report success after the account changes', async () => {
    api.mockResolvedValueOnce([{ id: 123 }])
      .mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' })
      .mockRejectedValueOnce(Object.assign(new Error('Account changed'), { code: 'ACCOUNT_CHANGED' }));
    await expect(saveSettingsDocument(manager, {})).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
  });

  it('rejects a saved document owned by another profile', async () => {
    api.mockResolvedValueOnce([{ id: 123 }])
      .mockResolvedValueOnce({ upload_url: 'https://pu.vk.ru/upload' })
      .mockResolvedValueOnce({ doc: { id: 456, owner_id: 999 } });
    await expect(saveSettingsDocument(manager, {})).rejects.toThrow('Invalid saved VK document');
  });
});
