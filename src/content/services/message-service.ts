import type { FeatureManager } from '../core/feature-manager.js';
import type { VKApiService } from '../core/api/index.js';
import type { TokenService } from './token-service.js';
import type { ContextGuard } from '../utils/context-guard.js';
import type { ExtensionMessage } from '../../types/index.js';
import { InjectedScript } from '../core/injected-scripts.js';
import { perfCollector } from '../core/perf/collector.js';
import { domObserver } from '../core/dom/index.js';
import { readHeap } from '../../shared/utils/perf-memory.js';
import type { PerfContext, PageLoadTiming, FeatureRegistrySummary } from '../../shared/constants/perf.js';

type MessageListener = (
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | undefined;

const SPY_SETTING_RENAMES: Record<string, string> = {
  browser_notify: 'browserNotify',
  save_log:       'saveLog',
  tracked_users:  'trackedUsers',
};

function toSpySettingName(featureSuffix: string): string {
  return SPY_SETTING_RENAMES[featureSuffix] ?? featureSuffix;
}

/** Разбивка времени загрузки страницы по фазам Navigation Timing L2. Возвращает
 *  null, если API недоступен или навигация ещё не размечена. */
function readPageLoadTiming(): PageLoadTiming | null {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (!nav) return null;

    const clamp = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);

    return {
      dns: clamp(nav.domainLookupEnd - nav.domainLookupStart),
      connect: clamp(nav.connectEnd - nav.connectStart),
      response: clamp(nav.responseEnd - nav.requestStart),
      domInteractive: clamp(nav.domInteractive - nav.responseEnd),
      domComplete: clamp(nav.domComplete - nav.domInteractive),
      load: clamp(nav.loadEventEnd - nav.domComplete),
      total: clamp(nav.loadEventEnd || nav.duration),
    };
  } catch {
    return null;
  }
}

export class MessageService {
  private readonly featureManager: FeatureManager;
  private readonly vkApi: VKApiService;
  private readonly tokenService: TokenService;
  private readonly contextGuard: ContextGuard;
  private readonly getCurrentUserId: () => string | null;
  private _listener: MessageListener | null = null;

  constructor(
    featureManager: FeatureManager,
    vkApi: VKApiService,
    tokenService: TokenService,
    contextGuard: ContextGuard,
    getCurrentUserId: () => string | null,
  ) {
    this.featureManager = featureManager;
    this.vkApi = vkApi;
    this.tokenService = tokenService;
    this.contextGuard = contextGuard;
    this.getCurrentUserId = getCurrentUserId;
  }

  start(): void {
    this._listener = (message, _sender, sendResponse) => {
      const result = this.handleMessage(message);

      if (result instanceof Promise) {
        result.then(sendResponse).catch(() => {});
        return true;
      }

      if (result !== false) sendResponse(result);
      return result !== false;
    };

    chrome.runtime.onMessage.addListener(this._listener);
  }

  stop(): void {
    if (this._listener) {
      try {
        chrome.runtime.onMessage.removeListener(this._listener);
      } catch {
        // Игнорируем ошибку при выгрузке расширения
      }
      this._listener = null;
    }
  }

  private handleMessage(message: ExtensionMessage): unknown {
    if (this.contextGuard.destroyed) return false;

    if (!this.contextGuard.isValid()) {
      this.contextGuard.triggerCleanup();
      return false;
    }

    switch (message.type) {
      case 'ENABLE_FEATURE':
        this.handleEnableFeature(message.featureId, message.value);
        return true;

      case 'DISABLE_FEATURE':
        this.handleDisableFeature(message.featureId);
        return true;

      case 'RELOAD_FEATURES':
        void this.featureManager.init();
        return true;

      case 'GET_VK_TOKEN':
        return Promise.resolve({
          token: this.vkApi.getToken(),
          userId: this.getCurrentUserId(),
        });

      case 'VK_API_CALL':
        return this.handleApiCall(message.method, message.params);

      case 'REQUEST_FRESH_TOKEN':
        return this.tokenService.requestFreshToken();

      case 'GET_API_METHOD_INFO':
        return Promise.resolve({
          nativeApiAvailable: this.vkApi.nativeApiAvailable,
          hasToken: this.vkApi.hasToken(),
        });

      // Убирает параметр из URL без перезагрузки страницы (после применения shared-темы)
      case 'CLEAN_URL':
        try {
          history.replaceState(null, '', message.url);
        } catch {
          // replaceState недоступен (напр., about:blank) — игнорируем
        }
        return true;

      // Глобальный медиа-хоткей из chrome.commands. Инжектируем player-control
      // лениво (idempotent — ScriptInjector помнит уже-инжектированные), затем
      // диспатчим тот же event, что и in-page keydown-обработчик.
      case 'PLAYER_ACTION':
        this.featureManager.injectScript(InjectedScript.PLAYER_CONTROL);
        this.featureManager.sendEvent('vkify:player:action', { action: message.action });
        return true;

      // Performance Dashboard: отдаём content-часть снимка (background дособерёт
      // свои метрики). Снимок строится лениво — никаких фоновых таймеров.
      case 'GET_PERF_TELEMETRY':
        return Promise.resolve(this.buildPerfContext());

      // Сводка реестра фич (метадата всех зарегистрированных фич). Запрашивается
      // дашбордом однократно при открытии — поэтому НЕ в GET_PERF_TELEMETRY (тот
      // поллится раз в секунду и должен оставаться лёгким).
      case 'GET_FEATURE_REGISTRY_SUMMARY':
        return Promise.resolve(this.buildRegistrySummary());
    }

    return false;
  }

