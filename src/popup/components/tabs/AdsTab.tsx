import React from 'react';
import { ADS_CONTENT_SETTINGS } from '@/shared/constants/ads-content.js';
import AdsContentPage from './ads/AdsContentPage.js';
import { useTranslation } from 'react-i18next';
import SettingRow from '../ui/SettingRow.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
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

// ── Divider between SettingRows ────────────────────────────────────────────

function RowDivider(): React.ReactElement {
  return <div className="mx-3 border-t border-[var(--border-color)]" />;
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function AdsTab(): React.ReactElement {
  const { t } = useTranslation('ads');
  const { allBlocked, handleBlockAll, activeCount, totalCount } = useAdsBlocking();
  const settings = useVKifyStore((s) => s.settings);

  const contentActive = ADS_CONTENT_SETTINGS.filter(id => settings[id] === true).length;

  const adsSubpages: Subpage[] = [
    {
      id: 'content',
      title: t('content.title'),
      subtitle: t('content.subtitle'),
      icon: <BanIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: [...ADS_CONTENT_SETTINGS],
      render: () => <AdsContentPage />,
    },
    {
      id: 'keywords',
      title: t('keywords.page_title'),
      subtitle: t('keywords.page_subtitle'),
      icon: <FilterIcon className="w-5 h-5" />,
      iconColor: 'red',
      anchors: ['custom_block_words', 'custom_allow_words'],
      render: () => <AdsKeywordsPage />,
    },
    {
      id: 'stats',
      title: t('stats.page_title'),
      subtitle: t('stats.page_subtitle'),
      icon: <ChartIcon className="w-5 h-5" />,
      iconColor: 'purple',
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

  const shieldColor = activeCount === totalCount ? 'text-emerald-500' : activeCount > 0 ? 'text-primary' : 'text-[var(--text-tertiary)]';
  const shieldBg    = activeCount === totalCount ? 'bg-emerald-500/10' : activeCount > 0 ? 'bg-primary/10' : 'bg-[var(--bg-secondary)]';

  return (
    <SubpageHost subpages={adsSubpages}>
    <div className="space-y-5">
      <section className={`rounded-2xl p-4 border border-[var(--border-color)] ${shieldBg}`} aria-label={t('block.section')}>
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center shrink-0 shadow-sm ${shieldColor}`}>
            <ShieldIcon className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className={`text-base font-semibold ${shieldColor}`}>
              {allBlocked ? t('banner.full') : activeCount > 0 ? t('banner.partial') : t('banner.off')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {allBlocked ? t('block.all_on') : t('block.active_of_total', { active: activeCount, total: totalCount })}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">{t('summary.total')}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]" title={totalBlocked.toLocaleString()}>
                {formatCount(totalBlocked)}
              </p>
            </div>
            <span className="text-[11px] rounded-full px-2.5 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)]">{t('summary.period')}</span>
          </div>
          <div className="grid grid-cols-2 border-t border-[var(--border-color)] divide-x divide-[var(--border-color)]">
            <div className="px-4 py-3">
              <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]" title={adsBlocked.toLocaleString()}>{formatCount(adsBlocked)}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('summary.posts')}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-lg font-semibold tabular-nums text-[var(--text-primary)]" title={trackersBlocked.toLocaleString()}>{formatCount(trackersBlocked)}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t('summary.trackers')}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleBlockAll}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <BanIcon className="w-4 h-4" />
          {allBlocked ? t('block.disable_all') : t('block.enable_all')}
        </button>
      </section>

      <SettingsSection title={t('content.subtitle')} className="border border-[var(--border-color)]">
        <NavRow
          subpage="content"
          title={t('content.title')}
          description={t('content.nav_desc')}
          icon={<BanIcon className="w-5 h-5" />}
          iconColor="blue"
          meta={t('content.meta', { active: contentActive, total: ADS_CONTENT_SETTINGS.length })}
        />
      </SettingsSection>

      <SettingsSection title={t('sections.protection.title')} description={t('sections.protection.desc')} className="border border-[var(--border-color)]">
        <SettingRow
          id="block_feed_ads_api"
          title={t('rows.api.title')}
          description={t('rows.api.desc')}
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="blue"
        />
        <RowDivider />
        <SettingRow
          id="block_left_ads"
          title={t('rows.left.title')}
          description={t('rows.left.desc')}
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="blue"
        />
        <RowDivider />
        <SettingRow
          id="block_trackers"
          title={t('rows.trackers.title')}
          description={t('rows.trackers.desc')}
          icon={<TargetIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </SettingsSection>

      <SettingsSection title={t('sections.keywords.title')} description={t('sections.keywords.desc')} className="border border-[var(--border-color)]">
        <NavRow
          subpage="keywords"
          title={t('keywords.nav_title')}
          description={t('keywords.nav_desc')}
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="orange"
          meta={wordsCount > 0 ? t('keywords.meta', { count: wordsCount }) : undefined}
        />
        <RowDivider />
        <SettingRow
          id="block_feed_ads_dom"
          title={t('rows.dom.title')}
          description={t('rows.dom.desc')}
          icon={<ScissorsIcon className="w-5 h-5" />}
          iconColor="orange"
        />
        <p className="mx-4 mb-4 mt-1 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-xs leading-relaxed text-[var(--text-secondary)]">
          {t('sections.keywords.hint')}
        </p>
      </SettingsSection>

      <SettingsSection title={t('sections.activity.title')} className="border border-[var(--border-color)]">
        <NavRow
          subpage="stats"
          title={t('stats.nav_title')}
          description={t('stats.nav_desc')}
          icon={<ChartIcon className="w-5 h-5" />}
          iconColor="purple"
          meta={totalBlocked > 0 ? formatCount(totalBlocked) : undefined}
        />
      </SettingsSection>
    </div>
    </SubpageHost>
  );
}
