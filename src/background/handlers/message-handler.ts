import type { ExtensionSettings, ActivityDataEntry, ExtensionMessage } from '../../types/index.js';
import { VKTokenManager, callVKApi, isExpectedTokenError } from '../utils/vk-api.js';
import { TabsHelper } from '../utils/tabs.js';
import { StorageKey, SPY_SETTINGS_KEYS, PROFILE_SPY_SETTINGS_KEYS } from '../../shared/constants/storage-keys.js';
import { THEME_SHORT_EXPAND, sanitizeSettings } from '../../shared/constants/settings-schema.js';
import type { SpyTracker } from '../services/spy-tracker.js';
import type { ProfileTracker } from '../services/profile-tracker.js';
import type { AlarmManager } from '../services/alarm-manager.js';
import type { NotificationService } from '../services/notification-service.js';
import { StorageHelper } from '../utils/storage.js';
import { sanitizeFilename } from '../../shared/utils/filename.js';

type OkResult   = { success: true };
type ErrorResult = { success: false; error: string; code?: string };

/** Точный результат применения общей темы — позволяет вызывающей стороне
 *  сузить тип по `success` без приведения типов. */
export type ApplyThemeResult = (OkResult & { applied: string[] }) | ErrorResult;

type HandlerResult =
  | OkResult
  | ErrorResult
  | (OkResult & { settings: Record<string, unknown> })
  | (OkResult & { stats: unknown; userStatus: unknown })
  | (OkResult & { data: unknown })
  | (OkResult & { applied: string[] })
  | (OkResult & { onlineLog: unknown[]; activityLog: unknown[] })
  | (OkResult & { profileLog: unknown[] })
  | (OkResult & { stats: unknown; snapshots: unknown })
  | { token: string | null; userId: string | null; expiresAt: number | null; status: string }
  | { hasVKTabs: boolean }
  | { hasVKTab: boolean; nativeApiAvailable?: boolean; hasToken?: boolean }
  | { reloaded: boolean }
  | { count: number }
  | { pong: true; hasVKHostPermission: boolean }
  | (OkResult & { dataB64: string; mime: string })
  | (OkResult & { dataB64: string; status: number })
  | { success: false; error: string; status?: number }
  | (OkResult & { lyrics: string })
  | { nativeApiAvailable: boolean; hasToken: boolean };


export class MessageHandler {
  private readonly spyTracker: SpyTracker;
  private readonly profileTracker: ProfileTracker;
  private readonly alarmManager: AlarmManager;
  private readonly notificationService: NotificationService;

  /**
   * tokenManager принимается снаружи (DI).
   */
  private readonly tokenManager: VKTokenManager;

  constructor(
    spyTracker: SpyTracker,
    profileTracker: ProfileTracker,
    alarmManager: AlarmManager,
    notificationService: NotificationService,
    tokenManager: VKTokenManager,
  ) {
    this.spyTracker = spyTracker;
    this.profileTracker = profileTracker;
    this.alarmManager = alarmManager;
    this.notificationService = notificationService;
    this.tokenManager = tokenManager;
  }

  isExpectedError(error: unknown): boolean {
    return isExpectedTokenError(error);
  }

