import { describe, expect, it } from 'vitest';
import { DEFAULT_MESSENGER_BACKGROUND, isChatBackgroundImage, messengerBackgroundImage, parseMessengerBackground } from './messenger-background.js';
import { sanitizeSettings } from './constants/settings-schema.js';
import { migrateV37ToV38 } from './storage/migrations/migrate_v37_to_v38.js';

describe('conversation backgrounds', () => {
  it('recovers corrupt storage and clamps dimming before CSS rendering', () => {
    expect(parseMessengerBackground('{broken')).toEqual(DEFAULT_MESSENGER_BACKGROUND);
    const settings = parseMessengerBackground({ mode: 'image', color: 'red; color:red', image: 'javascript:alert(1)', dim: 500 });
    expect(settings).toEqual({ ...DEFAULT_MESSENGER_BACKGROUND, mode: 'image', dim: 90 });
    expect(messengerBackgroundImage(settings)).not.toContain('url(');
  });
  it('validates imported settings and rejects executable or malformed resources', () => {
    const json = JSON.stringify({ ...DEFAULT_MESSENGER_BACKGROUND, mode: 'image', image: 'https://example.com/photo.jpg' });
    expect(sanitizeSettings({ messenger_background: true, messenger_background_settings: json }, 'import'))
      .toEqual({ messenger_background: true, messenger_background_settings: json });
    expect(sanitizeSettings({ messenger_background_settings: '{broken' }, 'import')).toEqual({});
    for (const resource of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://name:secret@example.com/a', 'file:///photo.png'])
      expect(isChatBackgroundImage(resource)).toBe(false);
  });
  it('keeps URL quotes inside a single image value', () => {
    const css = messengerBackgroundImage({ ...DEFAULT_MESSENGER_BACKGROUND, mode: 'image', image: 'https://example.com/a?name="x"' });
    expect(css).toContain('url("https://example.com/a?name=\\"x\\"")');
  });
  it('leaves the new feature off for existing users and preserves explicit settings', () => {
    expect(migrateV37ToV38.migrate({ existing: true })).toEqual({ existing: true,
      messenger_background: false, messenger_background_settings: JSON.stringify(DEFAULT_MESSENGER_BACKGROUND) });
    const old = { messenger_background: true, messenger_background_settings: JSON.stringify({ ...DEFAULT_MESSENGER_BACKGROUND, dim: 30 }) };
    expect(migrateV37ToV38.migrate(old)).toEqual(old);
  });
});
