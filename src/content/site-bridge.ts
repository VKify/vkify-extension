/**
 * site-bridge.ts — content script, работает на vkify.ru и localhost.
 *
 * Мост между сайтом и расширением через window.postMessage:
 *   Сайт → расширение:  VKIFY_SAVE_SETTINGS  { settings }
 *   Сайт → расширение:  VKIFY_GET_SETTINGS    {}
 *   Расширение → сайт:  VKIFY_EXTENSION_READY { version, settings }
 *   Расширение → сайт:  VKIFY_SETTINGS_SAVED  { settings }
 *
 * Безопасность:
 *   - Только ключи со scope 'siteWrite' попадают в chrome.storage, и каждое
 *     значение проходит type-валидацию (sanitizeSettings).
 *   - Сайт получает только ключи со scope 'siteExpose' (без токена, без spy-данных).
 *   - event.source !== window проверяет, что сообщение из той же вкладки.
 *
 * Ключи/типы берутся из канонической settings-schema (единый источник истины).
 * Импорт shared/ здесь возможен потому, что site-bridge собирается как
 * самодостаточный IIFE (см. vite.config.ts).
 */

import { keysForScope, sanitizeSettings } from '../shared/constants/settings-schema.js';

const EXPOSED_KEYS: readonly string[] = keysForScope('siteExpose');

// Pin every outbound message to the vkify.ru page's own origin. '*' would
// leak the announced settings to any cross-origin iframe/embedder of the page.
const ORIGIN = window.location.origin;

async function announce(): Promise<void> {
  try {
    const all = await chrome.storage.local.get([...EXPOSED_KEYS]);
    const { version } = chrome.runtime.getManifest();

    window.postMessage(
      { type: 'VKIFY_EXTENSION_READY', version, settings: all },
      ORIGIN,
    );
  } catch {
    // storage недоступен — игнорируем
  }
}

window.addEventListener('message', async (event: MessageEvent) => {
  if (event.source !== window) return;

  const data = event.data as { type?: string; settings?: Record<string, unknown> };
  if (!data?.type?.startsWith('VKIFY_')) return;

  if (data.type === 'VKIFY_GET_SETTINGS') {
    await announce();
    return;
  }

  if (data.type === 'VKIFY_SAVE_SETTINGS' && data.settings) {
    // Канонический санитайзер: scope 'siteWrite' + проверка типа значения.
    const safe = sanitizeSettings(data.settings, 'siteWrite');

    if (Object.keys(safe).length === 0) return;

    try {
      await chrome.storage.local.set(safe);
      // Уведомляем все VK-вкладки, чтобы они перезагрузили фичи.
      // storage.onChanged срабатывает только при изменении значения, поэтому
      // RELOAD_FEATURES гарантирует применение даже когда значение совпадает с предыдущим.
      chrome.runtime.sendMessage({ type: 'RELOAD_FEATURES' }).catch(() => {});
      window.postMessage({ type: 'VKIFY_SETTINGS_SAVED', settings: safe }, ORIGIN);
    } catch {
      // игнорируем
    }
  }
});

// Объявляем после короткой задержки — страница успевает установить listener
setTimeout(announce, 150);