import React from 'react';
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
    ? { label: 'Heap (worker)', value: formatBytes(background.heapUsedBytes), sub: `${background.alarms} alarms` }
    : {
        label: 'Worker',
        value: `${background.alarms} alarms`,
        sub: background.onlineSpyRunning || background.profileSpyRunning ? 'трекер активен' : 'в покое',
      };

  const cards: Card[] = [
    {
      label: 'Heap (страница)',
      value: formatBytes(context.heapUsedBytes),
      sub: context.heapLimitBytes ? `лимит ${formatBytes(context.heapLimitBytes)}` : 'Chromium only',
      accent: 'primary',
    },
    {
      label: 'Инициализация фич',
      value: formatMs(context.initTotalMs),
      sub: `${context.features.length} активно`,
      accent: 'success',
    },
    {
      label: 'Тяжёлые фичи',
      value: String(heavyActive),
      sub: heavyActive > 0 ? 'активны сейчас' : 'нет активных',
      accent: heavyActive > 0 ? 'danger' : 'success',
    },
    {
      label: 'API-вызовы / мин',
      value: String(apiLastMin),
      sub: `всего ${apiTotal} · стр+SW`,
      accent: apiLastMin > 30 ? 'warning' : 'primary',
    },
    {
      label: 'Стили',
      value: String(context.injectedStyles),
      sub: `${formatBytes(context.injectedCssBytes)} · ${context.cssMarkers} маркеров`,
    },
    {
      label: 'Скрипты',
      value: String(context.injectedScripts),
      sub: 'page-world',
    },
    {
      label: 'Observer-подписки',
      value: String(context.observerSubs),
      sub: `${context.mutationFlushes} флашей`,
      accent: context.observerSubs > 20 ? 'warning' : 'primary',
    },
    {
      label: 'Heap (popup)',
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
