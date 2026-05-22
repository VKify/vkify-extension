/**
 * Tests for MessageHandler — focusing on security-critical paths:
 *   - APPLY_SHARED_THEME: base64 decode → whitelist filter → type validation → storage write
 *   - Message routing (GET_SETTINGS, unknown type)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be stubbed before any module that accesses chrome is imported.

const storageMock = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
};

vi.stubGlobal('chrome', {
  storage: { local: storageMock },
  tabs: { query: vi.fn().mockResolvedValue([]), sendMessage: vi.fn() },
  runtime: { sendMessage: vi.fn() },
  alarms: { clear: vi.fn(), create: vi.fn() },
});


vi.mock('../background/utils/tabs.js', () => ({
  TabsHelper: {
    hasVKTabs: vi.fn().mockResolvedValue(false),
    notifyAllVKTabs: vi.fn().mockResolvedValue(undefined),
    sendToActiveVKTab: vi.fn().mockResolvedValue(undefined),
    notifyPopup: vi.fn().mockResolvedValue(undefined),
  },
}));


import { MessageHandler } from '../background/handlers/message-handler.js';
import { TabsHelper } from '../background/utils/tabs.js';


/** Encodes a theme payload the same way the background script decodes it. */
function encodeTheme(payload: Record<string, unknown>): string {
  const json = JSON.stringify({ p: payload });
  let binary = '';
  const bytes = new TextEncoder().encode(json);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeHandler() {
  const mockSpyTracker = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    loadState: vi.fn().mockResolvedValue(undefined),
    triggerCheck: vi.fn().mockResolvedValue(undefined),
    handleSettingsChange: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({ stats: { checks: 0, isRunning: false }, userStatus: {} }),
    isRunning: false,
  };
  const mockAlarmManager = {};
  const mockNotificationService = { showStatusChange: vi.fn(), show: vi.fn(), clear: vi.fn() };
  const mockTokenManager = {
    get: vi.fn().mockResolvedValue({ token: 'tok', userId: '1', expiresAt: null, status: 'valid' }),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    requestFresh: vi.fn().mockResolvedValue({ token: 'fresh', reason: null }),
  };
  const mockProfileTracker = {
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    loadState: vi.fn().mockResolvedValue(undefined),
    triggerCheck: vi.fn().mockResolvedValue(undefined),
    handleSettingsChange: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({ stats: { checks: 0, isRunning: false }, snapshots: {} }),
    isRunning: false,
  };
  return {
    handler: new MessageHandler(
      mockSpyTracker as never,
      mockProfileTracker as never,
      mockAlarmManager as never,
      mockNotificationService as never,
      mockTokenManager as never,
    ),
    mockTokenManager,
  };
}


