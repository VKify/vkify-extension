import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CENTER_PAGES } from './pages.js';
import SubpageHost, { type Subpage, useSubpageNav } from '@/popup/components/ui/SubpageHost.js';
import {
  DashboardHero, DashboardHeroArtwork, DashboardNavItem, DashboardPanel, DashboardSettingCard,
} from '@/popup/components/ui/DashboardPrimitives.js';
import { LayoutRowsIcon, InfoIcon } from '@/popup/components/icons/Icons.js';

function CenterOverview(): React.ReactElement {
  const { t } = useTranslation('center');
  const { open } = useSubpageNav();

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')}
      artwork={<DashboardHeroArtwork name="center" />} />

    <DashboardPanel title={t('categories_title')} description={t('categories_description')}
      icon={<LayoutRowsIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        {CENTER_PAGES.map(page => {
          const Icon = page.icon;
          return <DashboardNavItem key={page.id}
            title={t(`rail.${page.id}`, { defaultValue: page.label })}
            description={t(`category_desc.${page.id}`)}
            icon={<Icon className="h-5 w-5" />}
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
      anchors: page.anchors,
      render: () => <div className="settings-subpage"><Page /></div>,
    };
  }), [t]);

  return <SubpageHost subpages={subpages}><CenterOverview /></SubpageHost>;
}
