import { describe, expect, it } from 'vitest';
import { FUNCTIONS } from '../popup/constants/functions.js';
import { getDocsPath } from '../shared/constants/docs.js';
import { ADS_CONTENT_SETTINGS } from '../shared/constants/ads-content.js';
import { DISPLAY_MODES, VISUAL_FILTERS } from '../popup/constants/appearance.js';

const POPUP_SOURCES = import.meta.glob('../popup/components/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const POPUP_SOURCE = Object.values(POPUP_SOURCES).join('\n');

describe('popup documentation links', () => {
  it('documents every feature exposed through global search', () => {
    const missing = FUNCTIONS.map(({ id }) => id).filter(id => getDocsPath(id) === null);
    expect(missing, `functions without a documentation target:\n${missing.join('\n')}`).toEqual([]);
  });

  it('uses absolute docs routes with stable anchors', () => {
    for (const { id } of FUNCTIONS) {
      expect(getDocsPath(id)).toMatch(/^\/docs\/[a-z]+#[a-z0-9_]+$/);
    }
  });

  it('documents every literal SettingRow and NavRow docs id', () => {
    const ids = [
      ...POPUP_SOURCE.matchAll(/<SettingRow[\s\S]{0,240}?\bid=["']([a-z0-9_]+)["']/g),
      ...POPUP_SOURCE.matchAll(/\bdocsId=["']([a-z0-9_]+)["']/g),
    ].map(match => match[1]);
    const missing = [...new Set(ids)].filter(id => getDocsPath(id) === null);
    expect(missing, `popup controls without a documentation target:\n${missing.join('\n')}`).toEqual([]);
  });

  it('documents data-driven rows', () => {
    const ids = [
      ...ADS_CONTENT_SETTINGS,
      ...DISPLAY_MODES.map(({ id }) => id),
      ...VISUAL_FILTERS.map(({ id }) => id),
    ];
    const missing = ids.filter(id => getDocsPath(id) === null);
    expect(missing, `data-driven controls without a documentation target:\n${missing.join('\n')}`).toEqual([]);
  });
});
