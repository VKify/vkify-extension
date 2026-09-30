import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HIDING_PAGES } from './pages.js';
import SubpageHost, { type Subpage, useSubpageNav } from '@/popup/components/ui/SubpageHost.js';
import {
  DashboardHero, DashboardHeroImage, DashboardNavItem, DashboardPanel, DashboardSettingCard,
  type DashboardTone,
} from '@/popup/components/ui/DashboardPrimitives.js';
import { EyeOffIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import type { IconColor } from '@/popup/components/ui/iconColors.js';

const PAGE_TONES: Record<string, DashboardTone> = {
  profile: 'violet',
  feed: 'success',
  messenger: 'primary',
  friends: 'warning',
  communities: 'violet',
  menu: 'primary',
  global: 'success',
};

const PAGE_ICON_COLORS: Record<string, IconColor> = {
  profile: 'purple',
  feed: 'green',
  messenger: 'blue',
  friends: 'orange',
  communities: 'purple',
  menu: 'cyan',
  global: 'green',
};

function HidingOverview(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const { open } = useSubpageNav();
  const settings = useVKifyStore(state => state.settings);

  const hiddenCountFor = (pageId: string, anchors: readonly string[]): number => {
    const direct = anchors.filter(anchor => anchor !== 'hidden_menu_items' && settings[anchor] === true).length;
    if (pageId !== 'menu') return direct;
    const hiddenMenuItems = settings['hidden_menu_items'];
    return direct + (Array.isArray(hiddenMenuItems) ? hiddenMenuItems.length : 0);
  };

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<DashboardHeroImage src="/assets/dashboard/hiding-hero.png" />} />

    <DashboardPanel title={t('categories_title')} description={t('categories_description')}
      icon={<EyeOffIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        {HIDING_PAGES.map(page => {
          const Icon = page.icon;
          const count = hiddenCountFor(page.id, page.anchors);
          return <DashboardNavItem key={page.id}
            title={t(`rail.${page.id}`, { defaultValue: page.label })}
            description={t(`subtitle.${page.id}`)}
            icon={<Icon className="h-5 w-5" />}
            tone={PAGE_TONES[page.id] ?? 'primary'}
            meta={count > 0 ? t('hidden_count', { count }) : undefined}
            onClick={() => open(page.id)} />;
        })}
      </div>
    </DashboardPanel>

    <DashboardSettingCard icon={<InfoIcon className="h-5 w-5" />} title={t('hint_title')}
      description={t('hint_body')} />
  </div>;
}

export default function HidingTab(): React.ReactElement {
  const { t } = useTranslation('hiding');
  const subpages = useMemo<Subpage[]>(() => HIDING_PAGES.map(page => {
    const Icon = page.icon;
    const Page = page.component;
    return {
      id: page.id,
      title: t(`rail.${page.id}`, { defaultValue: page.label }),
      subtitle: t(`subtitle.${page.id}`),
      icon: <Icon className="h-5 w-5" />,
      iconColor: PAGE_ICON_COLORS[page.id] ?? 'blue',
      anchors: page.anchors,
      render: () => <div className="settings-subpage"><Page /></div>,
    };
  }), [t]);

  return <SubpageHost subpages={subpages}><HidingOverview /></SubpageHost>;
}
