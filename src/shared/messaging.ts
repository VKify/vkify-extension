/**
 * Типобезопасный слой обмена сообщениями с background.
 *
 * Раньше каждый вызывающий писал `chrome.runtime.sendMessage(...) as {...}` —
 * тип запроса и ответа не были связаны, опечатка в форме ответа всплывала только
 * в рантайме. Здесь единственный источник истины для формы ОТВЕТА на каждый тип
 * сообщения (`MessageResponses`), а `sendMessage()` выводит тип ответа из `type`
 * запроса. Каст живёт ровно в одном месте — внутри этой функции.
 *
 * Инвариант: `MessageResponses[T]` должен совпадать с тем, что возвращает
 * обработчик в background (см. background/handlers/message-handler.ts) и в
 * content (content/services/message-service.ts) для сообщения `T`.
 */
import type { ExtensionMessage, TokenStatusValue } from '../types/index.js';
import type { PerfSnapshot, PerfContext } from './constants/perf.js';

/** Базовый ответ-подтверждение для fire-and-forget сообщений. */
export interface OkResult {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Форма ответа на каждый тип сообщения, чей ответ кто-то читает. Типы, которых
 * здесь нет (fire-and-forget: ENABLE_FEATURE, START_ONLINE_SPY, OPEN_TAB, …),
 * получают `OkResult` по умолчанию (см. ResponseFor).
 */
export interface MessageResponses {
  GET_SETTINGS:           OkResult & { settings: Record<string, unknown> };
  GET_VK_TOKEN:           { token: string | null; userId: string | null; expiresAt: number | null; status: TokenStatusValue };
  CHECK_VK_TABS:          { hasVKTabs: boolean };
  GET_API_METHOD:         { hasVKTab: boolean; nativeApiAvailable?: boolean; hasToken?: boolean };
  GET_API_METHOD_INFO:    { nativeApiAvailable: boolean; hasToken: boolean };
  RELOAD_ACTIVE_VK_TAB:   { reloaded: boolean };
  QUERY_VK_TABS:          { count: number };
  PING:                   { pong: true; hasVKHostPermission: boolean };
  VK_API_CALL:            OkResult & { data?: unknown };
  GET_ONLINE_STATS:       OkResult & { stats: unknown; userStatus: unknown };
  GET_USER_ACTIVITY:      OkResult & { data: unknown };
  GET_SPY_LOG:            OkResult & { onlineLog: unknown[]; activityLog: unknown[] };
  GET_PROFILE_SPY_LOG:    OkResult & { profileLog: unknown[] };
  GET_PROFILE_SPY_STATS:  OkResult & { stats: unknown; snapshots: unknown };
  APPLY_SHARED_THEME:     OkResult & { applied?: string[] };
  // background собирает полный снимок; content отвечает только своей частью (context).
  GET_PERF_TELEMETRY:     OkResult & { snapshot: PerfSnapshot };
}

/** Ответ content-скрипта на GET_PERF_TELEMETRY — только его «context»-часть. */
export type PerfContextResponse = PerfContext;

/** Ответ для сообщения с заданным `type`. */
export type ResponseFor<T extends ExtensionMessage['type']> =
  T extends keyof MessageResponses ? MessageResponses[T] : OkResult;

/**
 * Отправляет сообщение в background и возвращает типизированный ответ.
 * Возвращает `undefined`, если канал недоступен (контекст расширения
 * инвалидирован / получатель закрыт) — поэтому результат опционален.
 */
export async function sendMessage<M extends ExtensionMessage>(
  message: M,
): Promise<ResponseFor<M['type']>> {
  return chrome.runtime.sendMessage(message) as Promise<ResponseFor<M['type']>>;
}
