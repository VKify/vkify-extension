import { VK_API_VERSION } from '../../shared/utils/vk-fetch.js';
import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { TtlCache } from '../../shared/utils/ttl-cache.js';

(function () {
  'use strict';

  type WindowWithSpy = Window & {
    __vkifySpyModule?: boolean;
    __VKifyTokenExtractor?: { getToken: () => string | null };
    __vkifySpyAPI?: Record<string, unknown>;
  };

  if ((window as WindowWithSpy).__vkifySpyModule) return;
  (window as WindowWithSpy).__vkifySpyModule = true;

  const EVENT_ACTIONS: Record<number, string> = {
    63:    'печатает сообщение',
    64:    'записывает голосовое',
    65:    'загружает фото',
    66:    'загружает видео',
    67:    'загружает файл',
    115:   'звонит вам',
    10002: 'удалил сообщение для всех',
    10004: 'отправил сообщение',
    10005: 'отредактировал сообщение',
    10007: 'прочитал сообщение',
    10013: 'очистил всю переписку',
  };

  const EVENT_ICONS: Record<number, string> = {
    63: '⌨️', 64: '🎤',
    65: '📷', 66: '🎥', 67: '📎',
    81: '👻',
    115: '📞',
    10002: '🗑️', 10004: '💬', 10005: '✏️', 10007: '👁️', 10013: '🧹',
  };

  // Событие 90 приходит ТОЛЬКО при ваших действиях (v19): 2 = вы приняли заявку,
  // 3 = вы удалили из друзей / отклонили заявку. Раньше метки были инвертированы.
  const FRIEND_ACTIONS_90: Record<number, string> = {
    2: 'вы приняли его заявку в друзья',
    3: 'вы удалили его из друзей',
  };

  // Событие 52 v19 — изменения данных беседы. peerId в update[2], extra в update[3].
  // Раньше код ошибочно трактовал это как «заявки в друзья». Фиксируем сюжеты,
  // где extra — это id участника (вступление/выход/исключение) и подобные.
  const CHAT_EVENT_ACTIONS_52: Record<number, string> = {
    1:  'переименовал беседу',
    2:  'обновил аватарку беседы',
    3:  'назначен администратором',
    5:  'закрепил сообщение',
    6:  'вступил в беседу',
    7:  'покинул беседу',
    8:  'был исключён из беседы',
    9:  'разжалован из администраторов',
    19: 'начал/завершил звонок в беседе',
  };

  // Под-типы 52, у которых extra-поле содержит userId — для них применима
  // фильтрация «Только выбранные». Остальные под-типы (1, 2, 5, 19, ...) пропускаются
  // когда mode='selected' и трекаемого пользователя в событии нет.
  const CHAT_EVENT_HAS_USER_52 = new Set<number>([3, 6, 7, 8, 9]);

  // Битовые флаги сообщения, нужные для трактовки события 10002.
  // См. LongPoll v19, раздел «Установка флагов сообщения».
  const MSG_FLAG_DELETED_FOR_ALL = 131072; // 1 << 17

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


  const Notifier = {
    requestPermission(): void {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },

    show(code: number, userInfo: UserInfo | null, action: string): void {
      if (!currentSettings?.browserNotify) return;
      if (Notification.permission !== 'granted') return;

      const icon = EVENT_ICONS[code] || '📨';
      const userName = userInfo?.name || 'ID ' + userInfo?.id;

      try {
        const notification = new Notification(`VKify Spy ${icon}`, {
          body: `${userName} ${action}`,
          icon: userInfo?.photo50 || 'https://vk.com/favicon.ico',
          tag: `vkify-spy-${code}-${userInfo?.id}-${Date.now()}`,
          silent: false,
        });

        setTimeout(() => notification.close(), 5000);

        notification.onclick = () => {
          window.focus();
          if (userInfo?.id) window.open(`https://vk.com/im?sel=${userInfo.id}`, '_blank');
          notification.close();
        };
      } catch { /* ignore */ }
    },
  };


  interface ParsedEvent {
    code: number;
    userId: number;
    action: string;
    extra: Record<string, unknown>;
  }

  const asNum = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  // VK peerId соглашение: < 2 000 000 000 — ЛС (peerId == userId после Math.abs),
  // >= 2 000 000 000 — беседа. События уровня сообщения (10002 / 10007 / 10013)
  // приходят с peerId, но не с senderId — для бесед атрибутировать конкретному
  // пользователю нечем, поэтому такие события скипаем.
  const CHAT_PEER_THRESHOLD = 2_000_000_000;
  function peerToUser(peerId: number | null): number | null {
    if (peerId === null || peerId <= 0) return null;
    if (peerId >= CHAT_PEER_THRESHOLD) return null;
    return peerId;
  }

  function parseEvent(update: unknown[]): ParsedEvent | null {
    if (!Array.isArray(update) || update.length === 0) return null;

    const code = asNum(update[0]);
    if (code === null) return null;

    let userId: number | null = null;
    let action: string | null = null;
    const extra: Record<string, unknown> = {};

    switch (code) {
      // Статусные события: печать / голосовое / загрузка фото / видео / файла.
      // У всех одинаковая структура [code, peerId, userIds, totalCount, timestamp].
      // VK кладёт сюда сразу список юзеров; берём первого как репрезентативного.
      case 63: case 64: case 65: case 66: case 67: {
        const userIds = update[2];
        userId = Array.isArray(userIds)
          ? asNum(userIds[0])
          : asNum(update[1]); // fallback на старую структуру
        action = EVENT_ACTIONS[code];
        if (code === 63) extra.peerId = update[1];
        break;
      }

      // 81 — изменение состояния невидимки друга.
      // [81, userId(neg), state, timestamp, -1, appId]
      case 81: {
        const rawUserId = asNum(update[1]);
        const state = asNum(update[2]);
        if (rawUserId === null || state === null) return null;
        userId = Math.abs(rawUserId);
        action = state === 1 ? 'включил невидимку' : 'выключил невидимку';
        extra.state = state;
        extra.timestamp = update[3];
        break;
      }

      // 90 — добавление/удаление из друзей. v19: приходит ТОЛЬКО для ВАШИХ
      // действий, actionType ∈ {2: вы приняли заявку, 3: вы удалили из друзей}.
      case 90: {
        const actionType = asNum(update[1]);
        userId = asNum(update[2]);
        if (actionType === null) return null;
        action = FRIEND_ACTIONS_90[actionType] || `действие с друзьями (${actionType})`;
        extra.actionType = actionType;
        break;
      }

      // 52 — изменение данных беседы. v19: [52, updateType, peerId, extra].
      // Берём только под-типы, у которых extra несёт userId (вступление / выход /
      // исключение / назначение и снятие админа) — для них работает фильтрация
      // «Только выбранные». Прочие под-типы (1/2/5/19/...) пропускаются: они
      // относятся к беседе целиком, а не к конкретному человеку.
      case 52: {
        const updateType = asNum(update[1]);
        if (updateType === null) return null;
        if (!CHAT_EVENT_HAS_USER_52.has(updateType)) return null;
        userId = asNum(update[3]);
        const label = CHAT_EVENT_ACTIONS_52[updateType];
        if (!label) return null;
        action = label;
        extra.updateType = updateType;
        extra.peerId = update[2];
        break;
      }

      case 115: {
        const callData = (update[1] && typeof update[1] === 'object')
          ? update[1] as Record<string, unknown>
          : null;
        userId = asNum(callData?.user_id) ?? asNum(callData?.peer_id);
        action = EVENT_ACTIONS[115];
        extra.callData = callData;
        break;
      }

      // 10002 — установка флагов сообщения. Слушаем только «удалено для всех»;
      // другие флаги (важное / прослушано / помечено как спам) для слежки — шум.
      // [10002, messageId, flags, peerId].
      case 10002: {
        const flags  = asNum(update[2]) ?? 0;
        const peerId = asNum(update[3]);
        if (!(flags & MSG_FLAG_DELETED_FOR_ALL)) return null;
        userId = peerToUser(peerId);
        if (userId === null) return null;
        action = EVENT_ACTIONS[10002];
        extra.messageId = update[1];
        extra.peerId = peerId;
        break;
      }

      case 10004: {
        userId = asNum(update[4]);
        const flags = asNum(update[2]) ?? 0;
        if (flags & 2) return null;
        action = EVENT_ACTIONS[10004];
        extra.text = (typeof update[6] === 'string' ? update[6] : '').substring(0, 100);
        extra.peerId = update[5];
        break;
      }

      case 10005: {
        userId = asNum(update[3]);
        const editFlags = asNum(update[2]) ?? 0;
        if (editFlags & 2) return null;
        action = EVENT_ACTIONS[10005];
        extra.text = (typeof update[5] === 'string' ? update[5] : '').substring(0, 100);
        extra.messageId = update[9];
        extra.editTimestamp = update[10];
        break;
      }

      // 10007 — собеседник прочитал ВАШИ сообщения до messageId.
      // [10007, peerId, messageId, count]
      case 10007: {
        const peerId = asNum(update[1]);
        userId = peerToUser(peerId);
        if (userId === null) return null;
        action = EVENT_ACTIONS[10007];
        extra.messageId = update[2];
        extra.peerId = peerId;
        break;
      }

      // 10013 — удалены все сообщения в диалоге до messageId.
      // [10013, peerId, messageId]
      case 10013: {
        const peerId = asNum(update[1]);
        userId = peerToUser(peerId);
        if (userId === null) return null;
        action = EVENT_ACTIONS[10013];
        extra.messageId = update[2];
        extra.peerId = peerId;
        break;
      }

      default:
        return null;
    }

    if (userId === null || userId <= 0 || !action) return null;

    return { code, userId, action, extra };
  }

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

    const parsed = parseEvent(update);
    if (!parsed) return;

    const { code, userId, action, extra } = parsed;

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

    // Logging delegated to the content script (saveSpyLogEntry → chrome.storage.local)
    // via the vkify-spy-data event below. No localStorage duplication.
    Notifier.show(code, userInfo, action);
    sendEvent({ code, userId, userName, action, icon, extra, userInfo });
  }

  // Observe (never modify) the long-poll response. The isActive gate keeps
  // overhead at zero when spy is disabled — the URL test and clone()+json()
  // only run while the spy is actually active.
  //
  // The new VK messenger long-polls `https://api.vk.com/gim<server>?version=…`
  // (POST, JSON body `{ts, pts, updates:[…]}`). The server-id prefix has varied
  // over time (`gim…`, `ruim…`), so match any `<letters>im<digits>` path on
  // api.vk.com; the real filter is the `updates` array shape check below, which
  // makes an over-broad URL match harmless.
  const LONGPOLL_URL_RE = /api\.vk\.com\/[a-z]*im\d/i;
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
          // Permission is managed by the popup UI; do not request it here.
        }
        break;

      case 'requestNotifications':
        Notifier.requestPermission();
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
