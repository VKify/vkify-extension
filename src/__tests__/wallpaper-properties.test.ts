import { describe, expect, it } from 'vitest';
import {
  createWallpaperEnginePayload,
  deriveWebWallpaperId,
  getWallpaperPropertyValues,
  normalizeWallpaperEngineProperties,
  parseWallpaperPropertySchema,
  parseWallpaperValues,
} from '@/shared/wallpaper-properties.js';
import { sanitizeSettings } from '@/shared/constants/settings-schema.js';

const schemaJson = JSON.stringify([
  { key: 'speed', type: 'slider', label: 'Speed', defaultValue: 1, min: 1, max: 20, step: 1 },
  { key: 'rainbow', type: 'bool', label: 'Rainbow', defaultValue: true },
  { key: 'fontfamily', type: 'combo', label: 'Font', defaultValue: 'arial', options: [{ label: 'Arial', value: 'arial' }] },
  { key: 'schemecolor', type: 'color', label: 'Scheme color', defaultValue: '0 1 0' },
]);

describe('Wallpaper Engine property schema', () => {
  it('normalizes defaults and restores saved values per wallpaper', () => {
    const schema = parseWallpaperPropertySchema(schemaJson);
    const saved = parseWallpaperValues(JSON.stringify({
      matrix: { speed: 8, rainbow: false },
      another: { speed: 3 },
    }));

    expect(getWallpaperPropertyValues(schema, saved.matrix)).toEqual({
      speed: 8,
      rainbow: false,
      fontfamily: 'arial',
      schemecolor: '0 1 0',
    });
    expect(getWallpaperPropertyValues(schema, saved.another).speed).toBe(3);
  });

  it('creates the object shape expected by applyUserProperties', () => {
    const schema = parseWallpaperPropertySchema(schemaJson);
    expect(createWallpaperEnginePayload(schema, {
      speed: 5,
      rainbow: true,
      fontfamily: 'arial',
      schemecolor: '1 0 0',
    })).toEqual({
      speed: { value: 5 },
      rainbow: { value: true },
      fontfamily: { value: 'arial', text: 'Arial' },
      schemecolor: { value: '1 0 0' },
    });
  });

  it('drops invalid definitions and persisted values', () => {
    expect(parseWallpaperPropertySchema(JSON.stringify([
      { key: '__proto__!', type: 'slider', label: 'Bad', defaultValue: 1 },
      { key: 'file', type: 'file', label: 'Unsupported', defaultValue: '' },
    ]))).toEqual([]);
    expect(parseWallpaperValues(JSON.stringify({ matrix: { valid: 1, 'bad-key!': 2 } }))).toEqual({ matrix: { valid: 1 } });
  });

  it('accepts catalog metadata but never lets the site overwrite saved values', () => {
    expect(sanitizeSettings({
      web_wallpaper_id: 'rainbow-matrix',
      web_wallpaper_schema: schemaJson,
      web_wallpaper_values: '{"rainbow-matrix":{"speed":20}}',
    }, 'siteWrite')).toEqual({
      web_wallpaper_id: 'rainbow-matrix',
      web_wallpaper_schema: schemaJson,
    });
  });

  it('normalizes raw project.json properties for a pasted URL', () => {
    expect(normalizeWallpaperEngineProperties({
      speed: { type: 'slider', text: 'Speed', value: 1, min: 1, max: 20, order: 10 },
      schemecolor: { type: 'color', text: 'ui_browse_properties_scheme_color', value: '0 1 0', order: 0 },
      localfile: { type: 'file', text: 'File', value: '' },
    })).toEqual([
      { key: 'schemecolor', type: 'color', label: 'Scheme color', defaultValue: '0 1 0' },
      { key: 'speed', type: 'slider', label: 'Speed', defaultValue: 1, min: 1, max: 20 },
    ]);
    expect(deriveWebWallpaperId('http://localhost:5173/wallpapers/a/index.html')).toMatch(/^url-[a-z0-9]+$/);
    expect(deriveWebWallpaperId('http://localhost:5173/wallpapers/a/index.html'))
      .not.toBe(deriveWebWallpaperId('http://localhost:5173/wallpapers/b/index.html'));
  });
});
