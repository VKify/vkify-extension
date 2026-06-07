import { describe, it, expect } from 'vitest';
import {
  isValidSettingValue,
  sanitizeSettings,
  keysForScope,
  MAX_SETTING_STRING_LENGTH,
} from '../shared/constants/settings-schema.js';

describe('isValidSettingValue — type checks', () => {
  it('validates strings within the length cap', () => {
    expect(isValidSettingValue('custom_theme', 'midnight', 'theme')).toBe(true);
    expect(isValidSettingValue('custom_theme', 'x'.repeat(MAX_SETTING_STRING_LENGTH + 1), 'theme')).toBe(false);
    expect(isValidSettingValue('custom_theme', 123, 'theme')).toBe(false);
  });

  it('validates finite numbers only', () => {
    expect(isValidSettingValue('block_opacity', 0.5, 'theme')).toBe(true);
    expect(isValidSettingValue('block_opacity', NaN, 'theme')).toBe(false);
    expect(isValidSettingValue('block_opacity', Infinity, 'theme')).toBe(false);
    expect(isValidSettingValue('block_opacity', '0.5', 'theme')).toBe(false);
  });

  it('validates booleans strictly', () => {
    expect(isValidSettingValue('compact_spacing', true, 'theme')).toBe(true);
    expect(isValidSettingValue('compact_spacing', 'true', 'theme')).toBe(false);
    expect(isValidSettingValue('compact_spacing', 1, 'theme')).toBe(false);
  });

  it('validates enums against the allowed set', () => {
    expect(isValidSettingValue('custom_font_style', 'italic', 'theme')).toBe(true);
    expect(isValidSettingValue('custom_font_style', 'slanted', 'theme')).toBe(false);
  });
});

describe('isValidSettingValue — audio download settings', () => {
  it('accepts the audio_download boolean toggles', () => {
    expect(isValidSettingValue('audio_download', true, 'import')).toBe(true);
    expect(isValidSettingValue('audio_download_id3', true, 'import')).toBe(true);
    expect(isValidSettingValue('audio_download_lyrics', false, 'import')).toBe(true);
    expect(isValidSettingValue('audio_download_id3', 'yes', 'import')).toBe(false);
  });

  it('validates bitrate / filename enums', () => {
    expect(isValidSettingValue('audio_download_bitrate', '320', 'import')).toBe(true);
    expect(isValidSettingValue('audio_download_bitrate', '256', 'import')).toBe(false);
    expect(isValidSettingValue('audio_download_filename', 'artist_title', 'import')).toBe(true);
    expect(isValidSettingValue('audio_download_filename', 'whatever', 'import')).toBe(false);
  });
});

describe('isValidSettingValue — keys and scopes', () => {
  it('rejects unknown keys', () => {
    expect(isValidSettingValue('definitely_not_a_key', 'x', 'theme')).toBe(false);
  });

  it('rejects inherited Object.prototype keys (no pollution surface)', () => {
    expect(isValidSettingValue('__proto__', {}, 'theme')).toBe(false);
    expect(isValidSettingValue('constructor', 'x', 'theme')).toBe(false);
    expect(isValidSettingValue('toString', 'x', 'theme')).toBe(false);
  });

  it('honors scope membership', () => {
    // custom_css is import-only — not writable from a shared theme.
    expect(isValidSettingValue('custom_css', 'body{}', 'import')).toBe(true);
    expect(isValidSettingValue('custom_css', 'body{}', 'theme')).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('keeps valid entries and drops invalid ones', () => {
    const out = sanitizeSettings(
      {
        custom_theme: 'midnight',     // valid
        block_opacity: 'nope',        // wrong type → dropped
        custom_css: 'body{}',         // out of theme scope → dropped
        unknown_key: 1,               // unknown → dropped
        compact_spacing: true,        // valid
      },
      'theme',
    );
    expect(out).toEqual({ custom_theme: 'midnight', compact_spacing: true });
  });

  it('ignores a malicious __proto__ key without polluting Object.prototype', () => {
    sanitizeSettings(JSON.parse('{"__proto__":{"polluted":true}}'), 'theme');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('returns a plain (JSON-friendly) object', () => {
    const out = sanitizeSettings({ custom_theme: 'x' }, 'theme');
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
  });
});

describe('keysForScope', () => {
  it('returns only keys declared for the scope', () => {
    const theme = keysForScope('theme');
    expect(theme).toContain('custom_theme');
    expect(theme).not.toContain('custom_css'); // import-only

    const imp = keysForScope('import');
    expect(imp).toContain('custom_css');
    expect(imp).toContain('custom_theme'); // import is a superset of theme keys
  });
});
