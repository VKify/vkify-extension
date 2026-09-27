import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает фильтр бизнес-уведомлений в списке диалогов. */
export const hideBusinessNotificationsFeature: FeatureDefinition = cssFeature({
  id: 'hide_business_notifications',
  name: 'Скрыть бизнес-уведомления',
  category: 'hiding',
  cssFiles: 'hiding/messenger/hide-business-notifications.css',
});
