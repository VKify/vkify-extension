import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerQuickCopyFeature } from './quick-copy/index.js';
import { registerDialogExportFeature } from './dialog-export/index.js';
import { registerPinNoteFeature } from './pin-note/index.js';
import { registerMessageTemplatesFeatures } from './templates/index.js';
import { registerSwapMessengerPanelsFeature } from './swap-panels.js';

/**
 * Все фичи, связанные с перепиской: быстрое копирование, экспорт диалога,
 * заметки из сообщений, шаблоны и раскладка панелей. Соответствует странице
 * «Мессенджер» в попапе (хаб «Центр»). Единая точка регистрации — как у
 * остальных доменов.
 */
export function registerMessagesFeatures(manager: FeatureManager): void {
  registerQuickCopyFeature(manager);
  registerDialogExportFeature(manager);
  registerPinNoteFeature(manager);
  registerMessageTemplatesFeatures(manager);
  registerSwapMessengerPanelsFeature(manager);

  manager.describeFeatures({
    message_quick_copy:        { name: 'Быстрое копирование сообщений', category: 'messages', requiresDomLayer: true, tags: ['im', 'observer'] },
    dialog_export_enabled:     { name: 'Экспорт диалога',              category: 'messages', impact: 'medium', tags: ['im', 'export'] },
    message_pin_notes:         { name: 'Заметки из сообщений',          category: 'messages', requiresDomLayer: true, tags: ['im', 'observer'] },
    message_templates_enabled: { name: 'Шаблоны сообщений',            category: 'messages', impact: 'medium', tags: ['im', 'templates'] },
    messenger_swap_panels:     { name: 'Зеркальные панели мессенджера', category: 'messages' },
  });
}
