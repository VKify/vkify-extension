import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает пункт «Настройки» в левом меню — чистый CSS (hide-menu-settings.css). */
export const hideMenuSettingsFeature: FeatureDefinition = cssFeature({
  id: 'hide_menu_settings',
  name: 'Скрыть «Настройки» в меню',
  category: 'hiding',
  cssFiles: 'hiding/menu/hide-menu-settings.css',
});
