import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { createAutoAddFriendsFeature } from './auto-add-friends.js';
import { createBypassAwayLinksFeature } from './bypass-away-links.js';
import { createKeyboardLayoutFeature } from './keyboard-layout.js';

export function registerAutomationFeatures(manager: FeatureManager): void {
  // Stateful-ядра не переписываются — оборачиваются handlerFeature с метадатой.
  const autoAdd = createAutoAddFriendsFeature(manager);
  const bypass = createBypassAwayLinksFeature(manager);
  const keyboard = createKeyboardLayoutFeature(manager);

  manager.registerDefinitions([
    handlerFeature({
      id: 'auto_add_friends',
      name: 'Автодобавление друзей', category: 'automation', impact: 'medium',
      requiresDomLayer: true, tags: ['friends'],
      handler: autoAdd.auto_add_friends,
    }),
    // Ключи-параметры (лимит/задержки): no-op обработчики — значения читает
    // сама фича, отдельного поведения у ключей нет.
    handlerFeature({ id: 'auto_add_limit', category: 'automation', handler: autoAdd.auto_add_limit }),
    handlerFeature({ id: 'auto_add_delay_min', category: 'automation', handler: autoAdd.auto_add_delay_min }),
    handlerFeature({ id: 'auto_add_delay_max', category: 'automation', handler: autoAdd.auto_add_delay_max }),

    handlerFeature({
      id: 'bypass_away_links',
      name: 'Обход away-ссылок', category: 'automation', tags: ['links'],
      handler: bypass.bypass_away_links,
    }),
    handlerFeature({
      id: 'keyboard_layout_switch',
      name: 'Переключение раскладки', category: 'automation', impact: 'light', tags: ['hotkeys'],
      handler: keyboard.keyboard_layout_switch,
    }),
  ]);
}
