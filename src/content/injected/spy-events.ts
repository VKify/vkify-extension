/**
 * Чистый разбор событий VK LongPoll нового мессенджера (формат v19) для слежки
 * за активностью в сообщениях.
 *
 * Вынесено из spy.ts (который живёт в IIFE и не тестируется): именно здесь
 * дважды возникали баги — URL лонгполла (`ruim` → `gim`), индексы полей в
 * апдейтах, текст удалённого сообщения. Модуль без DOM/Chrome API, покрыт
 * юнит-тестами. spy.ts импортирует это (Rollup инлайнит обратно в IIFE).
 */

import { t } from '@/content/i18n/index.js';

/** Ключ i18n для каждого кода события (текст берётся через `t()` при разборе,
 *  чтобы язык не «замерзал» на загрузке инжект-модуля). */
const EVENT_ACTION_KEYS: Record<number, string> = {
  63:    'spy.actions.typing',
  64:    'spy.actions.voice',
  65:    'spy.actions.upload_photo',
  66:    'spy.actions.upload_video',
  67:    'spy.actions.upload_file',
  115:   'spy.actions.calling',
  10002: 'spy.actions.deleted_all',
  10004: 'spy.actions.sent',
  10005: 'spy.actions.edited',
  10007: 'spy.actions.read',
  10013: 'spy.actions.cleared',
};

/** Локализованный текст события по коду (пустая строка — неизвестный код). */
function eventAction(code: number): string {
  const key = EVENT_ACTION_KEYS[code];
  return key ? t(key) : '';
}

export const EVENT_ICONS: Record<number, string> = {
  63: '⌨️', 64: '🎤',
  65: '📷', 66: '🎥', 67: '📎',
  81: '👻',
  115: '📞',
  10002: '🗑️', 10004: '💬', 10005: '✏️', 10007: '👁️', 10013: '🧹',
};

// Событие 90 приходит ТОЛЬКО при ваших действиях (v19): 2 = вы приняли заявку,
// 3 = вы удалили из друзей / отклонили заявку.
const FRIEND_ACTION_90_KEYS: Record<number, string> = {
  2: 'spy.actions.friend_accepted',
  3: 'spy.actions.friend_removed',
};

// Событие 52 v19 — изменения данных беседы: [52, updateType, peerId, extra].
const CHAT_EVENT_52_KEYS: Record<number, string> = {
  1:  'spy.chat.renamed',
  2:  'spy.chat.avatar',
  3:  'spy.chat.admin_set',
  5:  'spy.chat.pinned',
  6:  'spy.chat.joined',
  7:  'spy.chat.left',
  8:  'spy.chat.kicked',
  9:  'spy.chat.admin_removed',
  19: 'spy.chat.call',
};

// Под-типы 52, у которых extra-поле содержит userId — для них применима
// фильтрация «Только выбранные». Остальные под-типы пропускаются, если
// mode='selected' и трекаемого пользователя в событии нет.
export const CHAT_EVENT_HAS_USER_52 = new Set<number>([3, 6, 7, 8, 9]);

// Бит «удалено для всех» во флагах сообщения (событие 10002). LongPoll v19.
export const MSG_FLAG_DELETED_FOR_ALL = 131072; // 1 << 17

// VK peerId соглашение: < 2 000 000 000 — ЛС (peerId == userId после Math.abs),
// >= 2 000 000 000 — беседа. События уровня сообщения (10002 / 10007 / 10013)
// приходят с peerId, но не с senderId — для бесед атрибутировать конкретному
// пользователю нечем, поэтому такие события скипаем.
export const CHAT_PEER_THRESHOLD = 2_000_000_000;

/**
 * URL лонгполла нового мессенджера: `api.vk.com/<letters>im<digits>`
 * (реальный `gim822543105`, legacy `ruim…`). Настоящий фильтр — проверка формы
 * ответа (`updates`-массив) в spy.ts, поэтому широкий матч безопасен.
 */
export const LONGPOLL_URL_RE = /api\.vk\.com\/[a-z]*im\d/i;

export interface ParsedEvent {
  code: number;
  userId: number;
  action: string;
  extra: Record<string, unknown>;
}

