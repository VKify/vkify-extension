import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerQuickCopyFeature } from './quick-copy.js';
import { registerDialogExportFeature } from './dialog-export.js';
import { registerPinNoteFeature } from './pin-note.js';
import { registerMessageTemplatesFeatures } from './templates.js';

/**
 * Все фичи, связанные с сообщениями: быстрое копирование, экспорт диалога,
 * заметки из сообщений и шаблоны. Соответствует странице «Сообщения» в попапе
 * (хаб «Центр»). Единая точка регистрации — как у остальных доменов.
 */
export function registerMessagesFeatures(manager: FeatureManager): void {
  registerQuickCopyFeature(manager);
  registerDialogExportFeature(manager);
  registerPinNoteFeature(manager);
  registerMessageTemplatesFeatures(manager);
}
