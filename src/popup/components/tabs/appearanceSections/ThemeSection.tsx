import React, { memo, useState, useMemo, useCallback } from 'react';
import ThemeCard from '../../ui/ThemeCard.js';
import RangeSlider from '../../ui/RangeSlider.js';
import Toggle from '../../ui/Toggle.js';
import { PaletteIcon, ColorPickerIcon, ChevronDownIcon } from '../../icons/Icons.js';
import ResetButton from '../../ui/ResetButton.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useVKTheme } from '@/popup/hooks/features/useVKTheme.js';
import { THEMES, THEME_CATEGORIES } from '@/popup/constants/appearance.js';
import type { Theme } from '@/popup/constants/appearance.js';

const INITIAL_DISPLAY_COUNT = 8;

interface ThemeSectionProps {
  /** Рендер как тело отдельной страницы: без карточки-обёртки и шапки. */
  asPage?: boolean;
}

const ThemeSection = memo(function ThemeSection({ asPage = false }: ThemeSectionProps): React.ReactElement {
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);

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
  const customColorValue = (settings['custom_theme'] as string | undefined) || '#1e1e2e';

  const blockRows: { key: string; node: React.ReactNode }[] = [];

  if (isThemeActive) {
    blockRows.push({
      key: 'opacity',
      node: (
        <RangeSlider
          inline
          id="block_opacity"
          label="Прозрачность"
          value={opacityValue}
          min={0}
          max={100}
          step={5}
          unit="%"
          minLabel="0%"
          maxLabel="100%"
          description="Влияет на фон контента и разделители"
          onChange={handleOpacityChange}
        />
      ),
    });
    blockRows.push({
      key: 'depth',
      node: (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)]">Глубина</div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Тени и объём у блоков</div>
          </div>
          <Toggle
            checked={Boolean(settings['block_depth'])}
            onChange={(val) => { void saveSetting('block_depth', val); }}
          />
        </div>
      ),
    });
  }

  if (isTransparent) {
    blockRows.push({
      key: 'glass',
      node: (
        <RangeSlider
          inline
          id="glass_blur"
          label="Эффект стекла"
          value={glassValue}
          min={0}
          max={40}
          step={2}
          unit="px"
          minLabel="Выкл"
          maxLabel="40px"
          description="Размытие фона за полупрозрачными блоками"
          onChange={handleGlassChange}
        />
      ),
    });
  }

  blockRows.push({
    key: 'radius',
    node: (
      <RangeSlider
        inline
        id="theme_radius"
        label="Скругление"
        value={(settings['theme_radius'] as number | undefined) ?? 0}
        min={0}
        max={24}
        step={2}
        unit="px"
        minLabel="0px"
        maxLabel="24px"
        onChange={(value) => { void saveSetting('theme_radius', value); }}
      />
    ),
  });

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
      {!asPage && (
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
              <ResetButton onClick={reset} aria-label="Сбросить тему" />
            )}
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap gap-1.5 mb-4"
        role="tablist"
        aria-label="Категории тем"
      >
        {THEME_CATEGORIES.map((cat) => {
          const active = themeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              aria-pressed={active}
              className="transition-colors"
              style={{
                borderRadius: '20px',
                padding: '5px 11px',
                fontSize: '12px',
                background: active ? '#0077FF22' : 'transparent',
                border: `0.5px solid ${active ? '#0077FF' : 'rgba(255,255,255,0.1)'}`,
                color: active ? '#5b9cf6' : 'rgba(255,255,255,0.45)',
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

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
          aria-expanded={showAllThemes}
          className="w-full flex items-center justify-center gap-2 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: '8px',
            padding: '9px',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${showAllThemes ? 'rotate-180' : ''}`}
          />
          <span className="text-xs font-medium">
            {showAllThemes ? 'Скрыть' : `Показать ещё ${remainingCount}`}
          </span>
        </button>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          Свой цвет фона
        </div>
        <div className="relative">
          <input
            type="color"
            value={customColorValue}
            onChange={(e) => applyCustomColor(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className={`
              w-full h-11 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer transition-all
              ${isThemeActive ? 'border-primary' : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'}
            `}
            style={{ backgroundColor: isThemeActive ? customColorValue : 'var(--bg-secondary)' }}
          >
            <ColorPickerIcon
              className={`w-5 h-5 ${isThemeActive ? 'text-white' : 'text-[var(--text-secondary)]'}`}
            />
            <span className={`text-sm font-medium ${isThemeActive ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
              {isThemeActive ? customColorValue.toUpperCase() : 'Выбрать'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
        <div
          className="mb-3"
          style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)' }}
        >
          Блоки
        </div>
        <div>
          {blockRows.map((row, i) => (
            <div
              key={row.key}
              className="py-3 first:pt-0 last:pb-0"
              style={i < blockRows.length - 1 ? { borderBottom: '0.5px solid rgba(255,255,255,0.05)' } : undefined}
            >
              {row.node}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default ThemeSection;