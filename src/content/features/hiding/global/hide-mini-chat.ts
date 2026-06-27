import { cssFeature, type FeatureDefinition } from '@/content/core/features/index.js';

/** Скрывает всплывающий мини-чат в углу — чистый CSS (hide-mini-chat.css). */
export const hideMiniChatFeature: FeatureDefinition = cssFeature({
  id: 'hide_mini_chat',
  name: 'Скрыть мини-чат',
  category: 'hiding',
  cssFiles: 'hiding/global/hide-mini-chat.css',
});
