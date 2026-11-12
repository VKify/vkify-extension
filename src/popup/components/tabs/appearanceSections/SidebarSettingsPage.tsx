import React from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { EDGE_SIDEBAR_DEFAULTS } from '@/shared/edge-sidebar.js';
import { DISPLAY_MODES } from '@/popup/constants/appearance.js';
import { SegmentedControl } from '../../ui/DashboardPrimitives.js';
import IconTile from '../../ui/IconTile.js';
import SettingRow from '../../ui/SettingRow.js';
import ResetButton from '../../ui/ResetButton.js';
import { SidebarIcon, LayoutRowsIcon, MenuSectionIcon, LayoutIcon } from '../../icons/Icons.js';
import EdgeSidebarSettings from './EdgeSidebarSettings.js';

export const MENU_DEFAULTS = {
  ...EDGE_SIDEBAR_DEFAULTS,
  minimalistic_sidebar: false,
  tile_sidebar: false,
  edge_sidebar: false,
  sidebar_right: false,
  fixed_sidebar: false,
  sidebar_with_background: false,
};

export function SidebarResetButton(): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore(s => s.settings);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  if (!Object.entries(MENU_DEFAULTS).some(([key, value]) => (settings[key] ?? value) !== value)) return null;
  return <ResetButton onClick={() => { void saveMultiple(MENU_DEFAULTS); }} aria-label={t('reset.sidebar')} />;
}

export default function SidebarSettingsPage(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore(s => s.settings);
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const mode = settings.edge_sidebar === true ? 'edge' : settings.tile_sidebar === true ? 'tiles' : settings.minimalistic_sidebar === true ? 'mini' : 'default';
  return <section className="dashboard-panel overflow-hidden"><div className="setting-row px-4 py-3" data-vkify-anchor="minimalistic_sidebar">
    <div className="flex items-center gap-3 mb-3">
      <IconTile icon={<SidebarIcon className="w-5 h-5" />} />
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">{t('display.sidebar.title')}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t(`display.sidebar.${mode}_desc`)}</div>
      </div>
    </div>
    <div data-vkify-anchor="tile_sidebar"><SegmentedControl label={t('display.sidebar.title')} value={mode} options={[
      { value: 'default', label: t('display.sidebar.default'), icon: <LayoutRowsIcon className="h-4 w-4 shrink-0" /> },
      { value: 'mini', label: t('display.sidebar.mini'), icon: <MenuSectionIcon className="h-4 w-4 shrink-0" /> },
      { value: 'tiles', label: t('display.sidebar.tiles'), icon: <LayoutIcon className="h-4 w-4 shrink-0" /> },
      { value: 'edge', label: t('display.sidebar.edge'), icon: <SidebarIcon className="h-4 w-4 shrink-0" /> },
    ]} onChange={value => { void saveMultiple({ minimalistic_sidebar: value === 'mini', tile_sidebar: value === 'tiles', edge_sidebar: value === 'edge' }); }} /></div>
    <span data-vkify-anchor="edge_sidebar" />
    <div className="mt-4 space-y-2" data-vkify-anchor="sidebar_right">
      <div className="text-xs text-[var(--text-secondary)]">{t('display.sidebar.side_title')}</div>
      <SegmentedControl label={t('display.sidebar.side_title')} value={settings.sidebar_right === true ? 'right' : 'left'} options={[
        { value: 'left', label: t('display.sidebar.side_left'), icon: <SidebarIcon className="h-4 w-4 shrink-0" /> },
        { value: 'right', label: t('display.sidebar.side_right'), icon: <SidebarIcon className="h-4 w-4 shrink-0 rotate-180" /> },
      ]} onChange={value => { void saveMultiple({ sidebar_right: value === 'right' }); }} />
      <p className="text-xs text-[var(--text-secondary)]">{t('display.sidebar.side_hint')}</p>
    </div>
    {mode === 'edge' && <EdgeSidebarSettings />}
  </div>
    {mode !== 'edge' && ['fixed_sidebar', 'sidebar_with_background'].map(id => {
      const mode = DISPLAY_MODES.find(item => item.id === id)!;
      return <SettingRow key={id} id={id} title={t(`modes.${id}.title`, { defaultValue: mode.title })}
        description={t(`modes.${id}.desc`, { defaultValue: mode.description })}
        icon={<SidebarIcon className="w-5 h-5" />} />;
    })}
  </section>;
}

