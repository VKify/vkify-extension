/**
 * Tests for callVKApi — specifically the retry logic on token expiry.
 * This is the most security-sensitive path: a token error must trigger exactly
 * one refresh attempt, after which we either succeed or throw a typed error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: { query: vi.fn().mockResolvedValue([]), sendMessage: vi.fn() },
  runtime: { sendMessage: vi.fn() },
});


import { callVKApi } from '../background/utils/vk-api.js';
import { fetchVKMethod } from '../shared/utils/vk-fetch.js';
import { TokenStatus } from '../types/index.js';


/** Creates a mock VKTokenManager. */
function makeTokenManager(opts: {
  token?: string | null;
  freshToken?: string | null;
  freshReason?: string | null;
} = {}) {
  const { token = 'valid-token', freshToken = 'fresh-token', freshReason = null } = opts;
  return {
    get: vi.fn().mockResolvedValue({
      token,
      userId: '123',
      expiresAt: null,
      status: token ? TokenStatus.VALID : TokenStatus.NO_TOKEN,
    }),
    update: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    requestFresh: vi.fn().mockResolvedValue({ token: freshToken, reason: freshReason }),
  };
}

/** Creates a fetch response that looks like a VK API success. */
function mockFetchSuccess(response: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ response }),
  }));
}

/** Creates a fetch response for a generic (non-token) API error. */
function mockFetchApiError(msg = 'Internal error', code = 100) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ error: { error_code: code, error_msg: msg } }),
  }));
}


describe('callVKApi – happy path', () => {
  // clearAllMocks resets call counts on all vi.fn() instances (including stubbed globals)
  // without removing mock implementations set up in previous tests.
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls the API with the stored token and returns response', async () => {
    const tm = makeTokenManager({ token: 'tok123' });
    mockFetchSuccess([{ id: 1, first_name: 'Ivan', last_name: 'Petrov' }]);

    const result = await callVKApi(tm as never, 'users.get', { user_ids: '1' });

    expect(result).toEqual([{ id: 1, first_name: 'Ivan', last_name: 'Petrov' }]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.vk.ru/method/users.get',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(tm.get).toHaveBeenCalledOnce();
    expect(tm.clear).not.toHaveBeenCalled();
    expect(tm.requestFresh).not.toHaveBeenCalled();
  });

  it('requests a fresh token when none is stored, then calls API', async () => {
    const tm = makeTokenManager({ token: null, freshToken: 'brand-new-token' });
    mockFetchSuccess({ count: 5, items: [] });

    const result = await callVKApi(tm as never, 'friends.get', {});

    expect(tm.requestFresh).toHaveBeenCalledOnce();
    expect(result).toEqual({ count: 5, items: [] });
  });
});

describe('callVKApi – mutation account guard', () => {
  it('checks the exact token owner before a write', async () => {
    const tm = makeTokenManager();
    mockFetchSuccess([{ id: 999 }]);
    await expect(callVKApi(tm as never, 'groups.leave', { group_id: 1 }, 0, '123')).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://api.vk.ru/method/users.get', expect.anything());
  });

  it('rechecks ownership after refreshing an expired token', async () => {
    const tm = makeTokenManager();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ error: { error_code: 5, error_msg: 'Expired' } }) })
      .mockResolvedValueOnce({ json: async () => ({ response: [{ id: 999 }] }) }));
    await expect(callVKApi(tm as never, 'groups.leave', { group_id: 1 }, 0, '123')).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(tm.requestFresh).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).endsWith('/users.get'))).toBe(true);
  });
});

describe('callVKApi – token expiry retry logic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('clears the token and retries once when API returns error code 5', async () => {
    const tm = makeTokenManager({ token: 'expired-tok', freshToken: 'new-tok' });

    // First call returns token error, second call (after retry) succeeds
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ error: { error_code: 5, error_msg: 'Auth failed' } }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ response: 'ok' }),
      }),
    );

    const result = await callVKApi(tm as never, 'users.get', {});

    expect(result).toBe('ok');
    expect(tm.clear).toHaveBeenCalledOnce();
    expect(tm.requestFresh).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('throws after two token errors (no infinite retry)', async () => {
    const tm = makeTokenManager({ token: 'expired', freshToken: 'also-expired' });

    // Both calls return token error
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ error: { error_code: 5, error_msg: 'Auth failed' } }),
    }));

    await expect(callVKApi(tm as never, 'users.get', {}))
      .rejects
      .toSatisfy((e: unknown) => e instanceof Error && 'code' in e);

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2); // original + one retry
  });

  it('throws immediately when no token and no VK tabs available', async () => {
    const tm = makeTokenManager({ token: null, freshToken: null, freshReason: TokenStatus.NO_VK_TAB });

    await expect(callVKApi(tm as never, 'users.get', {}))
      .rejects
      .toMatchObject({ code: TokenStatus.NO_VK_TAB });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('does not retry on non-token API errors', async () => {
    const tm = makeTokenManager({ token: 'good-tok' });
    mockFetchApiError('Too many requests per second', 6);

    await expect(callVKApi(tm as never, 'users.get', {}))
      .rejects
      .toThrow('Too many requests per second');

    expect(tm.clear).not.toHaveBeenCalled();
    expect(tm.requestFresh).not.toHaveBeenCalled();
  });

  it('preserves the token when an object denies access (code 15)', async () => {
    const tm = makeTokenManager({ token: 'good-tok' });
    mockFetchApiError('Access denied', 15);
    await expect(callVKApi(tm as never, 'wall.get', {})).rejects.toMatchObject({ code: '15' });
    expect(tm.clear).not.toHaveBeenCalled();
    expect(tm.requestFresh).not.toHaveBeenCalled();
  });
});
describe('fetchVKMethod — method name validation', () => {
  it('rejects method names that would escape the /method/ URL path', async () => {
    mockFetchSuccess('ok');
    for (const bad of ['../oauth/authorize', 'users.get?x=1', 'users.get#f', 'a/b', '', 'users.get&v=1']) {
      await expect(fetchVKMethod(bad, 'tok')).rejects.toThrow('Invalid VK API method name');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts canonical VK method names', async () => {
    mockFetchSuccess('ok');
    await expect(fetchVKMethod('users.get', 'tok')).resolves.toBe('ok');
    await expect(fetchVKMethod('execute', 'tok')).resolves.toBe('ok');
  });
});

describe('fetchVKMethod — strict mutations', () => {
  it.each([
    { ok: false, status: 429, payload: { response: 1 }, code: '429' },
    { ok: true, payload: { response: 1, warnings: ['restricted'] }, code: 'API_WARNING' },
    { ok: true, payload: {}, code: 'INVALID_RESPONSE' },
    { ok: true, payload: { error: { error_code: 17, error_msg: 'Validate account' } }, code: '17' },
  ])('rejects $code without retries', async ({ ok, status, payload, code }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, json: async () => payload }));
    await expect(fetchVKMethod('friends.add', 'token', { user_id: 1 }, { strict: true })).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('accepts an empty warning list and passes cancellation through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: 1, warnings: [] }) }));
    const controller = new AbortController();
    await expect(fetchVKMethod('friends.add', 'token', { user_id: 1 }, { strict: true, signal: controller.signal })).resolves.toBe(1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
