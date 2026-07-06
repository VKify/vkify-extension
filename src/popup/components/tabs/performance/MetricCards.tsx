import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PerfSnapshot } from '@/shared/constants/perf.js';
import { formatBytes, formatMs } from './format.js';

interface MetricCardsProps {
  snapshot: PerfSnapshot;
}

interface Card {
  label: string;
  value: string;
  sub?: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
}

const ACCENT_CLASS: Record<NonNullable<Card['accent']>, string> = {
  primary: 'text-primary',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger:  'text-red-600',
};

/** Сетка живых стат-карточек (паттерн из ActivityChart). */
export default function MetricCards({ snapshot }: MetricCardsProps): React.ReactElement {
  const { t } = useTranslation('perf');
  const { context, background, popup } = snapshot;

  // API-вызовы суммируем по обоим контекстам: страница (content) + service
  // worker (спай/профиль-поллеры, запросы попапа) — иначе при простое content
  // карточка всегда 0, хотя фоновые поллеры реально дёргают VK API.
  const apiLastMin = context.apiCallsLastMin + background.apiCallsLastMin;
  const apiTotal = context.apiCalls + background.apiCalls;

  // Сколько активных фич — тяжёлые. Подсвечиваем красным, если есть: это первый
  // кандидат на «Reset heavy» при просадках.
  const heavyActive = context.features.filter((f) => f.impact === 'heavy').length;

  // performance.memory недоступен в service worker'е (Chrome) — показываем не
  // «н/д», а реальные SW-метрики: число alarms и состояние трекеров.
  const workerCard: Card = background.heapUsedBytes
    ? { label: t('cards.heapWorker'), value: formatBytes(background.heapUsedBytes), sub: t('cards.alarms', { count: background.alarms }) }
    : {
        label: t('cards.worker'),
        value: t('cards.alarms', { count: background.alarms }),
        sub: background.onlineSpyRunning || background.profileSpyRunning ? t('cards.trackerActive') : t('cards.trackerIdle'),
      };

  const cards: Card[] = [
    {
      label: t('cards.heapPage'),
      value: formatBytes(context.heapUsedBytes),
      sub: context.heapLimitBytes ? t('cards.heapLimit', { size: formatBytes(context.heapLimitBytes) }) : t('cards.chromiumOnly'),
      accent: 'primary',
    },
    {
      label: t('cards.featureInit'),
      value: formatMs(context.initTotalMs),
      sub: t('cards.featureInitSub', { count: context.features.length }),
      accent: 'success',
    },
    {
      label: t('cards.heavyFeatures'),
      value: String(heavyActive),
      sub: heavyActive > 0 ? t('cards.heavyActive') : t('cards.heavyNone'),
      accent: heavyActive > 0 ? 'danger' : 'success',
    },
    {
      label: t('cards.apiPerMin'),
      value: String(apiLastMin),
      sub: t('cards.apiTotalSub', { total: apiTotal }),
      accent: apiLastMin > 30 ? 'warning' : 'primary',
    },
    {
      label: t('cards.styles'),
      value: String(context.injectedStyles),
      sub: t('cards.stylesSub', { size: formatBytes(context.injectedCssBytes), count: context.cssMarkers }),
    },
    {
      label: t('cards.scripts'),
      value: String(context.injectedScripts),
      sub: t('cards.scriptsSub'),
    },
    {
      label: t('cards.observerSubs'),
      value: String(context.observerSubs),
      sub: t('cards.observerSubsSub', { count: context.mutationFlushes }),
      accent: context.observerSubs > 20 ? 'warning' : 'primary',
    },
    {
      label: t('cards.heapPopup'),
      value: formatBytes(popup.heapUsedBytes),
    },
    workerCard,
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div key={c.label} className="p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="text-[11px] text-[var(--text-tertiary)] mb-1 leading-tight">{c.label}</div>
          <div className={`text-lg font-bold leading-none ${c.accent ? ACCENT_CLASS[c.accent] : 'text-[var(--text-primary)]'}`}>
            {c.value}
          </div>
          {c.sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-1 leading-tight">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
