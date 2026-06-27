import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает эмодзи-статусы у имён пользователей — чистый CSS (hide-emoji-status.css). */
export const hideEmojiStatusFeature: FeatureDefinition = cssFeature({
  id: 'hide_emoji_status',
  name: 'Скрыть эмодзи-статус',
  category: 'hiding',
  cssFiles: 'hiding/profile/hide-emoji-status.css',
});
