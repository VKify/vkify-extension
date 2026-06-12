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
import { VKTokenError, fetchVKMethod } from '../shared/utils/vk-fetch.js';
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

/** Creates a fetch response that looks like a VK token error (code 5). */
function mockFetchTokenError() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ error: { error_code: 5, error_msg: 'User authorization failed' } }),
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

  it('treats VK error code 15 as an expired token (retry)', async () => {
    const tm = makeTokenManager({ token: 'expired', freshToken: 'new-tok' });

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ error: { error_code: 15, error_msg: 'Access denied' } }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ response: 'retried-ok' }),
      }),
    );

    const result = await callVKApi(tm as never, 'users.get', {});

    expect(result).toBe('retried-ok');
    expect(tm.clear).toHaveBeenCalledOnce();
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
