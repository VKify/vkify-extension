import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import SortableList from '@/popup/components/ui/SortableList.js';
import { VIDEO_MENU_ITEMS } from '@/shared/constants/video-menu-items.js';
import { useVideoMenuItems } from '@/popup/hooks/features/useVideoMenuItems.js';
import { VIDEO_MENU_ICONS } from './VideoMenuIcons.js';
import { LayoutRowsIcon, MenuSectionIcon, RefreshIcon } from '@/popup/components/icons/Icons.js';
import './menu-items.css';

export default function VideoMenuItemsSection(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const { isVisible, setVisible, order, setOrder, resetOrder } = useVideoMenuItems();
  const title = (id: string): string => {
    const item = VIDEO_MENU_ITEMS.find(item => item.id === id)!;
    return item.before ? t('menu.separator') : t('video.menu.' + item.name);
  };
  return <div data-vkify-anchor="hidden_video_menu_items" className="menu-items-page space-y-4">
    <SettingsSection title={t('menu.items_title')} icon={<MenuSectionIcon className="w-5 h-5" />} className="menu-items-group"
      action={<button type="button" onClick={resetOrder} aria-label={t('menu.reset_order')} title={t('menu.reset_order')}
        className="menu-order-reset flex items-center gap-1.5 text-xs text-primary hover:underline"><RefreshIcon className="w-4 h-4" /><span>{t('menu.reset_order')}</span></button>}>
      <div className="px-3 pb-3">
        <SortableList items={order} name={title} onReorder={setOrder} className="space-y-1.5"
          rowClassName="flex items-center gap-1 rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] overflow-hidden pr-3">
          {id => {
            const item = VIDEO_MENU_ITEMS.find(item => item.id === id)!;
            const Icon = VIDEO_MENU_ICONS[id];
            return <div className="min-w-0 flex-1"><SettingRow id={'video_menu_item_' + id} title={title(id)} showDocs={false}
              icon={item.before ? <LayoutRowsIcon className="w-5 h-5" /> : <Icon width={20} height={20} />}
              checked={isVisible(id)} onToggle={visible => setVisible(id, visible)} /></div>;
          }}
        </SortableList>
      </div>
    </SettingsSection>
  </div>;
}
