import React, { memo, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import RangeSlider from '../../ui/RangeSlider.js';
import Modal from '../../ui/Modal.js';
import { XIcon, CheckIcon, SearchIcon, ChevronDownIcon, BoldIcon, ItalicIcon, UnderlineIcon, InfoIcon, ExternalLinkIcon, TypeIcon } from '../../icons/Icons.js';
import { useFont } from '../../../hooks/features/useFont.js';
import { FONTS, FONT_SIZE_PRESETS, FONT_CATEGORIES } from '../../../constants/appearance.js';
import type { Font } from '../../../constants/appearance.js';

const INITIAL_DISPLAY_COUNT = 9;
const GOOGLE_FONTS_API = 'https://fonts.googleapis.com/css2';
const POPUP_FONTS_LINK_ID = 'vkify-popup-fonts';

function buildGoogleFontsUrl(fonts: Font[]): string | null {
  const families = fonts
    .filter(f => f.google)
    .map(f => `family=${f.google ?? ''}`)
    .join('&');

  if (!families) return null;
  return `${GOOGLE_FONTS_API}?${families}&display=swap`;
}

function useFontPreloader(fonts: Font[]): void {
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const fontsWithGoogle = fonts.filter(f => f.google);
    if (fontsWithGoogle.length === 0) return;

    const url = buildGoogleFontsUrl(fontsWithGoogle);
    if (!url) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.id = POPUP_FONTS_LINK_ID;

    const existing = document.getElementById(POPUP_FONTS_LINK_ID);
    if (existing) existing.remove();

    document.head.appendChild(link);

    return () => {
      const linkToRemove = document.getElementById(POPUP_FONTS_LINK_ID);
      if (linkToRemove) linkToRemove.remove();
    };
  }, [fonts]);
}

function getFontFamilyForPreview(font: Font): string {
  if (!font) return 'inherit';
  if (font.id === 'default') return 'inherit';
  if (font.id === 'system') return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (font.value) return font.value;

  const fallback = font.serif ? 'serif' : font.mono ? 'monospace' : 'sans-serif';
  return `"${font.name}", ${fallback}`;
}

