import { cssFeature } from '@/content/core/features/index.js';

export const hideMenuFooterFeature = cssFeature({
  id: 'hide_menu_footer',
  name: 'Скрыть ссылки под меню',
  category: 'hiding',
  enabledByDefault: true,
  cssFiles: 'hiding/menu/hide-menu-footer.css',
});
