import React, { useCallback } from 'react';
import { usePerfTelemetry } from '@/popup/hooks/features/usePerfTelemetry.js';
import { useFeatureRegistry } from '@/popup/hooks/features/useFeatureRegistry.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useFeaturesByImpact, useFeatureEnabled, useSetting } from '@/popup/store/selectors.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { downloadText } from '@/shared/utils/download.js';
import SettingsSection from '../../ui/SettingsSection.js';
import Toggle from '../../ui/Toggle.js';
import MetricCards from './MetricCards.js';
import PerfCharts from './PerfCharts.js';
import FeatureExplorer from './FeatureExplorer.js';
import { StatisticsIcon, GraphIcon, ZapIcon, DownloadIcon, ResetIcon, WarningIcon, SpeedometerIcon } from '../../icons/Icons.js';

/**
 * Performance Dashboard — тело подстраницы внутри вкладки «Ещё».
 *
 * Поллит телеметрию раз в секунду (см. usePerfTelemetry), показывает живые
 * метрики, лёгкие графики и список активных фич с тогглами. Кнопки:
 *  • «Reset heavy» — выключает активные тяжёлые фичи;
 *  • «Export report» — выгружает JSON-снимок.
 *
 * Всё оформление — на CSS-переменных тем (var(--bg-*)/var(--text-*)) и
 * семантических tailwind-классах, поэтому работает в светлой и тёмной теме.
 */
export default function PerformanceDashboard(): React.ReactElement {
  const { snapshot, history, loading, error } = usePerfTelemetry(1000);
  const { summary } = useFeatureRegistry();
  // Узкие селекторы стора вместо useSettings(): экшены стабильны, а узкие
  // подписки не тянут ре-рендер на изменении посторонних настроек.
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const widgetOn = useFeatureEnabled('perf_widget');
  const widgetPositionSet = useSetting('perfWidgetPosition') != null;
  const handleResetWidgetPos = useCallback(async (): Promise<void> => {
    await saveSetting('perfWidgetPosition', null);
    showToast('Позиция мини-виджета сброшена', 'success');
  }, [saveSetting, showToast]);

  // «Тяжёлые» фичи берём из реестра (метадата стабильна), а не только из живого
  // снимка — так выключаются и heavy-фичи, включённые в настройках, но активные
  // на другой странице/вкладке. Фолбэк на снимок, пока реестр грузится.
  // `useFeaturesByImpact` сам подмешивает вкл/выкл-состояние из стора (shallow).
  const featureMeta = summary?.features ?? snapshot?.context.features ?? [];
  const { enabledIds: heavyEnabled } = useFeaturesByImpact(featureMeta, 'heavy');

  const handleResetHeavy = useCallback(async (): Promise<void> => {
    if (heavyEnabled.length === 0) {
      showToast('Включённых тяжёлых фич нет', 'info');
      return;
    }
    const off = Object.fromEntries(heavyEnabled.map((id) => [id, false]));
    const ok = await saveMultiple(off);
    showToast(ok ? `Выключено тяжёлых фич: ${heavyEnabled.length}` : 'Не удалось выключить', ok ? 'success' : 'error');
  }, [heavyEnabled, saveMultiple, showToast]);

  // Полный отчёт: метадата реестра + текущее состояние каждой фичи + живой снимок.
  const handleExport = useCallback((): void => {
    if (!snapshot) return;
    // Не подписываемся на settings ради разового снимка — читаем напрямую из стора.
    const settings = useVKifyStore.getState().settings;
    const featureStates = summary
      ? Object.fromEntries(summary.features.map((f) => [f.id, !!settings[f.id]]))
      : {};
    const report = {
      generatedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      registry: summary,
      featureStates,
      snapshot,
    };
    downloadText(
      JSON.stringify(report, null, 2),
      `vkify-perf-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    );
    showToast('Отчёт экспортирован', 'success');
  }, [snapshot, summary, showToast]);

  if (loading && !snapshot) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        {error ?? 'Телеметрия недоступна'}
      </div>
    );
  }

  const { context } = snapshot;

  return (
    <div className="space-y-4">
      {!context.available && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <WarningIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--text-secondary)]">
            Нет активной вкладки VK — метрики страницы недоступны. Открыт только
            мониторинг фонового процесса и popup. Откройте vk.com и обновите.
          </div>
        </div>
      )}

      <SettingsSection title="Метрики" icon={<StatisticsIcon className="w-5 h-5" />} iconColor="blue">
        <div className="px-4 pb-4">
          <MetricCards snapshot={snapshot} />
        </div>
      </SettingsSection>

      {/* Контролы — сразу под метриками, ДО (возможно длинного) списка фич, чтобы
          тумблер мини-виджета был виден без прокрутки всего «пласта» фич. */}
      <SettingsSection
        title="Мини-виджет"
        description="Плавающий монитор поверх vk.com"
        icon={<SpeedometerIcon className="w-5 h-5" />}
        iconColor="purple"
      >
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">Показывать мини-виджет</div>
              <div className="text-xs text-[var(--text-secondary)]">FPS, фичи, API, heap + sparkline</div>
            </div>
            <Toggle checked={widgetOn} onChange={(v) => void saveSetting('perf_widget', v)} />
          </div>

          <button
            onClick={handleResetWidgetPos}
            disabled={!widgetPositionSet}
            className="w-full py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            Сбросить позицию виджета
          </button>
        </div>
      </SettingsSection>

      {context.available && (
        <SettingsSection title="Графики" icon={<GraphIcon className="w-5 h-5" />} iconColor="cyan">
          <div className="px-4 pb-4">
            <PerfCharts
              history={history}
              pageLoad={context.pageLoad}
              apiCallsLastMin={context.apiCallsLastMin}
              observerSubs={context.observerSubs}
            />
          </div>
        </SettingsSection>
      )}

      {context.available && (
        <SettingsSection
          title="Фичи"
          description="Группировка по весу и категории · метадата из реестра"
          icon={<ZapIcon className="w-5 h-5" />}
          iconColor="orange"
        >
          <FeatureExplorer entries={summary?.features ?? []} live={context.features} />
        </SettingsSection>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleResetHeavy}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-red-500/30 text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          disabled={heavyEnabled.length === 0}
        >
          <ResetIcon className="w-4 h-4" />
          Reset heavy
          {heavyEnabled.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-600 rounded-full">
              {heavyEnabled.length}
            </span>
          )}
        </button>

        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <DownloadIcon className="w-4 h-4" />
          Export
        </button>
      </div>

      <p className="text-[10px] text-[var(--text-tertiary)] text-center px-4">
        «CPU per feature» оценивается как время инициализации + время DOM-колбэков
        фичи (execution-time прокси). Heap доступен только в Chromium.
      </p>
    </div>
  );
}
