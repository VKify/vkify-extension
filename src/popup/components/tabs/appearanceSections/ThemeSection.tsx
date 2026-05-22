import React, { memo, useState, useMemo, useCallback } from 'react';
import ThemeCard from '../../ui/ThemeCard.js';
import RangeSlider from '../../ui/RangeSlider.js';
import { XIcon, PaletteIcon } from '../../icons/Icons.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useVKTheme } from '../../../hooks/features/useVKTheme.js';
import { THEMES, THEME_CATEGORIES } from '../../../constants/appearance.js';
import type { Theme } from '../../../constants/appearance.js';

const INITIAL_DISPLAY_COUNT = 8;

const ThemeSection = memo(function ThemeSection(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const {
    currentPreset,
    isCustomColor,
    hasChanges,
    isPresetSelected,
    applyPreset,
    applyCustomColor,
    reset
  } = useVKTheme();

  const [themeCategory, setThemeCategory] = useState('all');
  const [showAllThemes, setShowAllThemes] = useState(false);

  const filteredThemes = useMemo<Theme[]>(() => {
    if (themeCategory === 'all') return [...THEMES];
    return [...THEMES].filter(t => t.category === themeCategory || t.id === 'default');
  }, [themeCategory]);

  const displayedThemes = useMemo<Theme[]>(() => {
    return showAllThemes ? filteredThemes : filteredThemes.slice(0, INITIAL_DISPLAY_COUNT);
  }, [filteredThemes, showAllThemes]);

  const remainingCount = filteredThemes.length - INITIAL_DISPLAY_COUNT;

  const handleCategoryChange = useCallback((categoryId: string): void => {
    setThemeCategory(categoryId);
    setShowAllThemes(false);
  }, []);

  const handleToggleShowAll = useCallback((): void => {
    setShowAllThemes(prev => !prev);
  }, []);

  const handleOpacityChange = useCallback((value: number): void => {
    void saveSetting('block_opacity', value / 100);
  }, [saveSetting]);

  const opacityValue = useMemo<number>(() => {
    const raw = settings['block_opacity'];
    if (typeof raw !== 'number') return 100;
    return Math.round(raw * 100);
  }, [settings]);

  const handleGlassChange = useCallback((value: number): void => {
    void saveSetting('glass_blur', value);
  }, [saveSetting]);

  const glassValue = useMemo<number>(() => {
    return typeof settings['glass_blur'] === 'number' ? (settings['glass_blur'] as number) : 0;
  }, [settings]);

  const isThemeActive = Boolean(settings['custom_theme']);
  const isTransparent = isThemeActive && opacityValue < 100;

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <PaletteIcon className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Тема</h3>
            {(currentPreset?.id !== 'default' || isCustomColor) && (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-violet-500">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                {isCustomColor ? 'Свой цвет' : currentPreset?.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {Boolean(settings['custom_theme']) && (
            <div
              className="w-5 h-5 rounded-lg border-2 border-white/20 shadow-sm ring-1 ring-[var(--border-color)]"
              style={{ backgroundColor: settings['custom_theme'] as string }}
              aria-label={`Текущий цвет: ${settings['custom_theme'] as string}`}
            />
          )}
          {hasChanges && (
            <button
              onClick={reset}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-error bg-[var(--bg-secondary)] hover:bg-error/10 rounded-lg transition-colors"
              aria-label="Сбросить тему"
            >
              <XIcon className="w-3 h-3" />
              Сбросить
            </button>
          )}
        </div>
      </div>

      <nav
        className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl mb-4 overflow-x-auto scrollbar-hide"
        aria-label="Категории тем"
      >
        {THEME_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            aria-pressed={themeCategory === cat.id}
            className={`
              flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
              ${themeCategory === cat.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
            `}
          >
            <span aria-hidden="true">{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </nav>

      <div
        className="grid grid-cols-4 gap-2 mb-3"
        role="listbox"
        aria-label="Доступные темы"
      >
        {displayedThemes.filter(t => t?.id).map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isSelected={isPresetSelected(theme)}
            onSelect={() => applyPreset(theme)}
          />
        ))}
      </div>

      {remainingCount > 0 && (
        <button
          onClick={handleToggleShowAll}
          className="w-full py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors"
          aria-expanded={showAllThemes}
        >
          {showAllThemes ? 'Скрыть' : `Показать ещё ${remainingCount}`}
        </button>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          Свой цвет фона
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="color"
              value={(settings['custom_theme'] as string | undefined) || '#1e1e2e'}
              onChange={(e) => applyCustomColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className={`
                w-full h-11 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-all
                ${isThemeActive
                  ? 'border-[var(--text-primary)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'}
              `}
              style={{ backgroundColor: isThemeActive ? (settings['custom_theme'] as string) : 'var(--bg-secondary)' }}
            >
              <svg
                className={`w-5 h-5 ${isThemeActive ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span className={`text-sm font-medium ${isThemeActive ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                {isThemeActive ? (settings['custom_theme'] as string)?.toUpperCase() : 'Выбрать'}
              </span>
            </div>
          </div>
          {hasChanges && (
            <button
              onClick={reset}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-error/10 hover:text-error transition-colors"
              title="Сбросить"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isThemeActive && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <RangeSlider
            id="block_opacity"
            label="Прозрачность блоков"
            value={opacityValue}
            min={0}
            max={100}
            step={5}
            unit="%"
            zeroLabel="Полностью прозрачные"
            onChange={handleOpacityChange}
          />
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Влияет на фон контента и разделители
          </p>
        </div>
      )}

      {isTransparent && (
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <RangeSlider
            id="glass_blur"
            label="Эффект стекла"
            value={glassValue}
            min={0}
            max={40}
            step={2}
            unit="px"
            zeroLabel="Выключен"
            onChange={handleGlassChange}
          />
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
            Размытие фона за полупрозрачными блоками
          </p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <RangeSlider
          id="theme_radius"
          label="Скругление блоков"
          value={(settings['theme_radius'] as number | undefined) ?? 0}
          min={0}
          max={24}
          step={2}
          unit="px"
          zeroLabel="По умолчанию"
          onChange={(value) => { void saveSetting('theme_radius', value); }}
        />
      </div>
    </section>
  );
});

export default ThemeSection;