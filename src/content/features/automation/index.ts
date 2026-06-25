import type { FeatureManager } from '../../core/feature-manager.js';
import { createAutoAddFriendsFeature } from './auto-add-friends.js';
import { createBypassAwayLinksFeature } from './bypass-away-links.js';
import { createKeyboardLayoutFeature } from './keyboard-layout.js';

export function registerAutomationFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createAutoAddFriendsFeature(manager));
  manager.registerMultiple(createBypassAwayLinksFeature(manager));
  manager.registerMultiple(createKeyboardLayoutFeature(manager));

  manager.describeFeatures({
    auto_add_friends:        { name: 'Автодобавление друзей', category: 'automation', impact: 'medium', requiresDomLayer: true, tags: ['friends'] },
    bypass_away_links:       { name: 'Обход away-ссылок',     category: 'automation', tags: ['links'] },
    keyboard_layout_switch:  { name: 'Переключение раскладки', category: 'automation', impact: 'light', tags: ['hotkeys'] },
  });
}