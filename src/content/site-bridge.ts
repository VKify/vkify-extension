import { installExtApi } from '../shared/ext-api.js';
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

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

const EXPOSED_KEYS: readonly string[] = keysForScope('siteExpose');
const MAX_CATALOG_IMAGE_BYTES = 5 * 1024 * 1024;

// Pin every outbound message to the vkify.ru page's own origin. '*' would
// leak the announced settings to any cross-origin iframe/embedder of the page.
const ORIGIN = window.location.origin;

function isCatalogImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && url.pathname.startsWith('/wallpapers/images/');
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('invalid-image-result'));
    reader.onerror = () => reject(new Error('image-read-failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * VK blocks arbitrary image hosts in its img-src CSP. Catalog images are owned
 * by the current VKify origin, so the bridge can safely fetch their bytes and
 * persist a data: URL before the setting ever reaches a VK tab.
 */
async function prepareCatalogImage(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (settings.background_type !== 'image' || !isCatalogImageUrl(settings.custom_background)) return settings;

  const response = await fetch(settings.custom_background, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`image-http-${response.status}`);
  const blob = await response.blob();
  if (!/^image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)$/i.test(blob.type)) throw new Error('unsupported-image-type');
  if (blob.size === 0 || blob.size > MAX_CATALOG_IMAGE_BYTES) throw new Error('catalog-image-too-large');

  return { ...settings, custom_background: await blobToDataUrl(blob) };
}

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
  if (event.origin !== ORIGIN) return;

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
      const prepared = await prepareCatalogImage(safe);
      await chrome.storage.local.set(prepared);
      // Уведомляем все VK-вкладки, чтобы они перезагрузили фичи.
      // storage.onChanged срабатывает только при изменении значения, поэтому
      // RELOAD_FEATURES гарантирует применение даже когда значение совпадает с предыдущим.
      chrome.runtime.sendMessage({ type: 'RELOAD_FEATURES' }).catch(() => {});
      window.postMessage({ type: 'VKIFY_SETTINGS_SAVED', settings: prepared }, ORIGIN);
    } catch {
      window.postMessage({ type: 'VKIFY_SETTINGS_ERROR', reason: 'background_image_failed' }, ORIGIN);
    }
  }
});

// Объявляем после короткой задержки — страница успевает установить listener
setTimeout(announce, 150);