export const asNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function peerToUser(peerId: number | null): number | null {
  if (peerId === null || peerId <= 0) return null;
  if (peerId >= CHAT_PEER_THRESHOLD) return null;
  return peerId;
}

/**
 * Разбирает один апдейт LongPoll в нормализованное событие слежки, либо null
 * (неинтересное/неатрибутируемое событие). Фильтрация по настройкам и кеш
 * текстов — снаружи (в spy.ts).
 */
export function parseEvent(update: unknown[]): ParsedEvent | null {
  if (!Array.isArray(update) || update.length === 0) return null;

  const code = asNum(update[0]);
  if (code === null) return null;

  let userId: number | null = null;
  let action: string | null = null;
  const extra: Record<string, unknown> = {};

  switch (code) {
    // Статусные события: печать / голосовое / загрузка фото / видео / файла.
    // Структура [code, peerId, userIds, totalCount, timestamp]; берём первого.
    case 63: case 64: case 65: case 66: case 67: {
      const userIds = update[2];
      userId = Array.isArray(userIds)
        ? asNum(userIds[0])
        : asNum(update[1]); // fallback на старую структуру
      action = eventAction(code);
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
      action = state === 1 ? t('spy.actions.invis_on') : t('spy.actions.invis_off');
      extra.state = state;
      extra.timestamp = update[3];
      break;
    }

    // 90 — добавление/удаление из друзей (только ВАШИ действия).
    case 90: {
      const actionType = asNum(update[1]);
      userId = asNum(update[2]);
      if (actionType === null) return null;
      const friendKey = FRIEND_ACTION_90_KEYS[actionType];
      action = friendKey ? t(friendKey) : t('spy.actions.friend_other', { type: actionType });
      extra.actionType = actionType;
      break;
    }

    // 52 — изменение данных беседы. Берём только под-типы с userId в extra.
    case 52: {
      const updateType = asNum(update[1]);
      if (updateType === null) return null;
      if (!CHAT_EVENT_HAS_USER_52.has(updateType)) return null;
      userId = asNum(update[3]);
      const chatKey = CHAT_EVENT_52_KEYS[updateType];
      if (!chatKey) return null;
      action = t(chatKey);
      extra.updateType = updateType;
      extra.peerId = update[2];
      break;
    }

    case 115: {
      const callData = (update[1] && typeof update[1] === 'object')
        ? update[1] as Record<string, unknown>
        : null;
      userId = asNum(callData?.user_id) ?? asNum(callData?.peer_id);
      action = eventAction(115);
      extra.callData = callData;
      break;
    }

    // 10002 — установка флагов сообщения. Слушаем только «удалено для всех».
    // [10002, messageId, flags, peerId].
    case 10002: {
      const flags  = asNum(update[2]) ?? 0;
      const peerId = asNum(update[3]);
      if (!(flags & MSG_FLAG_DELETED_FOR_ALL)) return null;
      userId = peerToUser(peerId);
      if (userId === null) return null;
      action = eventAction(10002);
      extra.messageId = update[1];
      extra.peerId = peerId;
      break;
    }

    case 10004: {
      userId = asNum(update[4]);
      const flags = asNum(update[2]) ?? 0;
      if (flags & 2) return null;
      action = eventAction(10004);
      extra.text = (typeof update[6] === 'string' ? update[6] : '').substring(0, 100);
      extra.peerId = update[5];
      break;
    }

    case 10005: {
      userId = asNum(update[3]);
      const editFlags = asNum(update[2]) ?? 0;
      if (editFlags & 2) return null;
      action = eventAction(10005);
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
      action = eventAction(10007);
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
      action = eventAction(10013);
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

/**
 * Если апдейт — входящее сообщение (10004) с текстом, возвращает {id, text}
 * для кеша текстов (нужен, чтобы при удалении показать, ЧТО удалили).
 */
export function cachableMessage(update: unknown[]): { id: number; text: string } | null {
  if (!Array.isArray(update) || asNum(update[0]) !== 10004) return null;
  const id = asNum(update[1]);
  const text = typeof update[6] === 'string' ? update[6] : '';
  if (id === null || !text) return null;
  return { id, text };
}
