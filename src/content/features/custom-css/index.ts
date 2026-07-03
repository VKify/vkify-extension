import type { FeatureManager } from '../../core/feature-manager.js';
import { derivedCssFeature } from '../../core/features/index.js';

/**
 * Пользовательский CSS — одна декларативная derived-фича:
 *   • `custom_css_enabled` — тумблер (id фичи);
 *   • `custom_css`         — текст стилей (watch-ключ: набор в редакторе
 *     попапа применяется живьём через reapply, без жёсткого пересоздания).
 * Инжект/teardown/мягкий reapplyOnUpdate — derivedCssPlugin.
 */
export function registerCustomCssFeatures(manager: FeatureManager): void {
  manager.registerDefinition(derivedCssFeature({
    id: 'custom_css_enabled',
    // light: inject-CSS из пользовательского текста статичен после применения.
    name: 'Пользовательский CSS',
    category: 'custom-css',
    marker: false,
    watch: ['custom_css'],
    reapplyOnUpdate: true,
    initOrder: 110,
    tags: ['css', 'user'],
    compute: (settings) => {
      const css = settings['custom_css'];
      return typeof css === 'string' && css ? { css } : null;
    },
  }));
}
