import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import { VIDEO_MENU_ITEMS } from '@/shared/constants/video-menu-items.js';
import { useVideoMenuItems } from '@/popup/hooks/features/useVideoMenuItems.js';
import { VIDEO_MENU_ICONS } from './VideoMenuIcons.js';
import { LayoutRowsIcon, MenuSectionIcon, RefreshIcon } from '@/popup/components/icons/Icons.js';
import './menu-items.css';

export default function VideoMenuItemsSection(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const { isVisible, setVisible, order, moveItem, resetOrder } = useVideoMenuItems();
  return <div data-vkify-anchor="hidden_video_menu_items" className="menu-items-page space-y-4">
    <SettingsSection title={t('menu.items_title')} icon={<MenuSectionIcon className="w-5 h-5" />} className="menu-items-group"
      action={<button type="button" onClick={resetOrder} aria-label={t('menu.reset_order')} title={t('menu.reset_order')}
        className="menu-order-reset flex items-center gap-1.5 text-xs text-primary hover:underline"><RefreshIcon className="w-4 h-4" /><span>{t('menu.reset_order')}</span></button>}>
      <div className="px-3 pb-3 space-y-1.5">
        {order.map((id, index) => {
          const { name, before } = VIDEO_MENU_ITEMS.find(item => item.id === id)!;
          const title = before ? t('menu.separator') : t('video.menu.' + name);
          const Icon = VIDEO_MENU_ICONS[id];
          return <div key={id} className="flex items-center rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] overflow-hidden">
            <div className="min-w-0 flex-1"><SettingRow id={'video_menu_item_' + id} title={title} showDocs={false}
              icon={before ? <LayoutRowsIcon className="w-5 h-5" /> : <Icon width={20} height={20} />}
              checked={isVisible(id)} onToggle={visible => setVisible(id, visible)} /></div>
            <div className="flex items-center pr-3 gap-1">
              <button type="button" disabled={index === 0} onClick={() => moveItem(id, -1)} aria-label={t('menu.move_up', { name: title })}
                className="w-7 h-7 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default">↑</button>
              <button type="button" disabled={index === order.length - 1} onClick={() => moveItem(id, 1)} aria-label={t('menu.move_down', { name: title })}
                className="w-7 h-7 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default">↓</button>
            </div>
          </div>;
        })}
      </div>
    </SettingsSection>
  </div>;
}
