import { expect, it } from 'vitest';
import { MESSAGE_APPEARANCE_DEFAULTS, messageAppearanceSurfaces, messageTextColor, parseMessageAppearance } from './message-appearance.js';
import { sanitizeSettings } from './constants/settings-schema.js';
import { migrateV38ToV39 } from './storage/migrations/migrate_v38_to_v39.js';
import { migrateV39ToV40 } from './storage/migrations/migrate_v39_to_v40.js';

it('validates message colors before they reach CSS and clamps corrupt numeric settings', () => {
  const parsed = parseMessageAppearance({ incoming: 'red;display:none', outgoing: 'url(x)', radius: 500, opacity: -5 });
  expect(parsed).toEqual({ ...MESSAGE_APPEARANCE_DEFAULTS, radius: 28, opacity: 20 });
  expect(sanitizeSettings({ messenger_message_settings: JSON.stringify({ ...MESSAGE_APPEARANCE_DEFAULTS, incoming: 'url(x)' }) }, 'import')).toEqual({});
});
it('prefers live theme variables while preserving previously selected custom colors', () => {
  const defaults = parseMessageAppearance(undefined);
  expect(defaults.source).toBe('theme');
  expect(messageAppearanceSurfaces(defaults).incoming).toContain('--vkui--color_background_secondary');
  const oldCustom = { incoming: '#123456', outgoing: '#654321', opacity: 90, radius: 12 };
  const migrated = JSON.parse(migrateV39ToV40.migrate({ messenger_message_settings: JSON.stringify(oldCustom) }).messenger_message_settings as string);
  expect(migrated).toEqual({ ...oldCustom, source: 'custom' });
  expect(messageAppearanceSurfaces(migrated).incoming).not.toContain('var(');
  expect(sanitizeSettings({ messenger_message_settings: JSON.stringify(oldCustom) }, 'import')).toHaveProperty('messenger_message_settings');
});
it('selects contrasting text for light and dark message surfaces', () => {
  expect(messageTextColor('#ffffff')).toBe('#111111');
  expect(messageTextColor('#000000')).toBe('#ffffff');
  expect(messageTextColor('#0055aa')).toBe('#ffffff');
  expect(messageTextColor('#0077ff')).toBe('#111111');
});
it('adds independent opt-in features without changing existing conversation backgrounds', () => {
  const previous = { messenger_background: true, messenger_background_settings: 'existing' };
  expect(migrateV38ToV39.migrate(previous)).toEqual({ ...previous, messenger_message_background: false, messenger_modern_messages: false,
    messenger_message_settings: JSON.stringify(MESSAGE_APPEARANCE_DEFAULTS) });
});