  async handle(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<HandlerResult> {
    if (message.type !== 'VK_TOKEN_UPDATE') {
      console.log('[VKify] Background received:', message.type);
    }

    switch (message.type) {
      case 'GET_SETTINGS':
        return { success: true, settings: await chrome.storage.local.get(null) };

      case 'VK_TOKEN_UPDATE':
        return this.handleTokenUpdate(message.token, message.userId, message.expiresAt);

      case 'GET_VK_TOKEN':
        return this.handleGetToken();

      case 'CHECK_VK_TABS':
        return { hasVKTabs: await TabsHelper.hasVKTabs() };

      case 'GET_API_METHOD':
        return TabsHelper.getApiMethodInfo();

      case 'OPEN_TAB':
        await TabsHelper.openTab(message.url);
        return { success: true };

      case 'RELOAD_VK_TABS':
        await TabsHelper.reloadAllVKTabs();
        return { success: true };

      case 'RELOAD_ACTIVE_VK_TAB':
        return TabsHelper.reloadActiveVKTab();

      case 'QUERY_VK_TABS':
        return { count: await TabsHelper.countVKTabs(message.urlPattern) };

      case 'PING': {
        let hasVKHostPermission = true;
        try {
          // Схема ДОЛЖНА совпадать с манифестом (`https://`, не `*://`) — иначе
          // contains вернёт false при реально выданном доступе (тот же набор
          // проверяет popup в useHostPermission → HOST_CHECK).
          hasVKHostPermission = await chrome.permissions.contains({
            origins: ['https://*.vk.com/*', 'https://api.vk.com/*'],
          });
        } catch {
          // permissions API недоступен — на Chromium доступ выдаётся при установке
        }
        return { pong: true, hasVKHostPermission };
      }

      case 'VK_API_CALL':
        return this.handleApiCall(message.method, message.params);

      case 'STORAGE_CHANGED':
        await TabsHelper.notifyAllVKTabs(message);
        return { success: true };

      case 'ENABLE_FEATURE':
      case 'DISABLE_FEATURE':
        await TabsHelper.sendToActiveVKTab(message);
        return { success: true };

      case 'RELOAD_FEATURES':
        await TabsHelper.notifyAllVKTabs(message);
        return { success: true };

      case 'GET_ONLINE_STATS':
        return { success: true, ...this.spyTracker.getStats() };

      case 'START_ONLINE_SPY':
        return this.handleStartSpy();

      case 'STOP_ONLINE_SPY':
        await this.spyTracker.stop();
        return { success: true };

      case 'GET_USER_ACTIVITY':
        return this.handleGetUserActivity(message.userId);

      case 'GET_SPY_LOG':
        return this.handleGetSpyLog();

      case 'CLEAR_SPY_LOG': {
        // Удаляем логи и все динамические ключи activity_{userId},
        // которые иначе накапливались бы бесконечно.
        const allData = await chrome.storage.local.get(null);
        const activityKeys = Object.keys(allData).filter(k => k.startsWith('activity_'));
        await chrome.storage.local.remove([
          StorageKey.ONLINE_SPY_LOG,
          StorageKey.ACTIVITY_SPY_LOG,
          ...activityKeys,
        ]);
        return { success: true };
      }

      case 'START_PROFILE_SPY':
        return this.handleStartProfileSpy();

      case 'STOP_PROFILE_SPY':
        await this.profileTracker.stop();
        return { success: true };

      case 'GET_PROFILE_SPY_STATS':
        return { success: true, ...this.profileTracker.getStats() };

      case 'GET_PROFILE_SPY_LOG':
        return { success: true, profileLog: await StorageHelper.getProfileSpyLog() };

      case 'CLEAR_PROFILE_SPY_LOG':
        await StorageHelper.clearProfileSpyLog();
        return { success: true };

      case 'SHOW_NOTIFICATION':
        await this.notificationService.show(
          message.notifId ?? `vkify-spy-${Date.now()}`,
          message.title,
          message.message,
          1,
        );
        return { success: true };

      case 'APPLY_SHARED_THEME':
        return this.handleApplySharedTheme(message.encoded);

      case 'DOWNLOAD_VIDEO':
        return this.handleDownloadVideo(message.url, message.filename);

      case 'AUDIO_FETCH_COVER':
        return this.handleFetchCover(message.url);

      case 'AUDIO_FETCH_LYRICS':
        return this.handleFetchLyrics(message.artist, message.title);

      case 'AUDIO_FETCH_SEGMENT':
        return this.handleFetchSegment(
          message.url, message.rangeStart, message.rangeEnd,
          message.decryptKeyUrl, message.decryptIvHex,
        );

      default:
        console.log('[VKify] Unknown message type:', (message as ExtensionMessage).type);
        return { success: false, error: 'Unknown message type' };
    }
  }


  private async handleTokenUpdate(
    token: string | undefined,
    userId: string | undefined,
    expiresAt: number | undefined,
  ): Promise<HandlerResult> {
    await this.tokenManager.update(token, userId, expiresAt);
    await TabsHelper.notifyPopup({ type: 'VK_TOKEN_UPDATE', token, userId, expiresAt });
    return { success: true };
  }

  private async handleGetToken(): Promise<HandlerResult> {
    const vkData = await this.tokenManager.get();

    if (!vkData.token) {
      const result = await this.tokenManager.requestFresh();
      if (result.token) {
        return this.tokenManager.get();
      }
      return { ...vkData, status: result.reason ?? 'no_token' };
    }

    return vkData;
  }

  private async handleApiCall(
    method: string,
    params: Record<string, unknown>,
  ): Promise<HandlerResult> {
    try {
      const data = await callVKApi(this.tokenManager, method, params);
      return { success: true, data };
    } catch (error) {
      const err = error as Error & { code?: string };
      return { success: false, error: err.message, code: err.code };
    }
  }

  private async handleStartSpy(): Promise<HandlerResult> {
    const settings = await chrome.storage.local.get([...SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;
    await this.spyTracker.loadState();
    await this.spyTracker.start(settings);
    return { success: true };
  }

  private async handleStartProfileSpy(): Promise<HandlerResult> {
    const settings = await chrome.storage.local.get([...PROFILE_SPY_SETTINGS_KEYS]) as Partial<ExtensionSettings>;
    await this.profileTracker.loadState();
    await this.profileTracker.start(settings);
    return { success: true };
  }

  private async handleGetUserActivity(userId: string): Promise<HandlerResult> {
    const result = await chrome.storage.local.get([`activity_${userId}`]);
    return {
      success: true,
      data: (result[`activity_${userId}`] as ActivityDataEntry[]) ?? [],
    };
  }

  private async handleGetSpyLog(): Promise<HandlerResult> {
    const result = await chrome.storage.local.get([
      StorageKey.ONLINE_SPY_LOG,
      StorageKey.ACTIVITY_SPY_LOG,
    ]);
    return {
      success: true,
      onlineLog: result[StorageKey.ONLINE_SPY_LOG] ?? [],
      activityLog: result[StorageKey.ACTIVITY_SPY_LOG] ?? [],
    };
  }


  async handleApplySharedTheme(encoded: string): Promise<ApplyThemeResult> {
    if (!encoded || typeof encoded !== 'string') {
      return { success: false, error: 'No encoded payload' };
    }

    let themeSettings: Record<string, unknown>;
    try {
      const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const padding = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
      // TextDecoder корректно обрабатывает multi-byte символы (в отличие от устаревшего escape()).
      const bytes = Uint8Array.from(atob(b64 + padding), c => c.charCodeAt(0));
      const json = new TextDecoder().decode(bytes);
      const payload = JSON.parse(json) as { v?: number; p?: Record<string, unknown> };

      if (!payload || typeof payload.p !== 'object') {
        return { success: false, error: 'Invalid payload structure' };
      }

      // v:2 — короткие алиасы ключей; расширяем в полные имена перед валидацией
      const rawParams = payload.p as Record<string, unknown>;
      if ((payload.v ?? 1) >= 2) {
        themeSettings = {};
        for (const [key, value] of Object.entries(rawParams)) {
          const fullKey = THEME_SHORT_EXPAND[key] ?? key;
          themeSettings[fullKey] = value;
        }
      } else {
        themeSettings = rawParams;
      }
    } catch (err) {
      console.warn('[VKify] Failed to decode shared theme:', (err as Error).message);
      return { success: false, error: 'Decode failed: ' + (err as Error).message };
    }

    // Канонический санитайзер: разрешённые в scope 'theme' ключи И корректные
    // типы значений. Та же функция используется для импорта файла и site-bridge.
    const sanitized = sanitizeSettings(themeSettings, 'theme');

    if (Object.keys(sanitized).length === 0) {
      return { success: false, error: 'No valid appearance settings in payload' };
    }

    await chrome.storage.local.set(sanitized);
    await TabsHelper.notifyAllVKTabs({ type: 'RELOAD_FEATURES' });

    console.log('[VKify] Shared theme applied:', Object.keys(sanitized));
    return { success: true, applied: Object.keys(sanitized) };
  }

  /**
   * Граница доверия: сообщение может прислать любой content-script контекст,
   * а URL приходит из ответов VK API (страница может на них влиять). Качаем
   * только https и принудительно чистим имя файла — content-сторона тоже
   * санитизирует, но полагаться на это background не должен.
   */
  private async handleDownloadVideo(url: string, filename: string): Promise<HandlerResult> {
    try {
      if (!/^https:\/\//i.test(url)) {
        return { success: false, error: 'Недопустимый URL загрузки' };
      }
      await chrome.downloads.download({
        url,
        filename: sanitizeFilename(filename),
        conflictAction: 'uniquify',
      });
      return { success: true };
    } catch (error) {
      console.error('[VKify] Download failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Тянет обложку трека (VK CDN) и возвращает её base64 — content-скрипт
   * встроит её в ID3-тег APIC. Делаем в background: в MV3 cross-origin fetch
   * из content-скрипта подпадает под CORS, а из service worker (с
   * host_permissions) — нет.
   */
  private async handleFetchCover(url: string): Promise<HandlerResult> {
    try {
      if (!/^https:\/\/([\w-]+\.)*(userapi\.com|vk\.com|vk\.ru|mycdn\.me)\//i.test(url)) {
        return { success: false, error: 'Недопустимый источник обложки' };
      }
      const resp = await fetch(url);
      if (!resp.ok) return { success: false, error: `HTTP ${resp.status}` };

      const bytes = new Uint8Array(await resp.arrayBuffer());
      const mime  = resp.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
      return { success: true, dataB64: bytesToBase64(bytes), mime };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Тянет HLS-ресурс аудио (m3u8/сегмент/ключ) и возвращает base64. Нужно для
   * Firefox: там штатный XHR-загрузчик hls.js работает в content-скрипте и
   * режется page CSP/CORS, а background с host_permissions свободен.
   *
   * Byte-range: VK раздаёт трек как ОДИН файл seg-00-a2.ts, а фрагменты плейлиста
   * — это диапазоны байт в нём.
   *
   * ВАЖНО про byte-range: hls.js инициализирует `rangeStart/rangeEnd` нулями и
   * переопределяет их только для фрагментов с `#EXT-X-BYTERANGE` (см.
   * fragment-loader.ts). У VK byte-range нет — приходит `0/0`, что значит «тяни
   * файл целиком» (штатный XHR-загрузчик при `rangeEnd=0` Range-заголовок не
   * ставит). Поэтому режем ТОЛЬКО при реальном диапазоне `rangeEnd > rangeStart`,
   * иначе отдаём весь файл. Всё через кэш по URL: один и тот же seg-файл VK
   * запрашивает на каждый фрагмент плейлиста (десятки раз) — фетчим его однажды.
   */
  private async handleFetchSegment(
    url: string,
    rangeStart?: number,
    rangeEnd?: number,
    decryptKeyUrl?: string,
    decryptIvHex?: string,
  ): Promise<HandlerResult> {
    try {
      if (!isVkAudioUrl(url)) {
        console.warn('[VKify audio] segment fetch rejected (host):', url);
        return { success: false, error: 'Недопустимый источник аудио' };
      }

      const full = await fetchFullSegment(url);

      // Зашифрованный сегмент (AES-128-CBC) — расшифровываем здесь, в background:
      // WebCrypto в service worker работает в чистом realm (в content-скрипте
      // Firefox subtle.decrypt падает «Permission denied» на кросс-realm буфере).
      if (decryptKeyUrl) {
        if (!isVkAudioUrl(decryptKeyUrl)) return { success: false, error: 'Недопустимый источник ключа' };
        const keyBytes = await fetchFullSegment(decryptKeyUrl);
        const plain = await aesCbcDecrypt(full, keyBytes, hexToBytes(decryptIvHex ?? ''));
        return { success: true, status: 200, dataB64: bytesToBase64(plain) };
      }

      // Реальный byte-range (rangeEnd > rangeStart) — отдаём срез; иначе весь файл.
      const hasRange = typeof rangeStart === 'number' && typeof rangeEnd === 'number' && rangeEnd > rangeStart;
      const bytes = hasRange ? full.subarray(rangeStart, Math.min(rangeEnd, full.length)) : full;

      return { success: true, status: hasRange ? 206 : 200, dataB64: bytesToBase64(bytes) };
    } catch (error) {
      console.warn('[VKify audio] segment fetch failed', url, error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Ищет трек на Genius и возвращает текст песни. Сначала публичный
   * search-эндпоинт (JSON), затем парсинг lyrics-контейнеров со страницы.
   * Любая ошибка → пустой текст (фича опциональна, скачивание не ломается).
   */
  private async handleFetchLyrics(artist: string, title: string): Promise<HandlerResult> {
    try {
      const q = encodeURIComponent(`${artist} ${title}`.trim());
      const searchResp = await fetch(`https://genius.com/api/search/multi?q=${q}`, {
        headers: { Accept: 'application/json' },
      });
      if (!searchResp.ok) return { success: true, lyrics: '' };

      const json = await searchResp.json() as {
        response?: { sections?: Array<{ hits?: Array<{ type?: string; result?: { url?: string } }> }> };
      };
      const sections = json.response?.sections ?? [];
      let songUrl = '';
      for (const sec of sections) {
        const hit = (sec.hits ?? []).find(h => h.type === 'song' && h.result?.url);
        if (hit?.result?.url) { songUrl = hit.result.url; break; }
      }
      // URL приходит из ответа стороннего API — ходим только на genius.com,
      // иначе SSRF-подобный fetch произвольного адреса с правами background.
      if (!songUrl || !isGeniusUrl(songUrl)) return { success: true, lyrics: '' };

      const pageResp = await fetch(songUrl);
      if (!pageResp.ok) return { success: true, lyrics: '' };

      return { success: true, lyrics: extractGeniusLyrics(await pageResp.text()) };
    } catch {
      return { success: true, lyrics: '' };
    }
  }
}

function isGeniusUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'genius.com' || u.hostname.endsWith('.genius.com'));
  } catch {
    return false;
  }
}

/** Хосты аудио-CDN VK, куда разрешён фоновый fetch HLS (анти-SSRF). */
function isVkAudioUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname;
    return h === 'vkuseraudio.net' || h.endsWith('.vkuseraudio.net')
      || h === 'userapi.com' || h.endsWith('.userapi.com')
      || h === 'mycdn.me' || h.endsWith('.mycdn.me')
      // URI AES-ключа HLS у VK может отдаваться с самого vk.com/vk.ru.
      || h === 'vk.com' || h.endsWith('.vk.com')
      || h === 'vk.ru' || h.endsWith('.vk.ru');
  } catch {
    return false;
  }
}

/**
 * Кэш целых файлов аудио-CDN. VK запрашивает один и тот же seg-файл на каждый
 * фрагмент плейлиста (десятки раз) — фетчим его однажды и отдаём из кэша (целиком
 * либо срезом для byte-range). Кэшируем Promise (дедуп параллельных запросов),
 * храним до нескольких файлов (параллельные загрузки альбома), вытесняем старый.
 */
const fullSegmentCache = new Map<string, Promise<Uint8Array>>();
const FULL_SEGMENT_CACHE_MAX = 4;

function fetchFullSegment(url: string): Promise<Uint8Array> {
  let p = fullSegmentCache.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'include' }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    p.catch(() => fullSegmentCache.delete(url)); // ошибку не кэшируем
    fullSegmentCache.set(url, p);
    while (fullSegmentCache.size > FULL_SEGMENT_CACHE_MAX) {
      const oldest = fullSegmentCache.keys().next().value;
      if (oldest === undefined) break;
      fullSegmentCache.delete(oldest);
    }
  }
  return p;
}

/** hex-строка → байты (для IV/ключа AES). Нечётную/пустую трактуем как нули. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const byte = clean.substr(i * 2, 2);
    out[i] = byte ? parseInt(byte, 16) : 0;
  }
  return out;
}

/** Копия в свежий ArrayBuffer (WebCrypto-типы требуют именно ArrayBuffer). */
function toArrayBuffer(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.byteLength);
  new Uint8Array(ab).set(u);
  return ab;
}

/** AES-128-CBC расшифровка через WebCrypto (PKCS7-паддинг снимается автоматически). */
async function aesCbcDecrypt(cipher: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', toArrayBuffer(key), { name: 'AES-CBC' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(cipher));
  return new Uint8Array(plain);
}

/** Uint8Array → base64 порциями (обходит лимит аргументов String.fromCharCode). */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Достаёт текст из HTML страницы Genius без DOM (service worker без DOMParser).
 * Контейнеры `data-lyrics-container="true"` содержат вложенные <div>, поэтому
 * границы ищем балансировкой тегов, затем чистим разметку и HTML-сущности.
 */
function extractGeniusLyrics(html: string): string {
  const blocks = extractBalancedDivs(html, 'data-lyrics-container="true"');
  if (blocks.length === 0) return '';

  let text = blocks.join('\n');
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

/** Возвращает внутреннее содержимое каждого <div>, чей открывающий тег
 *  содержит `marker`, корректно учитывая вложенные <div>. */
function extractBalancedDivs(html: string, marker: string): string[] {
  const out: string[] = [];
  let cursor = 0;

  for (;;) {
    const at = html.indexOf(marker, cursor);
    if (at === -1) break;
    const open = html.indexOf('>', at);
    if (open === -1) break;

    let depth = 1;
    let i = open + 1;
    const start = i;
    while (i < html.length && depth > 0) {
      const nextOpen  = html.indexOf('<div', i);
      const nextClose = html.indexOf('</div>', i);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        i = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) { out.push(html.slice(start, nextClose)); }
        i = nextClose + 6;
      }
    }
    cursor = i;
  }
  return out;
}