import { registerVoiceDownloadFeature } from './voice-download.js';
import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerQuickCopyFeature } from './quick-copy/index.js';
import { registerDialogExportFeature } from './dialog-export/index.js';
import { registerPinNoteFeature } from './pin-note/index.js';
import { registerMessageTemplatesFeatures } from './templates/index.js';
import { messageBackgroundFeature, modernMessagesFeature } from './message-appearance.js';
import { messengerBackgroundFeature } from './background.js';
import { swapMessengerPanelsFeature } from './swap-panels.js';

/**
 * Все фичи, связанные с перепиской: быстрое копирование, экспорт диалога,
 * заметки из сообщений, шаблоны и раскладка панелей. Соответствует странице
 * «Мессенджер» в попапе (хаб «Центр»). Единая точка регистрации — как у
 * остальных доменов.
 */
export function registerMessagesFeatures(manager: FeatureManager): void {
  // Метадата каждой фичи — инлайн в её регистраторе (handlerFeature).
  manager.registerDefinitions([messengerBackgroundFeature, messageBackgroundFeature, modernMessagesFeature]);
  registerQuickCopyFeature(manager);
  registerVoiceDownloadFeature(manager);
  registerDialogExportFeature(manager);
  registerPinNoteFeature(manager);
  registerMessageTemplatesFeatures(manager);
  manager.registerDefinition(swapMessengerPanelsFeature); // декларативная (метадата в swap-panels.ts)
}
