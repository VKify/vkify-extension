import React from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { type IconColor } from '@/popup/components/ui/iconColors.js';
import {
  MenuSectionIcon, EyeOffIcon, LayoutRowsIcon,
  MenuProfileIcon, MenuFeedIcon, MenuMessagesIcon, MenuCallsIcon, MenuFriendsIcon,
  MenuGroupsIcon, MenuPhotosIcon, MenuMusicIcon, MenuVideoIcon, MenuClipsIcon,
  MenuGamesIcon, MenuStickersIcon, MenuMarketIcon, MenuServicesIcon, MenuVotesIcon,
  MenuBookmarksIcon, MenuDocsIcon, MenuAdsIcon, MenuHelpIcon,
} from '@/popup/components/icons/Icons.js';
import { MENU_ITEM_GROUPS } from '@/popup/constants/appearance.js';
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
};

export default function MenuItemsSection(): React.ReactElement {
  const { isVisible, setVisible } = useMenuItems();

  const row = (id: string, name: string, icon?: React.ReactNode, color: IconColor = 'blue'): React.ReactElement => (
    <SettingRow
      id={`menu_item_${id}`}
      title={name}
      icon={icon}
      iconColor={color}
      checked={isVisible(id)}
      onToggle={(v) => setVisible(id, v)}
    />
  );

  return (
    <div className="space-y-5">
      <InfoBlock icon={<EyeOffIcon className="w-4 h-4" />} title="Что показывать" variant="tip">
        Выключенные пункты и разделители исчезнут из левого меню ВКонтакте. Изменения применяются сразу.
      </InfoBlock>

      {MENU_ITEM_GROUPS.map((group) => (
        <SettingsSection
          key={group.id}
          title={group.title}
          icon={<MenuSectionIcon className="w-5 h-5" />}
          iconColor="cyan"
        >
          {group.items.map((item, i) => {
            const meta = ITEM_ICONS[item.id];
            return (
              <React.Fragment key={item.id}>
                {i > 0 && <SectionDivider />}
                {row(item.id, item.name, meta?.icon, meta?.color)}
              </React.Fragment>
            );
          })}

          {group.separatorAfter && (
            <>
              <SectionDivider />
              <SettingRow
                id={`menu_item_${group.separatorAfter.id}`}
                title={group.separatorAfter.name}
                description="Линия между группами"
                icon={<LayoutRowsIcon className="w-5 h-5" />}
                iconColor="cyan"
                checked={isVisible(group.separatorAfter.id)}
                onToggle={(v) => setVisible(group.separatorAfter!.id, v)}
              />
            </>
          )}
        </SettingsSection>
      ))}
    </div>
  );
}