interface FontHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FontHelpModal = memo(function FontHelpModal({ isOpen, onClose }: FontHelpModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <Modal
      ariaLabel="Как добавить свой шрифт"
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span>📚</span>
          Как добавить свой шрифт
        </span>
      }
    >
        <div className="p-4 space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              Через Google Fonts
            </h4>

            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>
                  Откройте{' '}
                  <a
                    href="https://fonts.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    fonts.google.com
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Выберите <b>Language → Cyrillic</b> для русских шрифтов</span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Скопируйте название шрифта</span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Вставьте в формате: <code className="bg-[var(--bg-secondary)] px-1 rounded">&quot;Название&quot;, sans-serif</code></span>
              </p>
            </div>

            <div className="mt-3 p-2.5 bg-[var(--bg-secondary)] rounded-xl">
              <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1.5">Примеры:</p>
              <div className="space-y-1">
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;Roboto&quot;, sans-serif</code>
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;Playfair Display&quot;, serif</code>
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;JetBrains Mono&quot;, monospace</code>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              Системные шрифты
            </h4>

            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Эти шрифты уже есть на компьютере:
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: 'Arial', value: 'Arial, sans-serif' },
                { name: 'Verdana', value: 'Verdana, sans-serif' },
                { name: 'Georgia', value: 'Georgia, serif' },
                { name: 'Times New Roman', value: '"Times New Roman", serif' },
              ].map(font => (
                <div
                  key={font.name}
                  className="p-2 bg-[var(--bg-secondary)] rounded-lg"
                >
                  <p className="text-xs font-medium text-[var(--text-primary)]" style={{ fontFamily: font.value }}>
                    {font.name}
                  </p>
                  <code className="text-[9px] text-[var(--text-tertiary)] break-all">{font.value}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
            <h4 className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
              <span>💡</span>
              Советы
            </h4>
            <ul className="text-[11px] text-[var(--text-secondary)] space-y-1">
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Названия с пробелами — в кавычках</span>
              </li>
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Добавляйте fallback: <code className="bg-[var(--bg-secondary)] px-1 rounded">sans-serif</code></span>
              </li>
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Выбирайте шрифты с кириллицей</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
              <span>🔗</span>
              Где искать
            </h4>
            <div className="space-y-1.5">
              {[
                { name: 'Google Fonts', url: 'https://fonts.google.com', desc: 'Бесплатно, огромный выбор' },
                { name: 'Font Squirrel', url: 'https://www.fontsquirrel.com', desc: 'Бесплатные шрифты' },
              ].map(site => (
                <a
                  key={site.name}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-[var(--text-primary)] group-hover:text-primary">
                      {site.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{site.desc}</p>
                  </div>
                  <ExternalLinkIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>
        </div>
    </Modal>
  );
});

interface FontStyleControlsProps {
  fontWeight: number;
  isItalic: boolean;
  isUnderline: boolean;
  textTransform: string;
  onWeightChange: (weight: number) => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
  onTransformChange: (value: string) => void;
}

const FontStyleControls = memo(function FontStyleControls({
  fontWeight,
  isItalic,
  isUnderline,
  textTransform,
  onWeightChange,
  onItalicToggle,
  onUnderlineToggle,
  onTransformChange,
}: FontStyleControlsProps): React.ReactElement {
  const weights = [
    { value: 300, label: 'Свет' },
    { value: 400, label: 'Обыч' },
    { value: 500, label: 'Средн' },
    { value: 600, label: 'Полу' },
    { value: 700, label: 'Жирн' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          Насыщенность
        </label>
        <div className="flex gap-1">
          {weights.map((w) => (
            <button
              key={w.value}
              onClick={() => onWeightChange(w.value)}
              className={`
                flex-1 py-1.5 text-xs rounded-lg transition-all
                ${fontWeight === w.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
              `}
              style={{ fontWeight: w.value }}
              title={w.label}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onItalicToggle}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all
            ${isItalic
              ? 'bg-primary text-white shadow-sm'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
          `}
          title="Курсив"
        >
          <ItalicIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Курсив</span>
        </button>

        <button
          onClick={onUnderlineToggle}
          className={`
            flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all
            ${isUnderline
              ? 'bg-primary text-white shadow-sm'
              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
          `}
          title="Подчёркивание"
        >
          <UnderlineIcon className="w-4 h-4" />
          <span className="text-xs font-medium">Подчёрк.</span>
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
          Регистр
        </label>
        <div className="flex gap-1">
          {[
            { value: 'none', label: 'Обыч.', display: 'Обыч.', title: 'Обычный' },
            { value: 'uppercase', label: 'ВЕРХ', display: 'ВЕРХ', title: 'ВЕРХНИЙ' },
            { value: 'lowercase', label: 'нижн', display: 'нижн', title: 'нижний' },
            { value: 'capitalize', label: 'Каж.', display: 'Каж.', title: 'Каждое Слово' },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => onTransformChange(t.value)}
              className={`
                flex-1 py-1.5 text-xs font-medium rounded-lg transition-all
                ${textTransform === t.value
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
              `}
              title={t.title}
            >
              {t.display}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

interface FontCardProps {
  font: Font;
  isSelected: boolean;
  onSelect: () => void;
}

const FontCard = memo(function FontCard({ font, isSelected, onSelect }: FontCardProps): React.ReactElement {
  const previewText = font.decorative ? 'Aa' : 'Привет';
  const fontFamily = getFontFamilyForPreview(font);

  return (
    <button
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`
        relative flex flex-col rounded-xl overflow-hidden transition-all duration-200
        hover:scale-[1.03] active:scale-[0.97]
        ${isSelected
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-primary)] shadow-md shadow-primary/15'
          : 'ring-1 ring-[var(--border-color)] hover:ring-primary/40 hover:shadow-sm'}
      `}
    >
      <div className="h-14 flex items-center justify-center px-2 bg-[var(--bg-secondary)]">
        <span
          className={`text-[var(--text-primary)] ${font.mono ? 'text-sm' : font.decorative ? 'text-xl' : 'text-lg'}`}
          style={{ fontFamily }}
        >
          {previewText}
        </span>
      </div>

      <div className="px-2 py-1.5 bg-[var(--bg-primary)] border-t border-[var(--border-color)]">
        <span className="text-[10px] font-medium text-[var(--text-primary)] truncate block leading-tight">
          {font.name}
        </span>
      </div>

      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}

      <div className="absolute top-1 left-1 flex gap-0.5">
        {font.popular && (
          <span className="px-1 py-0.5 bg-yellow-500/15 text-yellow-600 border border-yellow-500/20 rounded text-[8px] font-semibold leading-none">★</span>
        )}
        {font.mono && (
          <span className="px-1 py-0.5 bg-purple-500/15 text-purple-600 border border-purple-500/20 rounded text-[8px] font-semibold leading-none">M</span>
        )}
        {font.serif && !font.mono && (
          <span className="px-1 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/20 rounded text-[8px] font-semibold leading-none">S</span>
        )}
      </div>
    </button>
  );
});

const FontSection = memo(function FontSection(): React.ReactElement {
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

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
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
            <button
              onClick={(e) => { e.stopPropagation(); void reset(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 rounded-lg transition-colors active:scale-95"
            >
              <XIcon className="w-3.5 h-3.5" />
              Сбросить
            </button>
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

      <div className={`grid transition-all duration-300 ease-out ${isSectionExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
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

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-0.5 px-0.5">
              {FONT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`
                    flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200
                    ${activeCategory === cat.id
                      ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}
                  `}
                >
                  <span className="text-[11px]">{cat.icon}</span>
                  <span>{cat.name}</span>
                  {fontCounts[cat.id] !== undefined && (
                    <span className={`text-[10px] ${activeCategory === cat.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>
                      {fontCounts[cat.id]}
                    </span>
                  )}
                </button>
              ))}
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
                className="w-full py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors"
              >
                {showAllFonts ? 'Скрыть' : `Показать ещё ${remainingCount}`}
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
                    <svg
                      className={`w-3.5 h-3.5 transition-colors ${showAdvanced ? 'text-blue-500' : 'text-[var(--text-secondary)]'}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <line x1="3" y1="12" x2="21" y2="12"/>
                      <line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
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