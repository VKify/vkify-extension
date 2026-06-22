import React, { memo, useState, useMemo, useCallback } from 'react';
import RangeSlider from '../../ui/RangeSlider.js';
import ResetButton from '../../ui/ResetButton.js';
import { XIcon, CheckIcon, SearchIcon, ChevronDownIcon, BoldIcon, InfoIcon, TypeIcon, FormatIcon } from '../../icons/Icons.js';
import { useFont } from '../../../hooks/features/useFont.js';
import { FONTS, FONT_SIZE_PRESETS, FONT_CATEGORIES } from '../../../constants/appearance.js';
import type { Font } from '../../../constants/appearance.js';
import FontHelpModal from './font/FontHelpModal.js';
import FontStyleControls from './font/FontStyleControls.js';
import FontCard from './font/FontCard.js';
import { INITIAL_DISPLAY_COUNT, useFontPreloader } from './font/helpers.js';

interface FontSectionProps {
  /** Рендер как тело отдельной страницы: без сворачиваемой карточки и шапки. */
  asPage?: boolean;
}

const FontSection = memo(function FontSection({ asPage = false }: FontSectionProps): React.ReactElement {
  const {
    currentFont,
    currentFontValue,
    currentFontSize,
    currentLineHeight,
    currentLetterSpacing,
    currentFontWeight,
    currentFontStyle,
    currentTextDecoration,
    currentTextTransform,
    isCustomFont,
    hasChanges,
    isFontSelected,
    applyFont,
    applyCustomFont,
    setFontSize,
    setLineHeight,
    setLetterSpacing,
    setFontWeight,
    setFontStyle,
    setTextDecoration,
    setTextTransform,
    reset,
  } = useFont();

  const [isSectionExpanded, setIsSectionExpanded] = useState(false);
  const [showAllFonts, setShowAllFonts] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStyleSettings, setShowStyleSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [customFontInput, setCustomFontInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useFontPreloader(FONTS as Font[]);

  const fontCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = { all: FONTS.length };

    FONT_CATEGORIES.forEach(cat => {
      if (cat.id === 'all') return;

      switch (cat.id) {
        case 'popular': counts[cat.id] = FONTS.filter(f => f.popular).length; break;
        case 'modern': counts[cat.id] = FONTS.filter(f => f.category === 'modern').length; break;
        case 'classic': counts[cat.id] = FONTS.filter(f => f.category === 'classic').length; break;
        case 'stylish': counts[cat.id] = FONTS.filter(f => f.stylish || f.category === 'stylish').length; break;
        case 'serif': counts[cat.id] = FONTS.filter(f => f.serif).length; break;
        case 'mono': counts[cat.id] = FONTS.filter(f => f.mono).length; break;
        case 'cyrillic': counts[cat.id] = FONTS.filter(f => f.category === 'cyrillic').length; break;
        case 'readable': counts[cat.id] = FONTS.filter(f => f.category === 'readable').length; break;
        case 'geometric': counts[cat.id] = FONTS.filter(f => f.category === 'geometric').length; break;
        case 'system': counts[cat.id] = FONTS.filter(f => f.category === 'system').length; break;
        default: counts[cat.id] = 0;
      }
    });

    return counts;
  }, []);

  const filteredFonts = useMemo<Font[]>(() => {
    let fonts: Font[] = [...FONTS];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      fonts = fonts.filter(f => f.name.toLowerCase().includes(query) || f.id.toLowerCase().includes(query));
    }

    switch (activeCategory) {
      case 'popular': return fonts.filter(f => f.popular);
      case 'modern': return fonts.filter(f => f.category === 'modern');
      case 'classic': return fonts.filter(f => f.category === 'classic');
      case 'stylish': return fonts.filter(f => f.stylish || f.category === 'stylish');
      case 'serif': return fonts.filter(f => f.serif);
      case 'mono': return fonts.filter(f => f.mono);
      case 'cyrillic': return fonts.filter(f => f.category === 'cyrillic');
      case 'readable': return fonts.filter(f => f.category === 'readable');
      case 'geometric': return fonts.filter(f => f.category === 'geometric');
      case 'system': return fonts.filter(f => f.category === 'system');
      default: return fonts;
    }
  }, [activeCategory, searchQuery]);

  const displayedFonts = useMemo<Font[]>(() => {
    if (showAllFonts || searchQuery.trim()) return filteredFonts;
    return filteredFonts.slice(0, INITIAL_DISPLAY_COUNT);
  }, [filteredFonts, showAllFonts, searchQuery]);

  const remainingCount = Math.max(0, filteredFonts.length - INITIAL_DISPLAY_COUNT);

  const activeSizePreset = useMemo<string | null>(() => {
    return FONT_SIZE_PRESETS.find(p => p.value === currentFontSize)?.id ?? null;
  }, [currentFontSize]);

  const hasStyleChanges =
    currentFontWeight !== 400 ||
    currentFontStyle === 'italic' ||
    currentTextDecoration === 'underline' ||
    (currentTextTransform && currentTextTransform !== 'none');

  const handleCategoryChange = useCallback((catId: string): void => {
    setActiveCategory(catId);
    setShowAllFonts(false);
  }, []);

  const expanded = asPage || isSectionExpanded;

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}>
      {!asPage && (
      <button
        onClick={() => setIsSectionExpanded(prev => !prev)}
        aria-expanded={isSectionExpanded}
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <TypeIcon className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">Шрифт</span>
            {(currentFont?.id !== 'default' || isCustomFont) && (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-blue-500">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                {isCustomFont ? 'Свой шрифт' : currentFont?.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <ResetButton onClick={(e) => { e.stopPropagation(); void reset(); }} />
          )}
          <div className={`
            w-8 h-8 rounded-lg bg-[var(--bg-secondary)]
            flex items-center justify-center
            transition-all duration-300
            group-hover:bg-[var(--bg-tertiary)]
            ${isSectionExpanded ? 'rotate-180 bg-primary/10' : ''}
          `}>
            <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isSectionExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
          </div>
        </div>
      </button>
      )}

      <div className={asPage ? '' : `grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className={asPage ? '' : 'overflow-hidden'}>
          <div className="px-3 pb-3 space-y-3">

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Найти шрифт..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-primary text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                >
                  <XIcon className="w-3 h-3 text-[var(--text-tertiary)]" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Категории шрифтов">
              {FONT_CATEGORIES.map((cat) => {
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    aria-pressed={active}
                    className="flex items-center gap-1 transition-colors"
                    style={{
                      borderRadius: '20px',
                      padding: '5px 11px',
                      fontSize: '12px',
                      background: active ? '#0077FF22' : 'transparent',
                      border: `0.5px solid ${active ? '#0077FF' : 'rgba(255,255,255,0.1)'}`,
                      color: active ? '#5b9cf6' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    <span>{cat.name}</span>
                    {fontCounts[cat.id] !== undefined && (
                      <span style={{ fontSize: '10px', opacity: 0.6 }}>{fontCounts[cat.id]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {displayedFonts.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {displayedFonts.map((font) => (
                  <FontCard
                    key={font.id}
                    font={font}
                    isSelected={isFontSelected(font)}
                    onSelect={() => { void applyFont(font); }}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-[var(--bg-secondary)] rounded-xl">
                <p className="text-sm text-[var(--text-tertiary)]">Шрифты не найдены</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Сбросить фильтры
                </button>
              </div>
            )}

            {!searchQuery && remainingCount > 0 && (
              <button
                onClick={() => setShowAllFonts(prev => !prev)}
                aria-expanded={showAllFonts}
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
                  className={`w-4 h-4 transition-transform ${showAllFonts ? 'rotate-180' : ''}`}
                />
                <span className="text-xs font-medium">
                  {showAllFonts ? 'Скрыть' : `Показать ещё ${remainingCount}`}
                </span>
              </button>
            )}

            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Свой шрифт</span>
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                >
                  <InfoIcon className="w-3.5 h-3.5" />
                  Как найти?
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customFontInput}
                  onChange={(e) => setCustomFontInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customFontInput.trim()) {
                      void applyCustomFont(customFontInput.trim());
                    }
                  }}
                  placeholder='"Roboto", sans-serif'
                  className="flex-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-primary text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] font-mono transition-colors"
                />
                <button
                  onClick={() => {
                    if (customFontInput.trim()) {
                      void applyCustomFont(customFontInput.trim());
                      setCustomFontInput('');
                    }
                  }}
                  disabled={!customFontInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  OK
                </button>
              </div>
              {isCustomFont && currentFontValue && (
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono truncate flex items-center gap-1">
                  <CheckIcon className="w-3 h-3 text-blue-500 flex-shrink-0" />
                  {currentFontValue}
                </p>
              )}
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowStyleSettings(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showStyleSettings ? 'bg-blue-500/10' : 'bg-[var(--bg-primary)]'}`}>
                    <BoldIcon className={`w-3.5 h-3.5 transition-colors ${showStyleSettings ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`} />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Стиль шрифта</span>
                  {hasStyleChanges && (
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${showStyleSettings ? 'rotate-180 text-blue-500' : ''}`} />
              </button>

              {showStyleSettings && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border-color)]">
                  <FontStyleControls
                    fontWeight={currentFontWeight ?? 400}
                    isItalic={currentFontStyle === 'italic'}
                    isUnderline={currentTextDecoration === 'underline'}
                    textTransform={currentTextTransform ?? 'none'}
                    onWeightChange={(w) => { void setFontWeight(w); }}
                    onItalicToggle={() => { void setFontStyle(currentFontStyle === 'italic' ? 'normal' : 'italic'); }}
                    onUnderlineToggle={() => { void setTextDecoration(currentTextDecoration === 'underline' ? 'none' : 'underline'); }}
                    onTransformChange={(t) => { void setTextTransform(t); }}
                  />
                </div>
              )}
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-3 space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)] block">Размер текста</span>
              <div className="flex gap-1">
                {FONT_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => { void setFontSize(preset.value); }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all min-w-0
                      ${activeSizePreset === preset.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <RangeSlider
                id="custom_font_size"
                label="Точная настройка"
                value={currentFontSize}
                min={0}
                max={25}
                step={1}
                unit="px"
                zeroLabel="По умолчанию"
                onChange={(v) => { void setFontSize(v); }}
              />
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAdvanced(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showAdvanced ? 'bg-blue-500/10' : 'bg-[var(--bg-primary)]'}`}>
                    <FormatIcon
                      className={`w-3.5 h-3.5 transition-colors ${showAdvanced ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`}
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">Настройки интервалов</span>
                </div>
                <ChevronDownIcon className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200 ${showAdvanced ? 'rotate-180 text-blue-500' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border-color)] space-y-4">
                  <RangeSlider
                    id="custom_line_height"
                    label="Межстрочный интервал"
                    value={currentLineHeight}
                    min={-20}
                    max={50}
                    step={5}
                    unit="%"
                    zeroLabel="По умолчанию"
                    onChange={(v) => { void setLineHeight(v); }}
                  />

                  <RangeSlider
                    id="custom_letter_spacing"
                    label="Межбуквенный интервал"
                    value={currentLetterSpacing}
                    min={-2}
                    max={5}
                    step={0.5}
                    unit="px"
                    zeroLabel="По умолчанию"
                    onChange={(v) => { void setLetterSpacing(v); }}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      <FontHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </section>
  );
});

export default FontSection;
