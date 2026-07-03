import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { createCustomCSSFeatures } from './custom-css.js';

export function registerCustomCssFeatures(manager: FeatureManager): void {
  // Stateful-ядро (замыкание с injectCSS) не переписывается — оборачивается
  // handlerFeature с метадатой на месте.
  const map = createCustomCSSFeatures(manager);

  manager.registerDefinitions([
    handlerFeature({
      id: 'custom_css_enabled',
      // light: inject-CSS из пользовательского текста статичен после применения.
      name: 'Пользовательский CSS', category: 'custom-css', impact: 'light',
      initOrder: 110, tags: ['css', 'user'],
      settingsKeys: ['custom_css_enabled', 'custom_css'],
      handler: map.custom_css_enabled,
    }),
    // Ключ-значение (текст CSS): отдельная definition — реактивность id-ключа
    // обеспечивает FeatureManager (живое применение при наборе в попапе).
    handlerFeature({
      id: 'custom_css',
      name: 'Пользовательский CSS (текст)', category: 'custom-css',
      handler: map.custom_css,
    }),
  ]);
}
