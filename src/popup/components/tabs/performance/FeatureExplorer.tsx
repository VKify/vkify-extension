import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/popup/i18n.js';
import type { FeatureRegistryEntry, FeaturePerf, FeatureImpact } from '@/shared/constants/perf.js';
import Toggle from '../../ui/Toggle.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useFeatureEnabled } from '@/popup/store/selectors.js';
import { formatMs, IMPACT_BADGE, impactLabel, IMPACT_ORDER, categoryLabel } from './format.js';
import { ChevronDownIcon } from '../../icons/Icons.js';

/** Локализованное имя фичи: оверрайд из реестра Ctrl+K (functions ns), RU-фолбэк. */
function localizedFeatureName(id: string, fallback: string): string {
  return i18n.t(`functions:${id}.title`, { defaultValue: fallback });
}

type GroupMode = 'impact' | 'category';

interface FeatureExplorerProps {
  /** Метадата всех зарегистрированных фич (из FeatureRegistry). */
  entries: FeatureRegistryEntry[];
  /** Живые метрики активных фич (из снимка телеметрии) — мёржатся по id. */
  live: FeaturePerf[];
}

/** Фича + живые метрики/состояние (после мёржа метадаты и снимка). */
interface MergedFeature extends FeatureRegistryEntry {
  active: boolean;
  initMs: number;
  runtimeMs: number;
}

const IMPACT_GROUP_ORDER: FeatureImpact[] = ['heavy', 'medium', 'light'];

/**
 * Грид-explorer всех зарегистрированных фич с группировкой по весу (impact) или
 * категории. Для каждой фичи: бейдж impact, категория, зависимости, init order,
 * живые init/runtime (если активна) и тоггл. Метадата приходит из FeatureRegistry
 * (через GET_FEATURE_REGISTRY_SUMMARY), рантайм — из снимка телеметрии.
 */
export default function FeatureExplorer({ entries, live }: FeatureExplorerProps): React.ReactElement {
  const { t } = useTranslation('perf');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const [mode, setMode] = useState<GroupMode>('impact');

  const merged = useMemo<MergedFeature[]>(() => {
    const liveById = new Map(live.map((f) => [f.id, f]));
    return entries.map((e) => {
      const l = liveById.get(e.id);
      return {
        ...e,
        active: !!l,
        initMs: l?.initMs ?? 0,
        runtimeMs: l?.runtimeMs ?? 0,
      };
    });
  }, [entries, live]);

  // Группировка: ключ группы → фичи. Внутри группы: активные сверху, затем по
  // runtime ↓, затем по initOrder, затем по имени (детерминированно).
  const groups = useMemo(() => {
    const byKey = new Map<string, MergedFeature[]>();
    for (const f of merged) {
      const key = mode === 'impact' ? f.impact : f.category;
      const arr = byKey.get(key) ?? [];
      arr.push(f);
      byKey.set(key, arr);
    }
    for (const arr of byKey.values()) {
      arr.sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          b.runtimeMs - a.runtimeMs ||
          a.initOrder - b.initOrder ||
          a.name.localeCompare(b.name),
      );
    }
    const keys = [...byKey.keys()];
    keys.sort((a, b) =>
      mode === 'impact'
        ? IMPACT_ORDER[a as FeatureImpact] - IMPACT_ORDER[b as FeatureImpact]
        : categoryLabel(a).localeCompare(categoryLabel(b)),
    );
    return keys.map((key) => ({ key, items: byKey.get(key)! }));
  }, [merged, mode]);

  // По умолчанию раскрыты группы, где есть активные фичи; смена режима сбрасывает.
  const [open, setOpen] = useState<Set<string>>(new Set());
  React.useEffect(() => {
    setOpen(new Set(groups.filter((g) => g.items.some((f) => f.active)).map((g) => g.key)));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGroup = (key: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
        {t('explorer.registryUnavailable')}
      </div>
    );
  }

  const groupTitle = (key: string): string =>
    mode === 'impact' ? impactLabel(key as FeatureImpact) : categoryLabel(key);

  return (
    <div>
      {/* Сегментированный переключатель режима группировки. */}
      <div className="flex gap-1 px-4 pb-3">
        {(['impact', 'category'] as GroupMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              mode === m
                ? 'bg-primary text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {m === 'impact' ? t('explorer.byImpact') : t('explorer.byCategory')}
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--border-color)]">
        {groups.map(({ key, items }) => {
          const activeCount = items.filter((f) => f.active).length;
          const isOpen = open.has(key);
          return (
            <div key={key} className="border-b border-[var(--border-color)]">
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <ChevronDownIcon
                  className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                {mode === 'impact' ? (
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ${IMPACT_BADGE[key as FeatureImpact]}`}>
                    {impactLabel(key as FeatureImpact)}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-[var(--text-primary)]">{groupTitle(key)}</span>
                )}
                <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">
                  {activeCount > 0 && <span className="text-green-600 font-semibold">{t('explorer.active', { count: activeCount })}</span>}
                  {activeCount > 0 && ' · '}
                  {items.length}
                </span>
              </button>

              {isOpen && (
                <div className="divide-y divide-[var(--border-color)]">
                  {items.map((f) => (
                    <FeatureRow
                      key={f.id}
                      feature={f}
                      showCategory={mode === 'impact'}
                      onToggle={(v) => void saveSetting(f.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FeatureRowProps {
  feature: MergedFeature;
  showCategory: boolean;
  onToggle: (v: boolean) => void;
}

function FeatureRow({ feature: f, showCategory, onToggle }: FeatureRowProps): React.ReactElement {
  const { t } = useTranslation('perf');
  // Узкая подписка на состояние своей фичи: тоггл одной фичи ре-рендерит только
  // её ряд, а не весь explorer (важно — список может быть длинным).
  const checked = useFeatureEnabled(f.id);
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${f.active ? 'bg-green-500/[0.04]' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">{localizedFeatureName(f.id, f.name)}</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded ${IMPACT_BADGE[f.impact]}`}>
            {impactLabel(f.impact)}
          </span>
          {showCategory && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]">
              {categoryLabel(f.category)}
            </span>
          )}
          {f.requiresDomLayer && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-[var(--bg-secondary)] text-[var(--text-tertiary)]" title={t('explorer.domLayer')}>
              DOM
            </span>
          )}
        </div>

        <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
          {t('explorer.initOrder', { order: f.initOrder })}
          {f.active && <> · init {formatMs(f.initMs)} · runtime {formatMs(f.runtimeMs)}</>}
        </div>

        {f.dependencies.length > 0 && (
          <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            {t('explorer.depends')} <span className="text-[var(--text-secondary)]">{f.dependencies.join(', ')}</span>
          </div>
        )}
      </div>

      <Toggle size="small" checked={checked} onChange={onToggle} />
    </div>
  );
}
