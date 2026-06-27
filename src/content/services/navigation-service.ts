import type { FeatureManager } from '../core/feature-manager.js';
import type { StorageManager } from '../core/storage.js';
import type { ContextGuard } from '../utils/context-guard.js';
import type { FeatureHandler } from '../../types/index.js';

export class NavigationService {
  private readonly featureManager: FeatureManager;
  private readonly storage: StorageManager;
  private readonly contextGuard: ContextGuard;

  private _observer: MutationObserver | null = null;
  private _onNavigationEvent: (() => void) | null = null;
  private _lastUrl = location.href;

  constructor(
    featureManager: FeatureManager,
    storage: StorageManager,
    contextGuard: ContextGuard,
  ) {
    this.featureManager = featureManager;
    this.storage = storage;
    this.contextGuard = contextGuard;
  }

  start(): void {
    if (this.contextGuard.destroyed) return;

    this._onNavigationEvent = () => this.checkNavigation();
    window.addEventListener('popstate', this._onNavigationEvent);
    window.addEventListener('hashchange', this._onNavigationEvent);

    // VK SPA обновляет <title> при каждом переходе между страницами.
    // Наблюдение за <head> на порядки дешевле, чем document.body + subtree:true,
    // потому что VK не манипулирует head так активно, как body.
    this._observer = new MutationObserver(() => this.checkNavigation());
    this._observer.observe(document.head ?? document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._onNavigationEvent) {
      window.removeEventListener('popstate', this._onNavigationEvent);
      window.removeEventListener('hashchange', this._onNavigationEvent);
      this._onNavigationEvent = null;
    }
  }

  private checkNavigation(): void {
    if (this.contextGuard.destroyed) {
      this.stop();
      return;
    }

    if (!this.contextGuard.isValid()) {
      this.contextGuard.triggerCleanup();
      return;
    }

    if (location.href !== this._lastUrl) {
      this._lastUrl = location.href;
      this.onPageChange();
    }
  }

  private async onPageChange(): Promise<void> {
    if (this.contextGuard.destroyed) return;

    console.log('[VKify] Page:', location.pathname);

    await this.contextGuard.safeExecute(async () => {
      await this.checkCurrentPage();
      await this.reapplyActiveFeatures();
    });
  }

  async checkCurrentPage(): Promise<void> {
    const pathname = window.location.pathname;
    const toCheck: Array<{ id: string; handler: FeatureHandler }> = [];

    this.featureManager.forEachFeature((id, handler) => {
      if (handler.matchPath) toCheck.push({ id, handler });
    });

    for (const { id, handler } of toCheck) {
      if (!handler.matchPath!(pathname)) continue;
      const value = await this.storage.get(id);
      if (this.featureManager.shouldEnable(value)) {
        await this.featureManager.enable(id, value ?? true);
      }
    }
  }

  private async reapplyActiveFeatures(): Promise<void> {
    const ids = this.featureManager.getReapplyFeatureIds();
    const pending: Array<{ id: string; value: unknown }> = [];

    for (const id of ids) {
      if (!this.featureManager.isActive(id)) continue;
      const value = await this.storage.get(id);
      pending.push({ id, value });
    }

    requestAnimationFrame(() => {
      if (this.contextGuard.destroyed) return;
      // reapply (а не прямой handler.enable): штатный путь с perf-таймингом,
      // учётом failed-состояния и эмитом feature:enabled, но без жёсткого
      // disable-перед-enable — apply-цикл фичи идемпотентен (без мерцания).
      for (const { id, value } of pending) {
        void this.featureManager.reapply(id, value ?? true);
      }
    });
  }
}