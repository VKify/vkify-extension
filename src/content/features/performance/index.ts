import type { FeatureManager } from '../../core/feature-manager.js';
import { createPerfWidgetFeature } from './perf-widget.js';

/** Фичи раздела «Производительность» (пока — плавающий мини-виджет). */
export function registerPerformanceFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createPerfWidgetFeature(manager));

  manager.describeFeatures({
    perf_widget: {
      name: 'Мини-виджет производительности',
      category: 'performance',
      impact: 'heavy',
      requiresDomLayer: true,
      initOrder: 90,
      tags: ['widget', 'floating', 'telemetry'],
    },
  });
}
