import type { Migration } from './types.js';

export const migrateV17ToV18: Migration = {
  to: 18,
  description: 'Add VK Video widget visibility while preserving existing widget preferences',
  migrate(old) {
    const value = old.widgetStack;
    const stack = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {};
    return {
      ...old,
      widgetStack: { ...stack, showOnVkVideo: typeof stack.showOnVkVideo === 'boolean' ? stack.showOnVkVideo : true },
    };
  },
};
