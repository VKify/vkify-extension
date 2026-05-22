/**
 * Tests for SpyTracker — lifecycle management (start/stop/triggerCheck)
 * and status-change notification logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';


const storageMock = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
};

const alarmsMock = {
  create: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};

vi.stubGlobal('chrome', {
  storage: { local: storageMock },
  alarms: alarmsMock,
});

// spy-tracker calls callVKApi(this.tokenManager, 'users.get', ...).
// We mock it at the module level to avoid real HTTP calls.

vi.mock('../background/utils/vk-api.js', () => ({
  callVKApi: vi.fn(),
  isExpectedTokenError: vi.fn(() => false),
  VKTokenManager: vi.fn(),
}));


import { SpyTracker } from '../background/services/spy-tracker.js';
import { callVKApi } from '../background/utils/vk-api.js';
import { AlarmName } from '../shared/constants/alarms.js';


function makeTracker() {
  const notificationService = {
    showStatusChange: vi.fn(),
    show: vi.fn(),
    clear: vi.fn(),
  };
  const tokenManager = {} as never;
  const tracker = new SpyTracker(notificationService as never, tokenManager as never);
  return { tracker, notificationService };
}

function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    spy_online: true,
    spy_online_interval: 60,
    online_tracked_users: [{ id: '123', name: 'Test User' }],
    spy_browser_notify: false,
    spy_save_log: false,
    ...overrides,
  };
}


describe('SpyTracker.start()', () => {
  beforeEach(() => {
    alarmsMock.create.mockClear();
    alarmsMock.clear.mockClear();
    storageMock.set.mockClear();
    vi.mocked(callVKApi).mockClear();
  });

  it('does nothing when spy_online is false', async () => {
    const { tracker } = makeTracker();
    await tracker.start(makeSettings({ spy_online: false }));

    expect(alarmsMock.create).not.toHaveBeenCalled();
    expect(tracker.isRunning).toBe(false);
  });

  it('does nothing when already running', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);

    await tracker.start(makeSettings());
    alarmsMock.create.mockClear();

    await tracker.start(makeSettings()); // second call
    expect(alarmsMock.create).not.toHaveBeenCalled();
  });

  it('creates an alarm with the correct period', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);

    await tracker.start(makeSettings({ spy_online_interval: 90 }));

    expect(alarmsMock.create).toHaveBeenCalledWith(
      AlarmName.ONLINE_SPY_CHECK,
      { periodInMinutes: 90 / 60 },
    );
  });

  it('clamps interval to minimum 0.5 minutes (Chrome Alarms API limit)', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);

    await tracker.start(makeSettings({ spy_online_interval: 1 })); // 1 second → 0.5 min min

    const [, alarmOptions] = alarmsMock.create.mock.calls[0] as [string, { periodInMinutes: number }];
    expect(alarmOptions.periodInMinutes).toBeGreaterThanOrEqual(0.5);
  });

  it('marks tracker as running and persists stats', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);

    await tracker.start(makeSettings());

    expect(tracker.isRunning).toBe(true);
    expect(storageMock.set).toHaveBeenCalled();
  });
});

describe('SpyTracker.stop()', () => {
  beforeEach(() => {
    alarmsMock.clear.mockClear();
    storageMock.set.mockClear();
  });

  it('clears the alarm and marks tracker as not running', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);
    await tracker.start(makeSettings());

    await tracker.stop();

    expect(tracker.isRunning).toBe(false);
    expect(alarmsMock.clear).toHaveBeenCalledWith(AlarmName.ONLINE_SPY_CHECK);
  });

  it('persists stopped state to storage', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([]);
    await tracker.start(makeSettings());
    storageMock.set.mockClear();

    await tracker.stop();

    expect(storageMock.set).toHaveBeenCalled();
    const [saved] = storageMock.set.mock.calls[0] as [Record<string, { isRunning: boolean }>];
    const statsKey = Object.keys(saved)[0];
    expect(saved[statsKey].isRunning).toBe(false);
  });
});

describe('SpyTracker.triggerCheck()', () => {
  beforeEach(() => {
    alarmsMock.clear.mockClear();
    vi.mocked(callVKApi).mockClear();
    storageMock.get.mockResolvedValue({});
  });

  it('clears alarm and stops when spy_online is false', async () => {
    const { tracker } = makeTracker();
    await tracker.triggerCheck({ spy_online: false, online_tracked_users: [] });

    expect(alarmsMock.clear).toHaveBeenCalledWith(AlarmName.ONLINE_SPY_CHECK);
    expect(tracker.isRunning).toBe(false);
  });

  it('clears alarm when tracked users list is empty', async () => {
    const { tracker } = makeTracker();
    await tracker.triggerCheck({ spy_online: true, online_tracked_users: [] });

    expect(alarmsMock.clear).toHaveBeenCalledWith(AlarmName.ONLINE_SPY_CHECK);
  });

  it('calls checkUsers when spy is active with tracked users', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([
      { id: 123, first_name: 'Ivan', last_name: 'P', online: 1 },
    ]);

    await tracker.triggerCheck({
      spy_online: true,
      online_tracked_users: [{ id: '123', name: 'Ivan P' }],
    });

    expect(callVKApi).toHaveBeenCalledWith(
      expect.anything(),
      'users.get',
      expect.objectContaining({ user_ids: '123' }),
    );
  });
});

describe('SpyTracker.checkUsers() – status change notification', () => {
  beforeEach(() => {
    storageMock.get.mockResolvedValue({});
    storageMock.set.mockResolvedValue(undefined);
    vi.mocked(callVKApi).mockClear();
  });

  it('calls notificationService.showStatusChange when a user comes online', async () => {
    const { tracker, notificationService } = makeTracker();
    const settings = makeSettings({ spy_browser_notify: true });

    // First check: user is offline (no previous status → no notification)
    vi.mocked(callVKApi).mockResolvedValueOnce([
      { id: 123, first_name: 'Ivan', last_name: 'P', online: 0 },
    ]);
    await tracker.checkUsers(settings);
    expect(notificationService.showStatusChange).not.toHaveBeenCalled();

    // Second check: user comes online → notification should fire
    vi.mocked(callVKApi).mockResolvedValueOnce([
      { id: 123, first_name: 'Ivan', last_name: 'P', online: 1 },
    ]);
    await tracker.checkUsers(settings);

    expect(notificationService.showStatusChange).toHaveBeenCalledOnce();
    const [userId, , action] = notificationService.showStatusChange.mock.calls[0] as [string, string, string];
    expect(userId).toBe('123');
    expect(action).toContain('Зашёл');
  });

  it('does not show notification when spy_browser_notify is false', async () => {
    const { tracker, notificationService } = makeTracker();
    const settings = makeSettings({ spy_browser_notify: false });

    vi.mocked(callVKApi).mockResolvedValueOnce([{ id: 123, first_name: 'A', last_name: 'B', online: 0 }]);
    await tracker.checkUsers(settings);

    vi.mocked(callVKApi).mockResolvedValueOnce([{ id: 123, first_name: 'A', last_name: 'B', online: 1 }]);
    await tracker.checkUsers(settings);

    expect(notificationService.showStatusChange).not.toHaveBeenCalled();
  });

  it('does not throw when callVKApi rejects', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockRejectedValue(new Error('Network error'));

    await expect(tracker.checkUsers(makeSettings())).resolves.not.toThrow();
  });

  it('increments check counter on each successful poll', async () => {
    const { tracker } = makeTracker();
    vi.mocked(callVKApi).mockResolvedValue([
      { id: 123, first_name: 'A', last_name: 'B', online: 0 },
    ]);

    await tracker.checkUsers(makeSettings());
    await tracker.checkUsers(makeSettings());

    const { stats } = tracker.getStats();
    expect(stats.checks).toBe(2);
  });
});