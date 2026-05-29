import { VK_API_VERSION } from '../../shared/utils/vk-fetch.js';
import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { TtlCache } from '../../shared/utils/ttl-cache.js';
import { parseEvent, cachableMessage, EVENT_ICONS, LONGPOLL_URL_RE } from './spy-events.js';

(function () {
  'use strict';

  type WindowWithSpy = Window & {
    __vkifySpyModule?: boolean;
    __VKifyTokenExtractor?: { getToken: () => string | null };
    __vkifySpyAPI?: Record<string, unknown>;
  };

  if ((window as WindowWithSpy).__vkifySpyModule) return;
  (window as WindowWithSpy).__vkifySpyModule = true;

  interface UserInfo {
    id: number;
    name: string;
    firstName?: string;
    lastName?: string;
    photo50?: string;
  }

  interface SpySettings {
    enabled: boolean;
    typing: boolean;
    voice: boolean;
    uploads: boolean;       // 65/66/67 — загрузка фото/видео/файла
    read: boolean;
    delete: boolean;
    friends: boolean;       // событие 90
    chatEvents: boolean;    // событие 52 (вступление/выход/исключение в беседах)
    invisibility: boolean;  // событие 81 — изменение состояния невидимки друга
    messages: boolean;
    edit: boolean;
    calls: boolean;
    browserNotify: boolean;
    saveLog: boolean;
    mode: string;
    trackedUsers: Array<{ id: number | string }>;
  }

  let currentSettings: SpySettings | null = null;
  let isActive = false;


  const userCache = new TtlCache<number, UserInfo>();

  // Тексты входящих сообщений по messageId — чтобы при удалении (событие 10002)
  // показать, ЧТО именно удалили. LongPoll события удаления текст не несут, его
  // знаем только если видели исходное сообщение (10004), пока слежка активна.
  // 24 ч / 2000 сообщений: переживает «удалил час назад», но не растёт вечно.
  const messageCache = new TtlCache<number, string>(2000, 24 * 60 * 60 * 1000);

  /** Запоминает текст входящего сообщения для последующей атрибуции удаления. */
  function rememberMessageText(update: unknown[]): void {
    const m = cachableMessage(update);
    if (m) messageCache.set(m.id, m.text);
  }

  function getToken(): string | null {
    return (window as WindowWithSpy).__VKifyTokenExtractor?.getToken() || null;
  }

  async function getUserInfo(userId: number): Promise<UserInfo> {
    if (!userId) return { id: 0, name: 'Unknown' };

    const absId = Math.abs(userId);

    if (userCache.has(absId)) return userCache.get(absId)!;

    const token = getToken();
    if (!token) return { id: absId, name: `ID ${absId}` };

    try {
      const response = await fetch('https://api.vk.com/method/users.get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          user_ids: String(absId),
          fields: 'photo_50',
          access_token: token,
          v: VK_API_VERSION,
        }),
      });

      const data = await response.json() as {
        response?: Array<{ id: number; first_name: string; last_name: string; photo_50?: string }>;
        error?: { error_msg: string };
      };

      if (data.response?.[0]) {
        const user = data.response[0];
        const userInfo: UserInfo = {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          firstName: user.first_name,
          lastName: user.last_name,
          photo50: user.photo_50,
        };
        userCache.set(absId, userInfo);
        return userInfo;
      }

      if (data.error) console.warn('[VKify Spy] VK API error:', data.error.error_msg);
    } catch (e) {
      console.warn('[VKify Spy] Fetch error:', e);
    }

    const fallback: UserInfo = { id: absId, name: `ID ${absId}` };
    userCache.set(absId, fallback);
    return fallback;
  }


  // Уведомления показывает background через chrome.notifications (см. content
  // spy/index.ts → SHOW_NOTIFICATION). Раньше здесь был page-context
  // `new Notification()`, который требует разрешения уведомлений у самого
  // сайта vk.com (а не у расширения) и потому молча не срабатывал.


  function shouldProcess(code: number, userId: number): boolean {
    if (!currentSettings) return false;

    const categoryMap: Record<number, keyof SpySettings> = {
      63: 'typing', 64: 'voice',
      65: 'uploads', 66: 'uploads', 67: 'uploads',
      52: 'chatEvents', 90: 'friends',
      81: 'invisibility',
      115: 'calls',
      10002: 'delete', 10004: 'messages', 10005: 'edit', 10007: 'read',
      10013: 'delete',
    };

    const category = categoryMap[code];
    // Treat undefined (field absent from content script settings) as enabled —
    // preserves backward compatibility with older settings payloads.
    if (category && currentSettings[category] === false) return false;

    if (currentSettings.mode === 'selected' && userId) {
      const trackedIds = currentSettings.trackedUsers.map(u => String(u.id || u));
      if (!trackedIds.includes(String(Math.abs(userId)))) return false;
    }

    return true;
  }

  function sendEvent(data: Record<string, unknown>): void {
    window.dispatchEvent(new CustomEvent('vkify-spy-data', {
      detail: { type: 'vkify-spy-event', data },
    }));
  }

  async function processUpdate(update: unknown): Promise<void> {
    if (!Array.isArray(update)) return;

    // Кэшируем текст входящих до фильтрации — нужен для атрибуции удаления,
    // даже если категория «новые сообщения» в слежке выключена.
    rememberMessageText(update);

    const parsed = parseEvent(update);
    if (!parsed) return;

    const { code, userId, action, extra } = parsed;

    // Удаление для всех (10002): подставляем сохранённый текст сообщения, если
    // оно проходило через нас раньше. Текст уходит в extra.text и показывается
    // в логе цитатой — так же, как текст входящих сообщений (единый стиль).
    if (code === 10002) {
      const deletedText = messageCache.get(Number(extra.messageId));
      if (deletedText) extra.text = deletedText.slice(0, 200);
    }

    if (!shouldProcess(code, userId)) return;

    const userInfo = await getUserInfo(userId);

    const icon = EVENT_ICONS[code] || '📨';
    const userName = userInfo?.name || 'ID ' + Math.abs(userId);

    console.log(
      `%c[VKify Spy]%c ${icon} ${userName} ${action}`,
      'background: #5181b8; color: white; padding: 2px 6px; border-radius: 3px;',
      'color: inherit;',
      extra
    );

    // Logging and notifications are delegated to the content script
    // (saveSpyLogEntry → chrome.storage.local, SHOW_NOTIFICATION → background)
    // via the vkify-spy-data event below. No page-context Notification here.
    sendEvent({ code, userId, userName, action, icon, extra, userInfo });
  }

  // Observe (never modify) the long-poll response. The isActive gate keeps
  // overhead at zero when spy is disabled — the URL test and clone()+json()
  // only run while the spy is actually active. LONGPOLL_URL_RE и разбор
  // апдейтов живут в ./spy-events.ts (покрыты тестами).
  const unregisterFetchHook = registerResponseHook(async (url, response) => {
    if (!isActive) return response;
    if (!LONGPOLL_URL_RE.test(url)) return response;

    try {
      const data = await response.clone().json() as { updates?: unknown[] };
      if (data.updates && Array.isArray(data.updates)) {
        for (const update of data.updates) {
          processUpdate(update);
        }
      }
    } catch { /* ignore */ }

    return response;
  });


  window.addEventListener('vkify-spy-control', (event: Event) => {
    const { action, settings } = (event as CustomEvent<{ action: string; settings?: Partial<Record<string, unknown>> }>).detail || {};

    switch (action) {
      case 'enable':
        if (settings) {
          // Defaults для категорий, которых может не быть в payload от старого
          // content-скрипта (старые сборки не присылали uploads / chatEvents /
          // invisibility). undefined тут означало бы «отключено» в shouldProcess.
          currentSettings = {
            enabled: true,
            messages: true,
            edit: true,
            calls: true,
            uploads: true,
            invisibility: true,
            chatEvents: false,
            ...(settings as Partial<SpySettings>),
          } as SpySettings;
          isActive = true;
          // Notification permission is requested explicitly by the user via the
          // popup UI (NotificationPermissionBanner). Never request it automatically
          // from an injected script — browsers require a direct user gesture.
        }
        break;

      case 'disable':
        currentSettings = null;
        isActive = false;
        break;

      case 'updateSettings':
        if (settings && currentSettings) {
          Object.assign(currentSettings, settings);
        }
        break;
    }
  });


  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.type !== 'VKIFY_DESTROY') return;

    unregisterFetchHook();
    currentSettings = null;
    isActive = false;
    console.log('[VKify Spy] Destroyed');
  });

  // Debug API — stripped from production builds by Vite (import.meta.env.DEV → false).
  // window.__vkifySpyAPI exposes tracked user list and settings to the page context,
  // which VK's own JS could read and use to identify extension users.
  if (import.meta.env.DEV) {
    (window as WindowWithSpy).__vkifySpyAPI = {
      getSettings: () => currentSettings,
      hasToken: () => !!getToken(),
      testGetUser: (id: number) => getUserInfo(id),
      clearUserCache: () => userCache.clear(),
      events: () => {
        console.table([
          { code: 63, event: 'Печатает', category: 'typing' },
          { code: 64, event: 'Записывает голосовое', category: 'voice' },
          { code: 52, event: 'Заявка в друзья', category: 'friends' },
          { code: 90, event: 'Действия друзей', category: 'friends' },
          { code: 115, event: 'Входящий звонок', category: 'calls' },
          { code: 10002, event: 'Удалил для всех', category: 'delete' },
          { code: 10004, event: 'Новое сообщение', category: 'messages' },
          { code: 10005, event: 'Редактирование', category: 'edit' },
          { code: 10007, event: 'Прочитал', category: 'read' },
        ]);
      },
    };
  }

  // Starts inactive; content script sends vkify-spy-control:enable with settings
  // read from chrome.storage.local after the script-ready event fires.
  console.log('[VKify Spy] Module loaded: inactive until enable event');
  if (import.meta.env.DEV) {
    console.log('[VKify Spy] Token available:', !!getToken());
    console.log('[VKify Spy] События: __vkifySpyAPI.events()');
  }

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'spy' },
  }));
})();
