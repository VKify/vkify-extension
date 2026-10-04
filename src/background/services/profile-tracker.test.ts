import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileTracker } from './profile-tracker.js';
import { callVKApi, type VKTokenManager } from '../utils/vk-api.js';
import { StorageHelper } from '../utils/storage.js';
import { StorageKey } from '../../shared/constants/storage-keys.js';
import type { NotificationService } from './notification-service.js';
import type { ExtensionSettings, VKUserRaw } from '../../types/index.js';
import { BackgroundTelegramNotifier } from '../../shared/telegram-notifications/notifier.js';

vi.mock('../utils/vk-api.js', () => ({ callVKApi: vi.fn(), isExpectedTokenError: () => false }));
vi.mock('../utils/storage.js', () => ({ StorageHelper: { saveToProfileSpyLog: vi.fn() } }));
const user = (extra: Partial<VKUserRaw> = {}): VKUserRaw => ({ id: 1, first_name: 'Test', last_name: 'User', photo_id: '1_100', has_photo: 1, photo_100: 'https://cdn.example/a.jpg?sig=1', status: '', ...extra });
const settings: Partial<ExtensionSettings> = { profile_tracked_users: [{ id: '1', name: 'Test', addedAt: 1 }], profile_spy_save_log: true };
let tracker: ProfileTracker;
const getStorage = vi.fn<() => Promise<Record<string, unknown>>>();
beforeEach(() => {
  vi.clearAllMocks();
  getStorage.mockResolvedValue({});
  vi.stubGlobal('chrome', { storage: { local: { get: getStorage, set: vi.fn(async () => {}) } } });
  tracker = new ProfileTracker({ show: vi.fn() } as unknown as NotificationService, {} as VKTokenManager);
});
afterEach(() => vi.unstubAllGlobals());
async function check(value: VKUserRaw) { vi.mocked(callVKApi).mockResolvedValueOnce([value]); await tracker.checkUsers(settings); }
describe('stable avatar tracking', () => {
  it('delivers real avatar changes to Telegram even with long CDN URLs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } })));
    const notifier = new BackgroundTelegramNotifier({ fetch: fetchMock, readSettings: async () => ({ enabled: true, botToken: '123:token', chatId: '456', dedupeTtlMs: 1000 }) });
    tracker = new ProfileTracker({ show: vi.fn() } as unknown as NotificationService, {} as VKTokenManager, notifier);
    await check(user());
    expect(fetchMock).not.toHaveBeenCalled();
    await check(user({ photo_id: '1_101', photo_100: 'https://cdn.vk.ru/image?signature=' + 'a'.repeat(500) }));
    expect(StorageHelper.saveToProfileSpyLog).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request).toMatchObject({ chat_id: '456', rich_message: { html: expect.any(String) } });
    expect(request.rich_message.html).toContain('Новая аватарка');
  });
  it('ignores changing signatures, CDN hosts and image sizes for the same photo', async () => {
    await check(user());
    await check(user({ photo_100: 'https://another-cdn.example/b.jpg?sig=2' }));
    await check(user({ photo_100: 'https://cdn.example/resize.jpg?size=100&sig=3' }));
    expect(StorageHelper.saveToProfileSpyLog).not.toHaveBeenCalled();
  });
  it('records a real photo ID change once, even when URLs are equal', async () => {
    await check(user()); await check(user({ photo_id: '1_101' })); await check(user({ photo_id: '1_101' }));
    expect(StorageHelper.saveToProfileSpyLog).toHaveBeenCalledTimes(1);
    expect(StorageHelper.saveToProfileSpyLog).toHaveBeenCalledWith(expect.objectContaining({ changeType: 'avatar', icon: 'avatar' }));
  });
  it('migrates a URL-only snapshot without a false event', async () => {
    getStorage.mockResolvedValueOnce({ [StorageKey.USER_PROFILE_SNAPSHOT]: { '1': { photoUrl: 'https://old.example/image', status: '', friendsCount: null, lastChecked: 1 } } });
    await tracker.loadState(); await check(user());
    expect(StorageHelper.saveToProfileSpyLog).not.toHaveBeenCalled();
    expect(tracker.getStats().snapshots['1']?.photoId).toBe('1_100');
  });
  it('preserves identity when fields are missing and detects removal/restoration', async () => {
    await check(user()); await check(user({ photo_id: undefined, has_photo: undefined, photo_100: undefined }));
    await check(user()); expect(StorageHelper.saveToProfileSpyLog).not.toHaveBeenCalled();
    await check(user({ photo_id: undefined, has_photo: 0 })); await check(user());
    expect(StorageHelper.saveToProfileSpyLog).toHaveBeenCalledTimes(2);
  });
  it('does not run overlapping checks', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(callVKApi).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const pending = tracker.checkUsers(settings);
    await tracker.checkUsers(settings); resolve([user()]); await pending;
    expect(callVKApi).toHaveBeenCalledTimes(1);
  });
});