  /** Собирает текущий снимок метрик content-скрипта (см. shared/constants/perf). */
  private buildPerfContext(): PerfContext {
    const heap = readHeap();
    const registry = this.featureManager.featureRegistry;
    const features = this.featureManager.getActiveFeatureIds().map((id) => {
      // Метадата фичи — из FeatureRegistry (единый источник истины), а не из
      // отдельного хардкод-каталога.
      const meta = registry.getMeta(id);
      return {
        id,
        label: meta?.name ?? id,
        impact: meta?.impact ?? 'light',
        initMs: perfCollector.getFeatureInit(id),
        runtimeMs: perfCollector.getFeatureRuntime(id),
      };
    });

    // Ресурсные счётчики — через узкий TelemetryProvider (вместо 4 геттеров,
    // протекавших деталь реализации CSS/script-менеджеров в этот слой).
    const resources = this.featureManager.telemetry.snapshot();
    const failed = this.featureManager.getFailedFeatures();

    return {
      available: true,
      url: location.href,
      heapUsedBytes: heap.usedBytes,
      heapTotalBytes: heap.totalBytes,
      heapLimitBytes: heap.limitBytes,
      injectedStyles: resources.injectedStyles,
      injectedCssBytes: resources.injectedCssBytes,
      cssMarkers: resources.cssMarkers,
      injectedScripts: resources.injectedScripts,
      observerSubs: domObserver.subCount(),
      mutationFlushes: domObserver.getFlushCount(),
      apiCalls: perfCollector.getApiCalls(),
      apiCallsLastMin: perfCollector.apiCallsLastMin(),
      initTotalMs: perfCollector.getTotalInitMs(),
      pageLoad: readPageLoadTiming(),
      features,
      featuresFailed: failed.length ? failed : undefined,
    };
  }

  /** Срез метадаты всех зарегистрированных фич из FeatureRegistry (для дашборда). */
  private buildRegistrySummary(): FeatureRegistrySummary {
    const features = this.featureManager.featureRegistry.getAll().map((d) => ({
      id:               d.meta.id,
      name:             d.meta.name,
      category:         d.meta.category,
      impact:           d.meta.impact,
      dependencies:     [...d.meta.dependencies],
      initOrder:        d.meta.initOrder,
      requiresDomLayer: d.meta.requiresDomLayer,
      enabledByDefault: d.meta.enabledByDefault,
      tags:             [...d.meta.tags],
    }));
    return { available: true, collectedAt: Date.now(), total: features.length, features };
  }

  private handleEnableFeature(featureId: string, value: unknown): void {
    this.featureManager.enable(featureId, value);
    this.syncInjectedSettings(featureId, value);
  }

  private handleDisableFeature(featureId: string): void {
    this.featureManager.disable(featureId);
    this.syncInjectedSettings(featureId, false);
  }

  private async handleApiCall(
    method: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const result = await this.vkApi.call(method, params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }


  private syncInjectedSettings(featureId: string, value: unknown): void {
    if (this.contextGuard.destroyed) return;

    if (featureId === 'prevent_typing' || featureId === 'prevent_read') {
      this.featureManager.sendEvent('vkify-update-settings', { [featureId]: !!value });
      return;
    }

    if (featureId.startsWith('spy_')) {
      this.syncSpySettings(featureId, value);
    }
  }

  /**
   * Синхронизирует spy-настройки с инжектированным скриптом.
   */
  private syncSpySettings(featureId: string, value: unknown): void {
    // 'spy_browser_notify' → 'browser_notify' → 'browserNotify'
    const suffix = featureId.replace('spy_', '');
    const settingName = toSpySettingName(suffix);

    if (featureId === 'spy_enabled') {
      this.featureManager.sendEvent('vkify-spy-control', {
        action: value ? 'enable' : 'disable',
        settings: { enabled: value },
      });
      return;
    }

    if (featureId === 'spy_browser_notify' && value) {
      // При включении уведомлений сначала запрашиваем разрешение
      this.featureManager.sendEvent('vkify-spy-control', { action: 'requestNotifications' });
    }

    this.featureManager.sendEvent('vkify-spy-control', {
      action: 'updateSettings',
      settings: { [settingName]: value },
    });
  }
}