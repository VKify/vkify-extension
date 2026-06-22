import type { FeatureManager } from '@/content/core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';

/**
 * Визуальные фильтры — булевы тумблеры. CSS статичный (filters.css), здесь лишь
 * переключаем маркер data-vkify-<id> на <html>, по которому правила срабатывают.
 */
export function createFilterFeatures(manager: FeatureManager): FeatureMap {
  const toggle = (id: string): FeatureMap[string] => ({
    enable: () => manager.enableCss(id),
    disable: () => manager.disableCss(id),
  });

  return {
    filter_grayscale:      toggle('filter_grayscale'),
    filter_sepia:          toggle('filter_sepia'),
    filter_invert:         toggle('filter_invert'),
    filter_dim_images:     toggle('filter_dim_images'),
    filter_high_contrast:  toggle('filter_high_contrast'),
    filter_low_brightness: toggle('filter_low_brightness'),
  };
}
