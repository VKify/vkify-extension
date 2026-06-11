import type { FeatureHandler, FeatureMap } from '../../types/index.js';
import type { StorageManager } from './storage.js';
import type { InjectedScriptName } from './injected-scripts.js';
import { CssManager } from './css-manager.js';
import { ScriptInjector } from './script-injector.js';
import { shouldEnable } from './should-enable.js';
import { reconcileCssMarkers, syncCssMarkerMirror } from './css-marker-mirror.js';
import { recordInjectedCss, recordRemovedCss, reconcileInjectedCss } from './injected-css-mirror.js';
import { dispatchPageEvent } from '../utils/page-event.js';

export class FeatureManager {
  private readonly storage: StorageManager;
  private readonly cssManager = new CssManager();
  private readonly scriptInjector = new ScriptInjector();

  private readonly features = new Map<string, FeatureHandler>();
  private readonly activeFeatures = new Set<string>();

  // Static CSS features whose data-vkify-<id> marker is currently set. Mirrored
  // to localStorage so the next page load can apply them synchronously, before
  // first paint (see core/css-marker-mirror.ts).
  private readonly activeCssMarkers = new Set<string>();

  /** Снятие предыдущего storage.onChange — чтобы init() не накапливал слушателей. */
  private _offStorageChange: (() => void) | null = null;

  constructor(storage: StorageManager) {
    this.storage = storage;
  }

  register(id: string, handler: FeatureHandler): void {
    this.features.set(id, handler);
  }

  registerMultiple(features: FeatureMap): void {
    for (const [id, handler] of Object.entries(features)) {
      this.register(id, handler);
    }
  }

  getFeatureHandler(id: string): FeatureHandler | undefined {
    return this.features.get(id);
  }

  hasFeature(id: string): boolean {
    return this.features.has(id);
  }

  /** Итерирует все зарегистрированные фичи — вместо прямого доступа к Map. */
  forEachFeature(cb: (id: string, handler: FeatureHandler) => void): void {
    for (const [id, handler] of this.features) {
      cb(id, handler);
    }
  }

  /** Возвращает ID фич с флагом reapplyOnNavigate для правильного async-перебора. */
  getReapplyFeatureIds(): string[] {
    const ids: string[] = [];
    for (const [id, handler] of this.features) {
      if (handler.reapplyOnNavigate) ids.push(id);
    }
    return ids;
  }

  async init(): Promise<void> {
    // Снимаем предыдущий слушатель: каждый вызов init() (напр. через RELOAD_FEATURES)
    // создаёт новый коллбэк — без очистки они накапливались бы и
    // активировали фичу несколько раз при каждом изменении storage.
    this._offStorageChange?.();
    this._offStorageChange = null;

    const settings = await this.storage.getAll();

    for (const [key, value] of Object.entries(settings)) {
      if (this.features.has(key) && this.shouldEnable(value)) {
        await this.enable(key, value);
      }
    }

    this._offStorageChange = this.storage.onChange((key, value) => {
      if (!this.features.has(key)) return;

      if (this.shouldEnable(value)) {
        this.enable(key, value);
      } else {
        this.disable(key);
      }
    });

    // The markers/CSS stamped synchronously at document_start came from the
    // (possibly stale) mirrors. Now that storage is the source of truth, drop any
    // that aren't actually active and persist the real set for the next load.
    reconcileCssMarkers(this.activeCssMarkers);
    reconcileInjectedCss();

    console.log('[VKify] Features active:', this.activeFeatures.size);
  }

  shouldEnable(value: unknown): boolean {
    return shouldEnable(value);
  }

  async enable(id: string, value: unknown = true): Promise<void> {
    const handler = this.features.get(id);
    if (!handler?.enable) return;

    try {
      if (this.activeFeatures.has(id) && handler.disable) {
        await handler.disable();
      }

      await handler.enable(value);
      this.activeFeatures.add(id);
      console.log(`[VKify] ✓ ${id}`);
    } catch (error) {
      console.error(`[VKify] ✗ ${id}:`, error);
    }
  }

  async disable(id: string): Promise<void> {
    if (!this.activeFeatures.has(id)) return;

    const handler = this.features.get(id);
    if (!handler?.disable) return;

    try {
      await handler.disable();
      this.activeFeatures.delete(id);
      console.log(`[VKify] ○ ${id}`);
    } catch (error) {
      console.error(`[VKify] ✗ disable ${id}:`, error);
    }
  }


  injectCSS(id: string, css: string): void {
    this.cssManager.inject(id, css);
    // Зеркалим в localStorage, чтобы CSS применился мгновенно на следующей
    // загрузке (см. injected-css-mirror.ts).
    recordInjectedCss(id, css);
  }

  removeCSS(id: string): void {
    this.cssManager.remove(id);
    recordRemovedCss(id);
  }


  // Статические CSS-фичи: вместо инжекта <style> из JS правила лежат в
  // colocated .css рядом с фичей (собираются в styles/features.css и грузятся
  // манифестом, как theme.css/content.css). Здесь мы лишь ставим/снимаем маркер
  // data-vkify-<id> на <html>, по которому эти правила и срабатывают — ровно как
  // тема переключает data-vkify-theme-radius и т.п. (см. features/appearance/theme.ts).
  enableCss(id: string): void {
    document.documentElement.setAttribute(`data-vkify-${id}`, 'true');
    this.activeCssMarkers.add(id);
    syncCssMarkerMirror(this.activeCssMarkers);
  }

  disableCss(id: string): void {
    document.documentElement.removeAttribute(`data-vkify-${id}`);
    this.activeCssMarkers.delete(id);
    syncCssMarkerMirror(this.activeCssMarkers);
  }


  injectScript(name: InjectedScriptName, nonce?: string): void {
    this.scriptInjector.inject(name, nonce);
  }


  sendEvent(eventName: string, detail: Record<string, unknown> = {}): void {
    dispatchPageEvent(eventName, detail);
  }


  isActive(id: string): boolean {
    return this.activeFeatures.has(id);
  }


  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this.storage.get<T>(key);
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.storage.set(key, value);
  }

  onStorageChange(callback: (key: string, value: unknown) => void): () => void {
    return this.storage.onChange(callback);
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    return this.storage.getAll();
  }
}