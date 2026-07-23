import { useState, useEffect, useCallback } from 'react';
import type { VKUser, VKUserRaw, TokenStatusValue } from '@/types/index.js';
import { TokenStatus } from '@/types/index.js';
import { isExpectedTokenError } from '@/shared/utils/token.js';
import { countVKTabs } from '../../utils/tabs.js';
import { sendMessage as sendBg } from '@/shared/messaging.js';
import { formatUser } from '@/shared/vk/user.js';
import { buildUsersGet, buildSendMessage } from '@/shared/vk/params.js';

export interface VKApiHook {
  token: string | null;
  userId: string | null;
  hasToken: boolean;
  /** True only during initial token fetch — use for skeleton display. */
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  status: TokenStatusValue | null;
  currentUser: VKUser | null;
  isReady: boolean;
  needsVKTab: boolean;
  isTokenExpired: boolean;
  call: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  getUser: (targetUserId: string, fields?: string[]) => Promise<unknown>;
  getCurrentUser: () => Promise<VKUser | null>;
  getFriends: (targetUserId?: string | null, count?: number) => Promise<unknown>;
  sendMessage: (peerId: string, message: string, params?: Record<string, unknown>) => Promise<unknown>;
  refreshToken: () => Promise<unknown>;
}

export function useVKApi(): VKApiHook {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<VKUser | null>(null);
  const [status, setStatus] = useState<TokenStatusValue | null>(null);


  const getTokenAndUserId = useCallback(async (): Promise<unknown> => {
    setTokenLoading(true);
    try {
      const response = await sendBg({ type: 'GET_VK_TOKEN' });

      if (response?.token) {
        setToken(response.token);
        setStatus(TokenStatus.VALID);
        setError(null);
        setErrorCode(null);
      } else {
        setToken(null);
        const newStatus = response?.status ?? TokenStatus.NO_TOKEN;
        setStatus(newStatus);

        if (newStatus === TokenStatus.NO_VK_TAB) {
          setError(null);
          setErrorCode(TokenStatus.NO_VK_TAB);
        }
      }

      if (response?.userId) setUserId(response.userId);
      return response;
    } catch (err) {
      if (!isExpectedTokenError(err)) {
        console.error('[VKify] Error getting token:', err);
      }
      setStatus(TokenStatus.NO_TOKEN);
      return null;
    } finally {
      setTokenLoading(false);
    }
  }, []);


  const checkVKTabs = useCallback(async (): Promise<void> => {
    // Опрос вкладок идёт через background (countVKTabs → chrome.runtime.sendMessage),
    // чтобы работать и во фреймленной embed-странице Firefox, где своего
    // chrome.tabs нет.
    try {
      const hasVKTab = (await countVKTabs()) > 0;

      if (!hasVKTab && status !== TokenStatus.NO_VK_TAB) {
        setStatus(TokenStatus.NO_VK_TAB);
        setErrorCode(TokenStatus.NO_VK_TAB);
      } else if (hasVKTab && status === TokenStatus.NO_VK_TAB) {
        void getTokenAndUserId();
      }
    } catch (err) {
      console.error('[VKify] Error checking VK tabs:', err);
    }
  }, [status, getTokenAndUserId]);

  useEffect(() => {
    void getTokenAndUserId();

    const handleMessage = (message: { type: string; token?: string; userId?: string }): void => {
      if (message.type === 'VK_TOKEN_UPDATE') {
        if (message.token) {
          setToken(message.token);
          setStatus(TokenStatus.VALID);
          setError(null);
          setErrorCode(null);
        }
        if (message.userId) setUserId(message.userId);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    void checkVKTabs();

    // chrome.tabs отсутствует во фреймленной extension-странице Firefox (embed) —
    // тогда отслеживать открытие/закрытие вкладок не нужно (мы внутри vk.ru-таба).
    if (!chrome.tabs?.onCreated) return;

    const onTabChange = (): void => { void checkVKTabs(); };
    const onTabUpdated = (_id: number, info: { url?: string }): void => {
      if (info.url !== undefined) onTabChange();
    };

    chrome.tabs.onCreated.addListener(onTabChange);
    chrome.tabs.onRemoved.addListener(onTabChange);
    chrome.tabs.onUpdated.addListener(onTabUpdated);

    return () => {
      chrome.tabs.onCreated.removeListener(onTabChange);
      chrome.tabs.onRemoved.removeListener(onTabChange);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [checkVKTabs]);


  const call = useCallback(async (method: string, params: Record<string, unknown> = {}): Promise<unknown> => {
    setError(null);
    setErrorCode(null);

    try {
      const response = await sendBg({ type: 'VK_API_CALL', method, params });

      if (response.success) {
        return response.data;
      }

      const code = response.code ?? null;
      setErrorCode(code);

      if (isExpectedTokenError({ code })) {
        return null;
      }

      throw new Error(response.error ?? 'API call failed');
    } catch (err) {
      if (!isExpectedTokenError(err)) {
        setError((err as Error).message);
      }
      throw err;
    }
  }, []);


  const loadCurrentUser = useCallback(async (): Promise<VKUser | null> => {
    if (!userId) return null;

    try {
      const raw = await call(
        'users.get',
        buildUsersGet(userId, ['photo_50', 'photo_100', 'photo_200', 'online']),
      ) as VKUserRaw[] | null;

      if (raw?.[0]) {
        const mapped = formatUser(raw[0]);
        setCurrentUser(mapped);
        return mapped;
      }
      return null;
    } catch (err) {
      if (!isExpectedTokenError(err)) {
        console.error('[VKify] Error loading current user:', err);
        setError((err as Error).message);
      }
      return null;
    }
  }, [userId, call]);

  useEffect(() => {
    if (token && userId && !currentUser) {
      void loadCurrentUser();
    }
  }, [token, userId]); // eslint-disable-line react-hooks/exhaustive-deps


  const getUser = useCallback((targetUserId: string, fields: string[] = []): Promise<unknown> => {
    return call('users.get', buildUsersGet(targetUserId, ['photo_50', 'photo_100', 'online', 'city', ...fields]));
  }, [call]);

  const getFriends = useCallback((targetUserId: string | null = null, count = 100): Promise<unknown> => {
    const params: Record<string, unknown> = { count, fields: 'photo_50,online' };
    if (targetUserId) params['user_id'] = targetUserId;
    return call('friends.get', params);
  }, [call]);

  const sendMessage = useCallback((
    peerId: string,
    message: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> => {
    return call('messages.send', buildSendMessage(peerId, message, params));
  }, [call]);

  return {
    token,
    userId,
    hasToken: !!token,
    loading: tokenLoading,
    error,
    errorCode,
    status,
    currentUser,
    isReady: !!token && !!userId,
    needsVKTab: status === TokenStatus.NO_VK_TAB || errorCode === TokenStatus.NO_VK_TAB,
    isTokenExpired: status === TokenStatus.EXPIRED || errorCode === TokenStatus.EXPIRED,
    call,
    getUser,
    getCurrentUser: loadCurrentUser,
    getFriends,
    sendMessage,
    refreshToken: getTokenAndUserId,
  };
}
