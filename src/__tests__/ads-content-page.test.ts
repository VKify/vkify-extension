import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ADS_CONTENT_SETTINGS } from '../shared/constants/ads-content.js';
import AdsContentPage from '../popup/components/tabs/ads/AdsContentPage.js';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../popup/store/index.js', () => ({
  useVKifyStore: (selector: (state: { settings: object }) => unknown) => selector({ settings: {} }),
}));
vi.mock('../popup/components/ui/SettingRow.js', () => ({
  default: ({ id, icon }: { id: string; icon: React.ReactNode }) =>
    React.createElement('div', { 'data-setting': id }, icon),
}));

describe('AdsContentPage', () => {
  it('renders every section with a valid icon, including video', () => {
    const markup = renderToStaticMarkup(React.createElement(AdsContentPage));
    for (const id of ADS_CONTENT_SETTINGS) {
      expect(markup).toContain(`data-setting="${id}"`);
    }
    expect(markup.match(/<svg\b/g)).toHaveLength(ADS_CONTENT_SETTINGS.length);
  });
});
