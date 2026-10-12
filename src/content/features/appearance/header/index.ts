import { cssFeature, cssPlugin, type FeatureDefinition } from '@/content/core/features/index.js';
import { startAutoHideHeader } from './auto-hide.js';

const offsets = 'appearance/header/header-offsets.css';

/** CSS geometry; the scroll controller only toggles a root marker. */
export const headerFeatures: readonly FeatureDefinition[] = [
  cssFeature({
    id: 'static_header',
    name: 'Статичная шапка',
    category: 'appearance',
    cssFiles: ['appearance/header/static-header.css', offsets],
  }),
  {
    id: 'auto_hide_header', name: 'Шапка по направлению прокрутки', category: 'appearance',
    phase: 'early-css', impact: 'light', reapplyOnNavigate: true,
    settingsKeys: ['auto_hide_header'], cssFiles: ['appearance/header/auto-hide.css', offsets],
    plugins: [cssPlugin(), { name: 'scroll-direction', setup: () => startAutoHideHeader() }],
  },
  cssFeature({
    id: 'compact_header', name: 'Компактная шапка', category: 'appearance',
    cssFiles: ['appearance/header/compact-header.css', offsets],
  }),
  cssFeature({
    id: 'collapse_search',
    name: 'Свернуть поиск',
    category: 'appearance',
    cssFiles: 'appearance/header/header.css',
  }),
];
