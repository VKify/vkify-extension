import type { Migration } from './types.js';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const boolean = (value: unknown): boolean => typeof value === 'boolean' ? value : false;
const number = (value: unknown, fallback: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : fallback;

export const migrateV20ToV21: Migration = {
  to: 21,
  description: 'Add widget glass appearance, compact headers and edge auto-hide settings while preserving existing preferences',
  migrate(old) {
    const stack = record(old.widgetStack);
    // Freeze this version's defaults; runtime parsers and the catalog may evolve.
    const next = { ...old, widgetStack: {
      ...stack,
      glass: boolean(stack.glass),
      glassBlur: number(stack.glassBlur, 24, 60),
      glassOpacity: number(stack.glassOpacity, .58, 1),
    } };
    for (const [key, value] of Object.entries(old)) {
      if (!key.startsWith('widget:')) continue;
      const widget = record(value);
      Object.assign(next, { [key]: { ...widget, hideHeader: boolean(widget.hideHeader), autoHide: boolean(widget.autoHide) } });
    }
    return next;
  },
};
