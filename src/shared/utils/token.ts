import { TokenStatus } from '../../types/index.js';

// Коды, которые выбрасывает TokenCodeError (background/utils/vk-api.ts).
const TOKEN_ERROR_CODES = new Set<string>([
  TokenStatus.NO_VK_TAB,
  TokenStatus.EXPIRED,
  TokenStatus.NO_TOKEN,
]);

// VKTokenError из shared/utils/vk-fetch.ts использует код 'TOKEN_EXPIRED'.
const VK_FETCH_ERROR_CODE = 'TOKEN_EXPIRED';

/**
 * Возвращает true, если ошибка ожидаема (токен отсутствует/устарел, нет вкладки VK).
 * Обрабатывает два типа ошибок:
 *   1. TokenCodeError — code ∈ TokenStatus values ('expired', 'no_token', 'no_vk_tab')
 *   2. VKTokenError   — code === 'TOKEN_EXPIRED'
 */
export function isExpectedTokenError(error: unknown): boolean {
  const err = error as { code?: string } | null;
  const code = err?.code ?? '';
  return TOKEN_ERROR_CODES.has(code) || code === VK_FETCH_ERROR_CODE;
}