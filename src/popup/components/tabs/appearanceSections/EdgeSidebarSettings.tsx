import React from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { EDGE_SIDEBAR_BACKGROUNDS, EDGE_SIDEBAR_DEFAULTS } from '@/shared/edge-sidebar.js';
import { SegmentedControl } from '../../ui/DashboardPrimitives.js';
import ColorPickerField from '../../ui/ColorPickerField.js';
import RangeSlider from '../../ui/RangeSlider.js';

const SLIDERS = [
  { key: 'edge_sidebar_opacity', label: 'opacity', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'edge_sidebar_blur', label: 'blur', min: 0, max: 40, step: 1, unit: 'px' },
  { key: 'edge_sidebar_item_height', label: 'item_height', min: 32, max: 56, step: 2, unit: 'px' },
  { key: 'edge_sidebar_item_radius', label: 'item_radius', min: 0, max: 24, step: 1, unit: 'px' },
] as const;

export default function EdgeSidebarSettings(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore(s => s.settings);
  const saveSetting = useVKifyStore(s => s.saveSetting);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const mode = settings.edge_sidebar_background ?? EDGE_SIDEBAR_DEFAULTS.edge_sidebar_background;
  const width = Number(settings.edge_sidebar_width ?? EDGE_SIDEBAR_DEFAULTS.edge_sidebar_width);
  const changed = Object.entries(EDGE_SIDEBAR_DEFAULTS).some(([key, value]) => (settings[key] ?? value) !== value);
  return <div className="mt-4 space-y-4 border-t border-[var(--border-color)] pt-4" data-testid="edge-sidebar-settings">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-[var(--text-secondary)]">{t('display.edge.title')}</span>
      <button type="button" disabled={!changed} onClick={() => { void saveMultiple({ ...EDGE_SIDEBAR_DEFAULTS }); }}
        className="text-xs text-primary hover:underline disabled:opacity-40 disabled:no-underline">{t('display.edge.reset')}</button>
    </div>
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-secondary)]">{t('display.edge.width')}</p>
      <SegmentedControl label={t('display.edge.width_mode')} value={width === 0 ? 'auto' : 'custom'}
        options={['auto', 'custom'].map(value => ({ value, label: t(`display.edge.width_${value}`) }))}
        onChange={value => { void saveSetting('edge_sidebar_width', value === 'auto' ? 0 : 204); }} />
      {width !== 0 && <RangeSlider id="edge_sidebar_width" label={t('display.edge.width')} inline
        value={width} min={156} max={300} step={2} unit="px"
        onChange={value => { void saveSetting('edge_sidebar_width', value); }} />}
    </div>
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-secondary)]">{t('display.edge.background')}</p>
      <SegmentedControl label={t('display.edge.background')} value={String(mode)}
        options={EDGE_SIDEBAR_BACKGROUNDS.map(value => ({ value, label: t(`display.edge.background_${value}`) }))}
        onChange={value => { void saveSetting('edge_sidebar_background', value); }} />
      {mode === 'custom' && <ColorPickerField
        value={String(settings.edge_sidebar_color ?? EDGE_SIDEBAR_DEFAULTS.edge_sidebar_color)}
        ariaLabel={t('display.edge.color')}
        onChange={value => { void saveSetting('edge_sidebar_color', value); }} />}
    </div>
    {SLIDERS.filter(({ key }) => mode !== 'transparent' || (key !== 'edge_sidebar_opacity' && key !== 'edge_sidebar_blur')).map(slider =>
      <RangeSlider key={slider.key} id={slider.key} label={t(`display.edge.${slider.label}`)} inline
        value={Number(settings[slider.key] ?? EDGE_SIDEBAR_DEFAULTS[slider.key])}
        min={slider.min} max={slider.max} step={slider.step} unit={slider.unit}
        onChange={value => { void saveSetting(slider.key, value); }} />)}
  </div>;
}
