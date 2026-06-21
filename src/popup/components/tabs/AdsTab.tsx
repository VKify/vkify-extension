import React from 'react';
import SettingRow from '../ui/SettingRow.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
import {
  BanIcon, ShieldIcon, SidebarIcon, FilterIcon,
  ChartIcon, ScissorsIcon, TargetIcon,
} from '../icons/Icons.js';
import { useAdsBlocking } from '../../hooks/features/useAdsBlocking.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useBlockStats } from './ads/useBlockStats.js';
import { formatCount } from './ads/format.js';
import AdsKeywordsPage from './ads/AdsKeywordsPage.js';
import AdsStatsPage from './ads/AdsStatsPage.js';

// ── Divider between SettingRows ────────────────────────────────────────────

function RowDivider(): React.ReactElement {
  return <div className="mx-3 border-t border-[var(--border-color)]" />;
}

const ADS_SUBPAGES: Subpage[] = [
  {
    id: 'keywords',
    title: 'Фильтр по словам',
    subtitle: 'Скрывать и показывать по словам',
    icon: <FilterIcon className="w-5 h-5" />,
    iconColor: 'red',
    anchors: ['custom_block_words', 'custom_allow_words'],
    render: () => <AdsKeywordsPage />,
  },
  {
    id: 'stats',
    title: 'Статистика и журнал',
    subtitle: 'Заблокировано за всё время',
    icon: <ChartIcon className="w-5 h-5" />,
    iconColor: 'purple',
    anchors: ['ads_stats'],
    render: () => <AdsStatsPage />,
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

export default function AdsTab(): React.ReactElement {
  const { allBlocked, handleBlockAll, activeCount, totalCount } = useAdsBlocking();
  const { settings } = useSettings();

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
    <SubpageHost subpages={ADS_SUBPAGES}>
    <div className="space-y-4">

      {/* ── Blocking section ─────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-[var(--border-color)] ${shieldBg}`}>
              <ShieldIcon className={`w-5 h-5 ${shieldColor}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Блокировка рекламы</h3>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {activeCount === 0
                  ? 'Все фильтры отключены'
                  : activeCount === totalCount
                    ? 'Все фильтры активны'
                    : `Активно ${activeCount} из ${totalCount} фильтров`}
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
            {allBlocked ? 'Отключить всё' : 'Включить всё'}
          </button>
        </div>

        <SettingRow
          id="block_left_ads"
          title="Боковая панель"
          description="Скрывает рекламные баннеры и виджеты в левой колонке"
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_api"
          title="Лента · фильтр API"
          description="Перехватывает рекламные посты на уровне сетевых запросов"
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <RowDivider />
        <SettingRow
          id="block_feed_ads_dom"
          title="Лента · фильтр DOM"
          description="Скрывает рекламные посты через CSS и анализ содержимого"
          icon={<ScissorsIcon className="w-5 h-5" />}
          iconColor="red"
        />

        {/* Фильтр по словам — отдельная страница, появляется при DOM-фильтре */}
        {domEnabled && (
          <>
            <RowDivider />
            <NavRow
              subpage="keywords"
              title="Фильтр по словам"
              description="Скрывать и показывать посты по словам"
              icon={<FilterIcon className="w-5 h-5" />}
              iconColor="orange"
              meta={wordsCount > 0 ? `${wordsCount} сл.` : undefined}
            />
          </>
        )}

        <RowDivider />
        <SettingRow
          id="block_trackers"
          title="Блокировка трекеров"
          description="Перехватывает аналитику, телеметрию и рекламные сети"
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
              ? 'Полная защита'
              : activeCount > 0
                ? 'Частичная защита'
                : 'Защита отключена'}
          </p>
          <p className={`text-[11px] opacity-70 ${shieldColor}`}>
            {activeCount === 0
              ? 'Включите фильтры выше'
              : activeCount === totalCount
                ? 'Все фильтры активны'
                : `Активно ${activeCount} из ${totalCount} фильтров`}
          </p>
        </div>
      </section>

      {/* ── Stats — отдельная страница ───────────────────────────────────── */}
      <SettingsSection>
        <NavRow
          subpage="stats"
          title="Статистика и журнал"
          description="Заблокировано за всё время"
          icon={<ChartIcon className="w-5 h-5" />}
          iconColor="purple"
          meta={totalBlocked > 0 ? formatCount(totalBlocked) : undefined}
        />
      </SettingsSection>

    </div>
    </SubpageHost>
  );
}
