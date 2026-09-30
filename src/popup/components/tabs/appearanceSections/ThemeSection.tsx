import React, { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeCard from '../../ui/ThemeCard.js';
import { useDebouncedCallback } from '@/popup/hooks/core/useDebouncedCallback.js';
import { previewColor } from '@/popup/utils/livePreview.js';
import { deriveAccentFromBg } from '@/popup/utils/themePalette.js';
import RangeSlider from '../../ui/RangeSlider.js';
import Toggle from '../../ui/Toggle.js';
import ColorPickerField from '../../ui/ColorPickerField.js';
import { PaletteIcon, ChevronDownIcon, DropletIcon, LayoutIcon } from '../../icons/Icons.js';
import { DashboardPanel } from '../../ui/DashboardPrimitives.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useVKTheme } from '@/popup/hooks/features/useVKTheme.js';
import { THEMES, THEME_CATEGORIES } from '@/popup/constants/appearance.js';
import type { Theme } from '@/popup/constants/appearance.js';

const INITIAL_DISPLAY_COUNT = 8;

const ThemeSection = memo(function ThemeSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);

  const {
    isPresetSelected,
    applyPreset,
    applyCustomColor,
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
  const storedColor = (settings['custom_theme'] as string | undefined) || '#1e1e2e';

  // Локальное зеркало цвета: свотч/значение обновляются мгновенно при движении
  // пипетки, а запись в storage (applyCustomColor → saveMultiple) дебаунсится,
  // чтобы контент-скрипт не перекрашивал тему на каждое промежуточное значение.
  const [localColor, setLocalColor] = useState(storedColor);
  useEffect(() => { setLocalColor(storedColor); }, [storedColor]);

  const debouncedApplyColor = useDebouncedCallback((color: string): void => {
    void applyCustomColor(color);
  }, 350);

  // Непрерывно во время перетаскивания: только мгновенный preview на странице,
  // БЕЗ setState — иначе ThemeSection перерисовывался бы на каждый кадр (лаги).
  // Под фон автоматически подбирается акцент (как в applyCustomColor при коммите),
  // поэтому превьюим И его — иначе акцент догонял бы фон с большой задержкой.
  const handleColorPreview = useCallback((color: string): void => {
    previewColor('custom_theme_preview', color);
    const accent = deriveAccentFromBg(color);
    if (accent) previewColor('custom_accent_preview', accent);
  }, []);

  // Фиксация (отпускание ползунка/ввод/пресет): обновляем свотч и пишем в storage.
  const handleColorCommit = useCallback((color: string): void => {
    setLocalColor(color);
    debouncedApplyColor(color);
  }, [debouncedApplyColor]);

  const customColorValue = localColor;

  const blockRows: { key: string; node: React.ReactNode }[] = [];

  if (isThemeActive) {
    blockRows.push({
      key: 'opacity',
      node: (
        <RangeSlider
          inline
          id="block_opacity"
          label={t('theme.opacity.label')}
          value={opacityValue}
          min={0}
          max={100}
          step={5}
          unit="%"
          minLabel="0%"
          maxLabel="100%"
          description={t('theme.opacity.desc')}
          onChange={handleOpacityChange}
        />
      ),
    });
    blockRows.push({
      key: 'depth',
      node: (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)]">{t('theme.depth.title')}</div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{t('theme.depth.desc')}</div>
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
          label={t('theme.glass.label')}
          value={glassValue}
          min={0}
          max={40}
          step={2}
          unit="px"
          minLabel={t('theme.glass.off')}
          maxLabel="40px"
          description={t('theme.glass.desc')}
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
        label={t('theme.radius.label')}
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

  return <div className="appearance-page-stack">
    <DashboardPanel title={t('items.theme.title')} description={t('items.theme.subtitle')}
      icon={<PaletteIcon className="h-5 w-5" />} className="pb-4">
      <div className="px-4">
      <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label={t('theme.categories_aria')}>
        {THEME_CATEGORIES.map((cat) => {
          const active = themeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${active
                ? 'border-primary/45 bg-primary/10 text-primary'
                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
            >
              {t(`categories.${cat.id}`, { defaultValue: cat.name })}
            </button>
          );
        })}
      </div>

      <div
        className="grid grid-cols-4 gap-2 mb-3"
        role="listbox"
        aria-label={t('theme.themes_aria')}
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
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2.5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${showAllThemes ? 'rotate-180' : ''}`}
          />
          <span className="text-xs font-medium">
            {showAllThemes ? t('theme.hide') : t('theme.show_more', { count: remainingCount })}
          </span>
        </button>
      )}
      </div>
    </DashboardPanel>

    <DashboardPanel title={t('theme.custom_bg')} icon={<DropletIcon className="h-5 w-5" />} className="pb-4">
      <div className="px-4">
        <ColorPickerField
          value={isThemeActive ? customColorValue : ''}
          onInput={handleColorPreview}
          onChange={handleColorCommit}
          variant="pill"
          ariaLabel={t('theme.custom_bg_aria')}
        />
      </div>
    </DashboardPanel>

    <DashboardPanel title={t('theme.blocks')} icon={<LayoutIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 max-[590px]:grid-cols-1">
        {blockRows.map((row) => <div key={row.key} className="appearance-control-card">{row.node}</div>)}
      </div>
    </DashboardPanel>
  </div>;
});

export default ThemeSection;
