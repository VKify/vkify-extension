import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { antiTrackingFeatures } from './anti-tracking.js';
import { createHideDialogsHotkeyFeature } from './dialogs/hide-dialogs-hotkey.js';
import { blurOnUnfocusFeature } from './blur-on-unfocus.js';
import { createHideSpecificDialogsFeature } from './dialogs/hide-specific-dialogs.js';
import { createMessageCryptoFeature } from './crypto/message-crypto.js';

export function registerPrivacyFeatures(manager: FeatureManager): void {
  // Bespoke плагинные фичи (метадата в их файлах):
  manager.registerDefinitions(antiTrackingFeatures); // scriptPlugin + sendEvent (anti-tracking.ts)
  manager.registerDefinition(blurOnUnfocusFeature);  // cssFeature (blur-on-unfocus.ts)

  // Stateful-ядра не переписываются — оборачиваются handlerFeature с метадатой.
  const hotkey = createHideDialogsHotkeyFeature(manager);
  const hiddenDialogs = createHideSpecificDialogsFeature(manager);
  const crypto = createMessageCryptoFeature(manager);

  manager.registerDefinitions([
    handlerFeature({
      id: 'hide_dialogs_hotkey',
      name: 'Скрытие диалогов по хоткею', category: 'privacy',
      handler: hotkey.hide_dialogs_hotkey,
    }),
    handlerFeature({
      id: 'hidden_dialogs',
      name: 'Скрытые диалоги', category: 'privacy',
      handler: hiddenDialogs.hidden_dialogs,
    }),
    handlerFeature({
      id: 'message_crypto',
      name: 'Шифрование сообщений',
      category: 'privacy',
      // medium: observeMatches по сообщениям + 2s-поллинг кнопок composer'а
      // (мессенджер, не вся лента) — не heavy.
      impact: 'medium',
      requiresDomLayer: true,
      initOrder: 70,
      tags: ['crypto', 'im', 'observer'],
      handler: crypto.message_crypto,
    }),
  ]);
}