import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CENTER_PAGES } from './pages.js';
import SubpageHost, { type Subpage, useSubpageNav } from '@/popup/components/ui/SubpageHost.js';
import {
  DashboardHero, DashboardHeroImage, DashboardNavItem, DashboardPanel, DashboardSettingCard,
  type DashboardTone,
} from '@/popup/components/ui/DashboardPrimitives.js';
import { LayoutIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import type { IconColor } from '@/popup/components/ui/iconColors.js';

const PAGE_TONES: Record<string, DashboardTone> = {
  profile: 'violet',
  feed: 'success',
  messages: 'primary',
  friends: 'warning',
  communities: 'violet',
  photo: 'primary',
  music: 'violet',
  video: 'primary',
  clip: 'warning',
  backup: 'success',
};

const PAGE_ICON_COLORS: Record<string, IconColor> = {
  profile: 'purple',
  feed: 'green',
  messages: 'blue',
  friends: 'orange',
  communities: 'purple',
  photo: 'cyan',
  music: 'pink',
  video: 'blue',
  clip: 'orange',
  backup: 'green',
};

function CenterOverview(): React.ReactElement {
  const { t } = useTranslation('center');
  const { open } = useSubpageNav();

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<DashboardHeroImage src="/assets/dashboard/center-hero.png" />} />

    <DashboardPanel title={t('categories_title')} description={t('categories_description')}
      icon={<LayoutIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        {CENTER_PAGES.map(page => {
          const Icon = page.icon;
          return <DashboardNavItem key={page.id}
            title={t(`rail.${page.id}`, { defaultValue: page.label })}
            description={t(`category_desc.${page.id}`)}
            icon={<Icon className="h-5 w-5" />}
            tone={PAGE_TONES[page.id] ?? 'primary'}
            onClick={() => open(page.id)} />;
        })}
      </div>
    </DashboardPanel>

    <DashboardSettingCard icon={<InfoIcon className="h-5 w-5" />} title={t('hub_hint_title')}
      description={t('hub_hint_body')} />
  </div>;
}

export default function CenterTab(): React.ReactElement {
  const { t } = useTranslation('center');
  const subpages = useMemo<Subpage[]>(() => CENTER_PAGES.map(page => {
    const Icon = page.icon;
    const Page = page.component;
    return {
      id: page.id,
      title: t(`rail.${page.id}`, { defaultValue: page.label }),
      subtitle: t(`category_desc.${page.id}`),
      icon: <Icon className="h-5 w-5" />,
      iconColor: PAGE_ICON_COLORS[page.id] ?? 'blue',
      anchors: page.anchors,
      render: () => <div className="dashboard-two-column-subpage"><Page /></div>,
    };
  }), [t]);

  return <SubpageHost subpages={subpages}><CenterOverview /></SubpageHost>;
}
