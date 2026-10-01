import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { createBypassAwayLinksFeature } from './bypass-away-links.js';
import { createKeyboardLayoutFeature } from './keyboard-layout.js';

export function registerAutomationFeatures(manager: FeatureManager): void {
  // Stateful-ядра не переписываются — оборачиваются handlerFeature с метадатой.
  const bypass = createBypassAwayLinksFeature(manager);
  const keyboard = createKeyboardLayoutFeature(manager);

  manager.registerDefinitions([
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
