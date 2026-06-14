import type { FeatureManager } from '../../../core/feature-manager.js';
import type { FeatureMap } from '../../../../types/index.js';

/**
 * Компактный режим — убирает отступы и скругления между блоками VK, добавляет
 * тонкие разделители. CSS статичный (compact-spacing.css), здесь лишь маркер
 * data-vkify-compact_spacing на <html>.
 */
export function createCompactSpacingFeature(manager: FeatureManager): FeatureMap {
  return {
    compact_spacing: {
      enable: () => manager.enableCss('compact_spacing'),
      disable: () => manager.disableCss('compact_spacing'),
    },
  };
}
