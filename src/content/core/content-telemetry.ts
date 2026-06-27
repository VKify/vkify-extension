/**
 * Провайдер телеметрии ресурсов, которыми владеет FeatureManager.
 *
 * Раньше четыре счётчика (injectedStyles/Bytes/cssMarkers/scripts) торчали из
 * FeatureManager отдельными геттерами, и MessageService дёргал их напрямую —
 * деталь реализации CSS/script-менеджеров стала публичным API оркестратора.
 * Теперь это один узкий контракт: потребитель (обработчик GET_PERF_TELEMETRY)
 * зависит от `TelemetryProvider`, а не от всего FeatureManager.
 */

import type { CssManager } from './css-manager.js';
import type { ScriptInjector } from './script-injector.js';
import type { CssMarkerManager } from './css-marker-manager.js';

/** Снимок счётчиков инжектированных ресурсов content-скрипта. */
export interface ResourceTelemetry {
  /** Число инжектированных <style>. */
  readonly injectedStyles: number;
  /** Суммарный размер инжектированного CSS в байтах. */
  readonly injectedCssBytes: number;
  /** Число активных статических CSS-маркеров `data-vkify-<id>`. */
  readonly cssMarkers: number;
  /** Число инжектированных page-world скриптов. */
  readonly injectedScripts: number;
}

/** Узкий контракт для дашборда производительности. */
export interface TelemetryProvider {
  snapshot(): ResourceTelemetry;
}

export class ContentTelemetry implements TelemetryProvider {
  constructor(
    private readonly css: CssManager,
    private readonly scripts: ScriptInjector,
    private readonly markers: CssMarkerManager,
  ) {}

  snapshot(): ResourceTelemetry {
    return {
      injectedStyles: this.css.count(),
      injectedCssBytes: this.css.totalBytes(),
      cssMarkers: this.markers.count(),
      injectedScripts: this.scripts.count(),
    };
  }
}
