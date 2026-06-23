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
import { bytesToBase64 } from '../utils/base64.js';
import { isVkAudioUrl, fetchFullSegment, hexToBytes, aesCbcDecrypt } from '../utils/audio-cdn.js';
import { fetchGeniusLyrics } from '../utils/lyrics.js';
import { readHeap } from '../../shared/utils/perf-memory.js';
import { bgApiTotal, bgApiLastMin } from '../utils/perf-counter.js';
import { emptyPerfContext, type PerfContext, type PerfSnapshot } from '../../shared/constants/perf.js';

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
  | (OkResult & { snapshot: PerfSnapshot })
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

      case 'GET_PERF_TELEMETRY':
        return this.handlePerfTelemetry();

      case 'OPEN_PERF_DASHBOARD':
        return this.handleOpenPerfDashboard();

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

  /**
   * Performance Dashboard: запрашивает content-часть снимка у активной
   * VK-вкладки и дособирает метрики самого service worker'а. Если VK-вкладки
   * нет — context.available=false, popup покажет только background/popup-метрики.
   */
  private async handlePerfTelemetry(): Promise<HandlerResult> {
    const context = await TabsHelper.requestFromActiveVKTab<PerfContext>({
      type: 'GET_PERF_TELEMETRY',
    });

    let alarms = 0;
    try {
      alarms = (await chrome.alarms.getAll()).length;
    } catch {
      // chrome.alarms может быть недоступен — не критично
    }

    const snapshot: PerfSnapshot = {
      collectedAt: Date.now(),
      context: context ?? emptyPerfContext(),
      background: {
        heapUsedBytes: readHeap().usedBytes,
        alarms,
        onlineSpyRunning: this.spyTracker.isRunning,
        profileSpyRunning: this.profileTracker.isRunning,
        apiCalls: bgApiTotal(),
        apiCallsLastMin: bgApiLastMin(),
      },
      popup: {}, // popup допишет свой heap локально после ответа
    };

    return { success: true, snapshot };
  }

  /**
   * Клик по мини-виджету в content → открыть popup на Performance Dashboard.
   * Ставим транзиентный флаг (popup при загрузке откроет нужную подстраницу) и
   * best-effort вызываем openPopup — он есть только в Chrome 127+ и требует
   * жеста; на Firefox/без жеста просто игнорируем (флаг сработает, когда юзер
   * откроет popup сам).
   */
  private async handleOpenPerfDashboard(): Promise<HandlerResult> {
    try {
      await chrome.storage.local.set({ open_perf_dashboard: true });
    } catch {
      // storage недоступен — не критично
    }
    try {
      await chrome.action?.openPopup?.();
    } catch {
      // openPopup не поддержан / нет активного окна — флаг сработает позже
    }
    return { success: true };
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

  /** Текст песни с Genius для ID3-тега (вся логика — в utils/lyrics). */
  private async handleFetchLyrics(artist: string, title: string): Promise<HandlerResult> {
    return { success: true, lyrics: await fetchGeniusLyrics(artist, title) };
  }
}