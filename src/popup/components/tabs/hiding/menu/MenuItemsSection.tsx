import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import {
  MenuSectionIcon, RefreshIcon, LayoutRowsIcon,
  MenuProfileIcon, MenuFeedIcon, MenuMessagesIcon, MenuCallsIcon, MenuFriendsIcon,
  MenuGroupsIcon, MenuPhotosIcon, MenuMusicIcon, MenuVideoIcon, MenuClipsIcon,
  MenuGamesIcon, MenuStickersIcon, MenuMarketIcon, MenuServicesIcon, MenuVotesIcon,
  MenuBookmarksIcon, MenuDocsIcon, MenuAdsIcon, MenuHelpIcon, VKifyLogo,
} from '@/popup/components/icons/Icons.js';
import { MENU_ITEMS } from '@/shared/constants/menu-items.js';
import { useMenuItems } from '@/popup/hooks/features/useMenuItems.js';
import './menu-items.css';

/**
 * «Пункты меню» — подстраница страницы «Меню» (хаб «Скрытие»). Тумблер каждого
 * пункта = показывать ли его в левом меню ВК. Выключение добавляет id в
 * `hidden_menu_items`, что прячет пункт через CSS (см.
 * content/features/hiding/menu/hide-menu-items.ts). Иконки — те же, что в
 * самом меню ВК (@vkontakte/icons, 20px).
 */

const C = 'w-5 h-5';

// id пункта → его иконка (как в реальном меню ВК).
const ITEM_ICONS: Record<string, { icon: React.ReactNode }> = {
  l_pr:       { icon: <MenuProfileIcon className={C} /> },
  l_nwsf:     { icon: <MenuFeedIcon className={C} /> },
  l_msg:      { icon: <MenuMessagesIcon className={C} /> },
  l_ca:       { icon: <MenuCallsIcon className={C} /> },
  l_fr:       { icon: <MenuFriendsIcon className={C} /> },
  l_gr:       { icon: <MenuGroupsIcon className={C} /> },
  l_ph:       { icon: <MenuPhotosIcon className={C} /> },
  l_aud:      { icon: <MenuMusicIcon className={C} /> },
  l_vid:      { icon: <MenuVideoIcon className={C} /> },
  l_svd:      { icon: <MenuClipsIcon className={C} /> },
  l_ap:       { icon: <MenuGamesIcon className={C} /> },
  l_stickers: { icon: <MenuStickersIcon className={C} /> },
  l_mk:       { icon: <MenuMarketIcon className={C} /> },
  l_mini_apps:{ icon: <MenuServicesIcon className={C} /> },
  l_buy_votes:{ icon: <MenuVotesIcon className={C} /> },
  l_fav:      { icon: <MenuBookmarksIcon className={C} /> },
  l_doc:      { icon: <MenuDocsIcon className={C} /> },
  l_ads:      { icon: <MenuAdsIcon className={C} /> },
  l_faq:      { icon: <MenuHelpIcon className={C} /> },
  l_vkify_settings: { icon: <VKifyLogo className={C} /> },
};

export default function MenuItemsSection(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const { isVisible, setVisible, order, moveItem, resetOrder } = useMenuItems();

  return (
    <div className="menu-items-page">
      <SettingsSection title={t('menu.items_title')} icon={<MenuSectionIcon className="w-5 h-5" />} className="menu-items-group"
        action={<button type="button" onClick={resetOrder} aria-label={t('menu.reset_order')} title={t('menu.reset_order')}
          className="menu-order-reset flex items-center gap-1.5 text-xs text-primary hover:underline"><RefreshIcon className="w-4 h-4" /><span>{t('menu.reset_order')}</span></button>}>
        <div className="px-3 pb-3 space-y-1.5">
          {order.map((id, index) => {
            const item = MENU_ITEMS.find((entry) => entry.id === id)!;
            const separator = id.startsWith('sep_');
            const title = separator ? t('menu.separator') : t('menu.names.' + id, { defaultValue: item.name });
            const meta = ITEM_ICONS[id];
            return (
              <div key={id} className="flex items-center rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] overflow-hidden">
                <div className="min-w-0 flex-1">
                  <SettingRow id={'menu_item_' + id} title={title}
                    icon={separator ? <LayoutRowsIcon className={C} /> : meta?.icon}
                    showDocs={false} checked={isVisible(id)} onToggle={(v) => setVisible(id, v)} />
                </div>
                <div className="flex items-center pr-3 gap-1">
                  <button type="button" disabled={index === 0} onClick={() => moveItem(id, -1)}
                    aria-label={t('menu.move_up', { name: title })} title={t('menu.move_up', { name: title })}
                    className="w-7 h-7 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default">↑</button>
                  <button type="button" disabled={index === order.length - 1} onClick={() => moveItem(id, 1)}
                    aria-label={t('menu.move_down', { name: title })} title={t('menu.move_down', { name: title })}
                    className="w-7 h-7 rounded hover:bg-[var(--bg-secondary)] disabled:opacity-30 disabled:cursor-default">↓</button>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}
