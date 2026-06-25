import type { FeatureManager } from '../../core/feature-manager.js';
import { createPerfWidgetFeature } from './perf-widget.js';

/** Фичи раздела «Производительность» (пока — плавающий мини-виджет). */
export function registerPerformanceFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createPerfWidgetFeature(manager));

  manager.describeFeatures({
    perf_widget: {
      name: 'Мини-виджет производительности',
      category: 'performance',
      // light: rAF + 1s-интервал, но паузятся на скрытой вкладке — стоимость
      // мизерна; нелогично, чтобы сам монитор попадал в «Reset heavy».
      impact: 'light',
      requiresDomLayer: true,
      initOrder: 90,
      tags: ['widget', 'floating', 'telemetry'],
    },
  });
}
