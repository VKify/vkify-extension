import React from 'react';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import AdsContentPage from './ads/AdsContentPage.js';
import { useTranslation } from 'react-i18next';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import { DashboardHero, DashboardHeroArtwork, DashboardNavItem, DashboardPanel, DashboardSettingCard } from '../ui/DashboardPrimitives.js';
import Toggle from '../ui/Toggle.js';
import {
  BanIcon, ShieldIcon, SidebarIcon, FilterIcon,
  ChartIcon, ScissorsIcon, TargetIcon,
} from '../icons/Icons.js';
import { useAdsBlocking } from '../../hooks/features/useAdsBlocking.js';
import { useVKifyStore } from '../../store/index.js';
import { useBlockStats } from './ads/useBlockStats.js';
import { formatCount } from './ads/format.js';
import AdsKeywordsPage from './ads/AdsKeywordsPage.js';
import AdsStatsPage from './ads/AdsStatsPage.js';

// ── Main ───────────────────────────────────────────────────────────────────

function AdsNavCard(props: Omit<React.ComponentProps<typeof DashboardNavItem>, 'onClick'> & { subpage: string }): React.ReactElement {
  const { open } = useSubpageNav();
  const { subpage, ...cardProps } = props;
  return <DashboardNavItem {...cardProps} onClick={() => open(subpage)} />;
}

export default function AdsTab(): React.ReactElement {
  const { t } = useTranslation('ads');
  const { allBlocked, handleBlockAll, activeCount, totalCount } = useAdsBlocking();
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const contentActive = ADS_CONTENT_SETTINGS.filter(id => settings[id] === true).length;

  const adsSubpages: Subpage[] = [
    {
      id: 'content',
      title: t('content.title'),
      subtitle: t('content.subtitle'),
      icon: <BanIcon className="w-5 h-5" />,
      anchors: [...ADS_CONTENT_SETTINGS],
      render: () => <AdsContentPage />,
    },
    {
      id: 'keywords',
      title: t('keywords.page_title'),
      subtitle: t('keywords.page_subtitle'),
      icon: <FilterIcon className="w-5 h-5" />,
      anchors: ['custom_block_words', 'custom_allow_words'],
      render: () => <AdsKeywordsPage />,
    },
    {
      id: 'stats',
      title: t('stats.page_title'),
      subtitle: t('stats.page_subtitle'),
      icon: <ChartIcon className="w-5 h-5" />,
      anchors: ['ads_stats'],
      render: () => <AdsStatsPage />,
    },
  ];

  // Сводки для рядов-переходов (полные данные — внутри подстраниц).
  const { trackersBlocked, adsBlocked } = useBlockStats();
  const totalBlocked = trackersBlocked + adsBlocked;

  const blockWords = (settings['custom_block_words'] as string[]) ?? [];
  const allowWords = (settings['custom_allow_words'] as string[]) ?? [];
  const wordsCount = blockWords.length + allowWords.length;

  const toggleCard = (id: string, title: string, description: string, icon: React.ReactNode): React.ReactElement => (
    <DashboardSettingCard key={id} anchor={id} docsId={id} title={title} description={description}
      icon={icon} control={<Toggle checked={settings[id] === true}
        onChange={value => { void saveSetting(id, value); }} />} />
  );

  return (
    <SubpageHost subpages={adsSubpages}>
    <div className="space-y-4">
      <DashboardHero
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        description={t('dashboard.description')}
        artwork={<DashboardHeroArtwork name="ads" />}
      />
      <DashboardPanel title={allBlocked ? t('banner.full') : activeCount > 0 ? t('banner.partial') : t('banner.off')}
        description={allBlocked ? t('block.all_on') : t('block.active_of_total', { active: activeCount, total: totalCount })}
        icon={<ShieldIcon className="w-5 h-5" />} className="pb-4" action={<button
          type="button"
          onClick={handleBlockAll}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        >
          <BanIcon className="w-4 h-4" />
          {allBlocked ? t('block.disable_all') : t('block.enable_all')}
        </button>}>
        <div className="grid grid-cols-3 gap-2 px-4 max-[590px]:grid-cols-1">
          {[[t('summary.total'), totalBlocked], [t('summary.posts'), adsBlocked], [t('summary.trackers'), trackersBlocked]].map(([label, value]) =>
            <div key={String(label)} className="rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)] p-3">
              <strong className="block text-lg text-[var(--text-primary)]">{formatCount(Number(value))}</strong>
              <span className="text-xs text-[var(--text-secondary)]">{label}</span>
            </div>)}
        </div>
      </DashboardPanel>

      <DashboardPanel title={t('sections.protection.title')} description={t('sections.protection.desc')}
        icon={<ShieldIcon className="w-5 h-5" />} className="pb-4">
        <div className="grid grid-cols-2 gap-2 px-4 max-[590px]:grid-cols-1">
          <AdsNavCard subpage="content" title={t('content.nav_title')} description={t('content.nav_desc')}
            icon={<BanIcon className="w-5 h-5" />} docsId="ads_content"
            meta={t('content.meta', { active: contentActive, total: ADS_CONTENT_SETTINGS.length })} />
          {toggleCard('block_feed_ads_api', t('rows.api.title'), t('rows.api.desc'), <FilterIcon className="w-5 h-5" />)}
          {toggleCard('block_left_ads', t('rows.left.title'), t('rows.left.desc'), <SidebarIcon className="w-5 h-5" />)}
          {toggleCard('block_trackers', t('rows.trackers.title'), t('rows.trackers.desc'), <TargetIcon className="w-5 h-5" />)}
        </div>
      </DashboardPanel>

      <DashboardPanel title={t('sections.keywords.title')} description={t('sections.keywords.desc')}
        icon={<FilterIcon className="w-5 h-5" />} className="pb-4">
        <div className="grid grid-cols-2 gap-2 px-4 max-[590px]:grid-cols-1">
          <AdsNavCard subpage="keywords" title={t('keywords.nav_title')} description={t('keywords.nav_desc')}
            icon={<FilterIcon className="w-5 h-5" />} docsId="ads_keywords"
            meta={wordsCount > 0 ? t('keywords.meta', { count: wordsCount }) : undefined} />
          {toggleCard('block_feed_ads_dom', t('rows.dom.title'), t('rows.dom.desc'), <ScissorsIcon className="w-5 h-5" />)}
        </div>
      </DashboardPanel>

      <DashboardPanel title={t('sections.activity.title')} icon={<ChartIcon className="w-5 h-5" />} className="pb-4">
        <div className="px-4"><AdsNavCard subpage="stats" title={t('stats.nav_title')} description={t('stats.nav_desc')}
          icon={<ChartIcon className="w-5 h-5" />} docsId="ads_stats"
          meta={totalBlocked > 0 ? formatCount(totalBlocked) : undefined} /></div>
      </DashboardPanel>
    </div>
    </SubpageHost>
  );
}
