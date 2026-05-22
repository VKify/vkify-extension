import type { TokenData, TokenStatusValue } from '../../types/index.js';
import { TokenStatus } from '../../types/index.js';
import { TabsHelper } from './tabs.js';
import { isExpectedTokenError } from '../../shared/utils/token.js';
import { fetchVKMethod, isVKTokenError } from '../../shared/utils/vk-fetch.js';
import { StorageKey } from '../../shared/constants/storage-keys.js';

export { TokenStatus } from '../../types/index.js';
export { isExpectedTokenError } from '../../shared/utils/token.js';


class TokenCodeError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

function makeTokenError(reason: TokenStatusValue): TokenCodeError {
  return new TokenCodeError(reason, reason);
}


export class VKTokenManager {

  async get(): Promise<TokenData> {
    try {
      const data = await chrome.storage.local.get([
        StorageKey.VK_ACCESS_TOKEN,
        StorageKey.VK_TOKEN_EXPIRES_AT,
        StorageKey.VK_USER_ID,
      ]);

      const expiresAt = data[StorageKey.VK_TOKEN_EXPIRES_AT] as number | undefined;

      if (expiresAt && Date.now() >= expiresAt) {
        console.log('[VKify] VK token expired by time');
        await chrome.storage.local.remove([StorageKey.VK_ACCESS_TOKEN, StorageKey.VK_TOKEN_EXPIRES_AT]);
        return {
          token: null,
          userId: (data[StorageKey.VK_USER_ID] as string) ?? null,
          expiresAt: null,
          status: TokenStatus.EXPIRED,
        };
      }

      const token = (data[StorageKey.VK_ACCESS_TOKEN] as string) ?? null;
      return {
        token,
        userId: (data[StorageKey.VK_USER_ID] as string) ?? null,
        expiresAt: expiresAt ?? null,
        status: token ? TokenStatus.VALID : TokenStatus.NO_TOKEN,
      };
    } catch (error) {
      console.log('[VKify] Could not get VK data:', (error as Error).message);
      return { token: null, userId: null, expiresAt: null, status: TokenStatus.NO_TOKEN };
    }
  }


  async update(
    token: string | undefined,
    userId: string | undefined,
    expiresAt?: number | null,
  ): Promise<void> {
    try {
      const data: Record<string, unknown> = {};
      if (token)     data[StorageKey.VK_ACCESS_TOKEN]     = token;
      if (userId)    data[StorageKey.VK_USER_ID]          = userId;
      if (expiresAt) data[StorageKey.VK_TOKEN_EXPIRES_AT] = expiresAt;

      if (Object.keys(data).length > 0) {
        await chrome.storage.local.set(data);
        console.log('[VKify] VK data saved', userId ? `(User ${userId})` : '');
      }
    } catch (err) {
      console.log('[VKify] Could not save VK data:', (err as Error).message);
    }
  }


  async clear(): Promise<void> {
    try {
      await chrome.storage.local.remove([StorageKey.VK_ACCESS_TOKEN, StorageKey.VK_TOKEN_EXPIRES_AT]);
      console.log('[VKify] Token cleared');
    } catch (err) {
      console.log('[VKify] Could not clear token:', (err as Error).message);
    }
  }


  async requestFresh(): Promise<{ token: string | null; reason: TokenStatusValue | null }> {
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });

      if (tabs.length === 0) {
        console.log('[VKify] No VK tabs open to refresh token');
        return { token: null, reason: TokenStatus.NO_VK_TAB };
      }

      for (const tab of tabs) {
        if (!tab.id) continue;
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_FRESH_TOKEN' });
          if (response?.token) {
            console.log('[VKify] Got fresh token from tab', tab.id);
            await this.update(response.token as string, response.userId as string, response.expiresAt as number);
            return { token: response.token as string, reason: null };
          }
        } catch {
          // Вкладка могла не ответить, пробуем следующую
          continue;
        }
      }

      console.log('[VKify] Could not get fresh token from any tab');
      return { token: null, reason: TokenStatus.NO_TOKEN };
    } catch (err) {
      console.log('[VKify] Could not request fresh token:', (err as Error).message);
      return { token: null, reason: TokenStatus.NO_TOKEN };
    }
  }
}

export async function callVKApi(
  tokenManager: VKTokenManager,
  method: string,
  params: Record<string, unknown> = {},
  _retryCount = 0,
): Promise<unknown> {
  // Шаг 1: получаем токен, при необходимости запрашиваем новый
  let { token } = await tokenManager.get();

  if (!token) {
    console.log('[VKify] No token, requesting fresh one...');
    const refreshResult = await tokenManager.requestFresh();
    token = refreshResult.token;

    if (!token) {
      throw makeTokenError(refreshResult.reason ?? TokenStatus.NO_TOKEN);
    }
  }

  // Шаг 2: делаем запрос; при ошибке токена — одна попытка обновления
  try {
    return await fetchVKMethod(method, token, params);
  } catch (error) {
    if (!isVKTokenError(error)) {
      // Обычная ошибка API — логируем и пробрасываем
      if (!isExpectedTokenError(error)) {
        console.error(`[VKify] VK API ${method} failed:`, (error as Error).message);
      }
      throw error;
    }

    // Токен протух — сбрасываем и пробуем один раз переполучить
    console.log('[VKify] Token invalid, clearing...');
    await tokenManager.clear();

    if (_retryCount > 0) {
      throw makeTokenError(TokenStatus.EXPIRED);
    }

    console.log('[VKify] Retrying with fresh token...');
    const retryResult = await tokenManager.requestFresh();

    if (!retryResult.token) {
      throw makeTokenError(retryResult.reason ?? TokenStatus.EXPIRED);
    }

    return callVKApi(tokenManager, method, params, _retryCount + 1);
  }
}

// (re-export чтобы не менять импорты в message-handler.ts)
export { TabsHelper };