import React from 'react';
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

  const adsSubpages: Subpage[] = [
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

  // Feature flags
  const domEnabled = settings['block_feed_ads_dom'] === true;

  const blockWords = (settings['custom_block_words'] as string[]) ?? [];
  const allowWords = (settings['custom_allow_words'] as string[]) ?? [];
  const wordsCount = blockWords.length + allowWords.length;

  const shieldColor = activeCount === totalCount ? 'text-emerald-500' : activeCount > 0 ? 'text-primary' : 'text-[var(--text-tertiary)]';
  const shieldBg    = activeCount === totalCount ? 'bg-emerald-500/10' : activeCount > 0 ? 'bg-primary/10' : 'bg-[var(--bg-secondary)]';

  return (
    <SubpageHost subpages={adsSubpages}>
    <div className="space-y-4">

      {/* ── Blocking section ─────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-[var(--border-color)] ${shieldBg}`}>
              <ShieldIcon className={`w-5 h-5 ${shieldColor}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('block.section')}</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {activeCount === 0
                  ? t('block.all_off')
                  : activeCount === totalCount
                    ? t('block.all_on')
                    : t('block.active_of_total', { active: activeCount, total: totalCount })}
              </p>
            </div>
          </div>
          <button
            onClick={handleBlockAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-95 ${
              allBlocked ? 'text-error hover:bg-error/5' : 'text-success hover:bg-success/5'
            }`}
          >
            <BanIcon className="w-3.5 h-3.5" />
            {allBlocked ? t('block.disable_all') : t('block.enable_all')}
          </button>
        </div>

        <SettingRow
          id="block_left_ads"
          title={t('rows.left.title')}
          description={t('rows.left.desc')}
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_api"
          title={t('rows.api.title')}
          description={t('rows.api.desc')}
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_dom"
          title={t('rows.dom.title')}
          description={t('rows.dom.desc')}
          icon={<ScissorsIcon className="w-5 h-5" />}
          iconColor="red"
        />

        {/* Фильтр по словам — отдельная страница, появляется при DOM-фильтре */}
        {domEnabled && (
          <>
            <RowDivider />
            <NavRow
              subpage="keywords"
              title={t('keywords.nav_title')}
              description={t('keywords.nav_desc')}
              icon={<FilterIcon className="w-5 h-5" />}
              iconColor="orange"
              meta={wordsCount > 0 ? t('keywords.meta', { count: wordsCount }) : undefined}
            />
          </>
        )}

        <RowDivider />
        <SettingRow
          id="block_trackers"
          title={t('rows.trackers.title')}
          description={t('rows.trackers.desc')}
          icon={<TargetIcon className="w-5 h-5" />}
          iconColor="red"
        />
      </section>

      {/* ── Status banner ────────────────────────────────────────────────── */}
      <section className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
        activeCount === totalCount
          ? 'bg-emerald-500/10'
          : activeCount > 0
            ? 'bg-primary/10'
            : 'bg-[var(--bg-secondary)]'
      }`}>
        <ShieldIcon className={`w-5 h-5 flex-shrink-0 ${shieldColor}`} />
        <div>
          <p className={`text-sm font-semibold ${shieldColor}`}>
            {activeCount === totalCount
              ? t('banner.full')
              : activeCount > 0
                ? t('banner.partial')
                : t('banner.off')}
          </p>
          <p className={`text-[11px] opacity-70 ${shieldColor}`}>
            {activeCount === 0
              ? t('banner.enable_hint')
              : activeCount === totalCount
                ? t('block.all_on')
                : t('block.active_of_total', { active: activeCount, total: totalCount })}
          </p>
        </div>
      </section>

      {/* ── Stats — отдельная страница ───────────────────────────────────── */}
      <SettingsSection>
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
