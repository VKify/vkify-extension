import type { FeatureManager } from '../../../core/feature-manager.js';
import { registerQuickCopyFeature } from './quick-copy.js';
import { registerDialogExportFeature } from './dialog-export/index.js';
import { registerPinNoteFeature } from './pin-note.js';
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
}
