import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

export const hideMessengerActionsFeature: FeatureDefinition = cssFeature({
  id: 'hide_messenger_actions',
  name: 'Скрыть кнопки в шапке списка чатов',
  category: 'hiding',
  cssFiles: 'hiding/messenger/hide-messenger-actions.css',
});
