import React, { memo, useCallback, useMemo } from 'react';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { BUILTIN_PRESETS, type SettingsPreset } from '@/shared/constants/presets.js';
import {
  buildPresetApplyPatch, buildPresetDisablePatch, isPresetActive,
} from '@/popup/utils/presets.js';
import { SparklesIcon, CheckIcon } from '../../icons/Icons.js';

/**
 * Встроенные пресеты — курируемые наборы настроек «одной кнопкой»
 * (данные в shared/constants/presets.ts, версионируются с кодом).
 *
 * Применение/выключение — patch-логика в popup/utils/presets.ts:
 * `replacesAppearance` сбрасывает только видовые ключи (theme-scope из
 * settings-schema — тот же набор, что у шаринга тем), приватность/automation/spy
 * не трогаются; «Отключить» возвращает затронутые ключи к дефолтам.
 */

interface PresetsSectionProps {
  /** Рендер как тело отдельной страницы (SubpageHost/DetailPage). */
  asPage?: boolean;
}

const PresetsSection = memo(function PresetsSection({ asPage = false }: PresetsSectionProps): React.ReactElement {
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const activeIds = useMemo(
    () => new Set(BUILTIN_PRESETS.filter((p) => isPresetActive(p, settings)).map((p) => p.id)),
    [settings],
  );

  const applyPreset = useCallback(async (preset: SettingsPreset): Promise<void> => {
    await saveMultiple(buildPresetApplyPatch(preset));
    showToast(`Пресет «${preset.name}» применён`, 'success');
  }, [saveMultiple, showToast]);

  const disablePreset = useCallback(async (preset: SettingsPreset): Promise<void> => {
    await saveMultiple(buildPresetDisablePatch(preset));
    showToast(`Пресет «${preset.name}» выключен`, 'success');
  }, [saveMultiple, showToast]);

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}>
      <div className="px-4 pb-4 pt-2 space-y-2">
        <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
          Готовые наборы настроек. Пресет «Минимализм» заменяет текущее оформление
          (приватность и скрипты не трогает) — сохраните его в «Мои профили»,
          если хотите вернуться. «Отключить» возвращает настройки пресета к дефолтам.
        </p>

        {BUILTIN_PRESETS.map((preset) => {
          const isActive = activeIds.has(preset.id);
          const paramCount = Object.keys(preset.settings).length;
          return (
            <div
              key={preset.id}
              className={`rounded-xl border transition-all ${
                isActive
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
              }`}
            >
              <div className="flex items-center gap-2.5 p-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="w-4.5 h-4.5 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{preset.name}</span>
                    {isActive && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-primary bg-primary/10 rounded-md">
                        <CheckIcon className="w-2.5 h-2.5" />
                        Применён
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] block leading-snug">
                    {preset.description} · {paramCount} парам.
                  </span>
                </div>

                {isActive ? (
                  <button
                    onClick={() => { void disablePreset(preset); }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
                  >
                    Отключить
                  </button>
                ) : (
                  <button
                    onClick={() => { void applyPreset(preset); }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-all active:scale-95"
                  >
                    Применить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

export default PresetsSection;
