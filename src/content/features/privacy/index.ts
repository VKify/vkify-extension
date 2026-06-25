import type { FeatureManager } from '../../core/feature-manager.js';
import { createAntiTrackingFeatures } from './anti-tracking.js';
import { createHideDialogsHotkeyFeature } from './dialogs/hide-dialogs-hotkey.js';
import { createBlurOnUnfocusFeature } from './blur-on-unfocus.js';
import { createHideSpecificDialogsFeature } from './dialogs/hide-specific-dialogs.js';
import { createMessageCryptoFeature } from './crypto/message-crypto.js';

export function registerPrivacyFeatures(manager: FeatureManager): void {
  manager.registerMultiple(createAntiTrackingFeatures(manager));
  manager.registerMultiple(createHideDialogsHotkeyFeature(manager));
  manager.registerMultiple(createBlurOnUnfocusFeature(manager));
  manager.registerMultiple(createHideSpecificDialogsFeature(manager));
  manager.registerMultiple(createMessageCryptoFeature(manager));

  manager.describeFeatures({
    message_crypto: {
      name: 'Шифрование сообщений',
      category: 'privacy',
      // medium: observeMatches по сообщениям + 2s-поллинг кнопок composer'а
      // (мессенджер, не вся лента) — не heavy.
      impact: 'medium',
      requiresDomLayer: true,
      initOrder: 70,
      tags: ['crypto', 'im', 'observer'],
    },
    blur_on_unfocus: { name: 'Размытие при потере фокуса', category: 'privacy' },
    hide_dialogs_hotkey: { name: 'Скрытие диалогов по хоткею', category: 'privacy' },
    prevent_typing: { name: 'Не показывать набор текста', category: 'privacy', tags: ['anti-tracking'] },
    prevent_read:   { name: 'Не отправлять прочтения',     category: 'privacy', tags: ['anti-tracking'] },
  });
}