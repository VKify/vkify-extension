import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { type IconColor } from '@/popup/components/ui/iconColors.js';
import {
  MenuSectionIcon, EyeOffIcon, LayoutRowsIcon,
  MenuProfileIcon, MenuFeedIcon, MenuMessagesIcon, MenuCallsIcon, MenuFriendsIcon,
  MenuGroupsIcon, MenuPhotosIcon, MenuMusicIcon, MenuVideoIcon, MenuClipsIcon,
  MenuGamesIcon, MenuStickersIcon, MenuMarketIcon, MenuServicesIcon, MenuVotesIcon,
  MenuBookmarksIcon, MenuDocsIcon, MenuAdsIcon, MenuHelpIcon, VKifyLogo,
} from '@/popup/components/icons/Icons.js';
import { MENU_ITEMS } from '@/shared/constants/menu-items.js';
import { useMenuItems } from '@/popup/hooks/features/useMenuItems.js';

/**
 * «Пункты меню» — подстраница страницы «Меню» (хаб «Скрытие»). Тумблер каждого
 * пункта = показывать ли его в левом меню ВК. Выключение добавляет id в
 * `hidden_menu_items`, что прячет пункт через CSS (см.
 * content/features/hiding/menu/hide-menu-items.ts). Иконки — те же, что в
 * самом меню ВК (@vkontakte/icons, 20px).
 */

const C = 'w-5 h-5';

// id пункта → его иконка (как в реальном меню ВК) + цвет плитки для разнообразия.
const ITEM_ICONS: Record<string, { icon: React.ReactNode; color: IconColor }> = {
  l_pr:       { icon: <MenuProfileIcon className={C} />,   color: 'blue' },
  l_nwsf:     { icon: <MenuFeedIcon className={C} />,      color: 'green' },
  l_msg:      { icon: <MenuMessagesIcon className={C} />,  color: 'cyan' },
  l_ca:       { icon: <MenuCallsIcon className={C} />,     color: 'green' },
  l_fr:       { icon: <MenuFriendsIcon className={C} />,   color: 'orange' },
  l_gr:       { icon: <MenuGroupsIcon className={C} />,    color: 'purple' },
  l_ph:       { icon: <MenuPhotosIcon className={C} />,    color: 'pink' },
  l_aud:      { icon: <MenuMusicIcon className={C} />,     color: 'red' },
  l_vid:      { icon: <MenuVideoIcon className={C} />,     color: 'blue' },
  l_svd:      { icon: <MenuClipsIcon className={C} />,     color: 'purple' },
  l_ap:       { icon: <MenuGamesIcon className={C} />,     color: 'orange' },
  l_stickers: { icon: <MenuStickersIcon className={C} />,  color: 'pink' },
  l_mk:       { icon: <MenuMarketIcon className={C} />,    color: 'cyan' },
  l_mini_apps:{ icon: <MenuServicesIcon className={C} />,  color: 'blue' },
  l_buy_votes:{ icon: <MenuVotesIcon className={C} />,     color: 'orange' },
  l_fav:      { icon: <MenuBookmarksIcon className={C} />, color: 'orange' },
  l_doc:      { icon: <MenuDocsIcon className={C} />,      color: 'blue' },
  l_ads:      { icon: <MenuAdsIcon className={C} />,       color: 'red' },
  l_faq:      { icon: <MenuHelpIcon className={C} />,      color: 'cyan' },
  l_vkify_settings: { icon: <VKifyLogo className={C} />, color: 'blue' },
};

export default function MenuItemsSection(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const { isVisible, setVisible, order, moveItem, resetOrder } = useMenuItems();

  return (
    <div className="menu-items-page space-y-4">
      <InfoBlock icon={<EyeOffIcon className="w-4 h-4" />} title={t('menu.info_title')} variant="tip">
        {t('menu.info_body')}
      </InfoBlock>
      <SettingsSection title={t('menu.items_title')} icon={<MenuSectionIcon className="w-5 h-5" />} iconColor="cyan" className="menu-items-group">
        <div className="px-4 pb-3 flex justify-end">
          <button type="button" onClick={resetOrder} className="text-sm text-primary hover:underline">{t('menu.reset_order')}</button>
        </div>
        <div className="px-4 pb-4 space-y-2">
          {order.map((id, index) => {
            const item = MENU_ITEMS.find((entry) => entry.id === id)!;
            const separator = id.startsWith('sep_');
            const title = separator ? t('menu.separator') : t('menu.names.' + id, { defaultValue: item.name });
            const meta = ITEM_ICONS[id];
            return (
              <div key={id} className="flex items-center rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] overflow-hidden">
                <div className="min-w-0 flex-1">
                  <SettingRow id={'menu_item_' + id} title={title}
                    description={separator ? t('menu.separator_desc') : undefined}
                    icon={separator ? <LayoutRowsIcon className={C} /> : meta?.icon}
                    iconColor={meta?.color} checked={isVisible(id)} onToggle={(v) => setVisible(id, v)} />
                </div>
                <div className="flex flex-col pr-3 gap-1">
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