describe('MessageHandler.handleApplySharedTheme', () => {
  beforeEach(() => {
    storageMock.set.mockClear();
    vi.mocked(TabsHelper.notifyAllVKTabs).mockClear();
  });

  it('applies a valid theme payload and writes to storage', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({ custom_theme: 'dark', border_radius: 12, background_opacity: 0.8 });

    const result = await handler.handleApplySharedTheme(encoded);

    expect(result).toMatchObject({ success: true });
    expect(storageMock.set).toHaveBeenCalledOnce();

    const [written] = storageMock.set.mock.calls[0] as [Record<string, unknown>];
    expect(written.custom_theme).toBe('dark');
    expect(written.border_radius).toBe(12);
    expect(written.background_opacity).toBe(0.8);
  });

  it('notifies all VK tabs after applying a valid theme', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({ custom_theme: 'light' });

    await handler.handleApplySharedTheme(encoded);

    expect(TabsHelper.notifyAllVKTabs).toHaveBeenCalledWith({ type: 'RELOAD_FEATURES' });
  });

  it('strips unknown keys from payload (only whitelisted keys written)', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({
      custom_theme: 'dark',
      __proto__: { polluted: true },
      evil_key: 'injected',
      constructor: 'attack',
    });

    const result = await handler.handleApplySharedTheme(encoded);

    expect(result).toMatchObject({ success: true });
    const [written] = storageMock.set.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(written)).not.toContain('evil_key');
    expect(Object.keys(written)).not.toContain('__proto__');
    expect(Object.keys(written)).not.toContain('constructor');
    expect(written.custom_theme).toBe('dark');
  });

  it('rejects wrong types for numeric fields (object injection)', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({
      background_opacity: { __proto__: { isAdmin: true } }, // object instead of number
      border_radius: [1, 2, 3],                              // array instead of number
      custom_theme: 'dark',                                  // valid
    });

    await handler.handleApplySharedTheme(encoded);

    const [written] = storageMock.set.mock.calls[0] as [Record<string, unknown>];
    expect(written).not.toHaveProperty('background_opacity');
    expect(written).not.toHaveProperty('border_radius');
    expect(written.custom_theme).toBe('dark');
  });

  it('rejects invalid enum values for background_type', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({
      background_type: 'javascript:alert(1)', // not in allowed enum
      custom_theme: 'dark',
    });

    await handler.handleApplySharedTheme(encoded);

    const [written] = storageMock.set.mock.calls[0] as [Record<string, unknown>];
    expect(written).not.toHaveProperty('background_type');
    expect(written.custom_theme).toBe('dark');
  });

  it('accepts all valid background_type enum values', async () => {
    const { handler } = makeHandler();
    for (const validType of ['image', 'video', 'embed', 'web']) {
      storageMock.set.mockClear();
      const encoded = encodeTheme({ background_type: validType });
      await handler.handleApplySharedTheme(encoded);
      const [written] = storageMock.set.mock.calls[0] as [Record<string, unknown>];
      expect(written.background_type).toBe(validType);
    }
  });

  it('returns error for malformed base64', async () => {
    const { handler } = makeHandler();
    const result = await handler.handleApplySharedTheme('!!!not-valid-base64!!!');
    expect(result).toMatchObject({ success: false });
    expect(storageMock.set).not.toHaveBeenCalled();
  });

  it('returns error for empty string', async () => {
    const { handler } = makeHandler();
    const result = await handler.handleApplySharedTheme('');
    expect(result).toMatchObject({ success: false, error: 'No encoded payload' });
  });

  it('returns error when payload has no valid keys', async () => {
    const { handler } = makeHandler();
    const encoded = encodeTheme({ totally_unknown: 'value', another_bad: 42 });
    const result = await handler.handleApplySharedTheme(encoded);
    expect(result).toMatchObject({ success: false });
    expect(storageMock.set).not.toHaveBeenCalled();
  });

  it('returns error when payload.p is not an object', async () => {
    const { handler } = makeHandler();
    const json = JSON.stringify({ p: 'not-an-object' });
    let binary = '';
    const bytes = new TextEncoder().encode(json);
    for (const b of bytes) binary += String.fromCharCode(b);
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = await handler.handleApplySharedTheme(encoded);
    expect(result).toMatchObject({ success: false });
  });
});

describe('MessageHandler.handle – routing', () => {
  it('GET_SETTINGS returns storage contents', async () => {
    const { handler } = makeHandler();
    storageMock.get.mockResolvedValueOnce({ custom_theme: 'dark', border_radius: 8 });

    const result = await handler.handle(
      { type: 'GET_SETTINGS' } as never,
      {} as chrome.runtime.MessageSender,
    );

    expect(result).toMatchObject({ success: true, settings: { custom_theme: 'dark', border_radius: 8 } });
  });

  it('unknown message type returns error result', async () => {
    const { handler } = makeHandler();
    const result = await handler.handle(
      { type: 'TOTALLY_UNKNOWN_TYPE' } as never,
      {} as chrome.runtime.MessageSender,
    );

    expect(result).toMatchObject({ success: false, error: 'Unknown message type' });
  });

  it('CHECK_VK_TABS returns hasVKTabs from TabsHelper', async () => {
    const { handler } = makeHandler();
    vi.mocked(TabsHelper.hasVKTabs).mockResolvedValueOnce(true);

    const result = await handler.handle(
      { type: 'CHECK_VK_TABS' } as never,
      {} as chrome.runtime.MessageSender,
    ) as { hasVKTabs: boolean };

    expect(result.hasVKTabs).toBe(true);
  });
});
