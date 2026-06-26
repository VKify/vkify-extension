import React, { useState } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import ColorPicker from '../ui/ColorPicker.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import ResetButton from '../ui/ResetButton.js';
import SettingsSection, { SectionDivider } from '../ui/SettingsSection.js';
import { DropletIcon, ShareIcon, ChevronDownIcon, TypeIcon, ImageIcon, PaletteIcon, BookmarkIcon, FilterIcon, InfoIcon } from '../icons/Icons.js';

import DisplayModeSection from './appearanceSections/DisplayModeSection.js';
import ThemeSection from './appearanceSections/ThemeSection.js';
import FontSection from './appearanceSections/FontSection.js';
import VisualFiltersSection from './appearanceSections/VisualFiltersSection.js';
import BackgroundSection from './appearanceSections/BackgroundSection.js';
import ProfilesSection from './appearanceSections/ProfilesSection.js';
import ThemeResetButton from './appearanceSections/ThemeResetButton.js';
import ShareButton, { ShareParamsPreview } from './appearanceSections/ShareSection.js';

import { useVKTheme } from '../../hooks/features/useVKTheme.js';
import { useFont } from '../../hooks/features/useFont.js';
import { useBackground } from '../../hooks/features/useBackground.js';
import { useVisualFilters } from '../../hooks/features/useVisualFilters.js';

/**
 * Кнопки «Сбросить» для шапки подстраниц (`DetailPage.headerAction`). Каждая
 * читает состояние своей фичи и сама прячется, когда сбрасывать нечего — так
 * сброс везде стоит единообразно в topbar, как на странице «Тема».
 */
function AccentResetButton(): React.ReactElement | null {
  const customAccent = useSetting<string | undefined>('custom_accent');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  if (!customAccent) return null;
  return <ResetButton onClick={() => { void saveSetting('custom_accent', ''); }} aria-label="Сбросить акцентный цвет" />;
}

function FontResetButton(): React.ReactElement | null {
  const { hasChanges, reset } = useFont();
  if (!hasChanges) return null;
  return <ResetButton onClick={() => { void reset(); }} aria-label="Сбросить шрифт" />;
}

function BackgroundResetButton(): React.ReactElement | null {
  const { hasBackground, clearBackground } = useBackground();
  if (!hasBackground) return null;
  return <ResetButton onClick={() => { void clearBackground(); }} aria-label="Сбросить фон" />;
}

function FiltersResetButton(): React.ReactElement | null {
  const { hasActiveFilters, resetFilters } = useVisualFilters();
  if (!hasActiveFilters) return null;
  return <ResetButton onClick={() => { void resetFilters(); }} aria-label="Сбросить фильтры" />;
}

// Тяжёлые фичи «Вид» с большим числом опций — на отдельных страницах
// (SubpageHost → DetailPage), как Шаблоны/Музыка. Якорь живёт в теле
// подстраницы, поэтому Ctrl+K сам её открывает.
const SUBPAGES: Subpage[] = [
  {
    id: 'theme',
    title: 'Тема',
    subtitle: 'Пресеты, цвет, прозрачность',
    icon: <PaletteIcon className="w-5 h-5" />,
    iconColor: 'purple',
    anchors: ['custom_theme'],
    render: () => <div data-vkify-anchor="custom_theme"><ThemeSection asPage /></div>,
    headerAction: () => <ThemeResetButton />,
  },
  {
    id: 'profiles',
    title: 'Мои профили',
    subtitle: 'Сохранённые оформления',
    icon: <BookmarkIcon className="w-5 h-5" />,
    iconColor: 'orange',
    anchors: ['appearance_profiles'],
    render: () => <div data-vkify-anchor="appearance_profiles"><ProfilesSection asPage /></div>,
  },
  {
    id: 'font',
    title: 'Шрифт',
    subtitle: 'Семейство, размер, начертание',
    icon: <TypeIcon className="w-5 h-5" />,
    iconColor: 'blue',
    anchors: ['custom_font'],
    render: () => <div data-vkify-anchor="custom_font"><FontSection asPage /></div>,
    headerAction: () => <FontResetButton />,
  },
  {
    id: 'background',
    title: 'Фон',
    subtitle: 'Обои, видео, эффекты',
    icon: <ImageIcon className="w-5 h-5" />,
    iconColor: 'green',
    anchors: ['custom_background'],
    render: () => <div data-vkify-anchor="custom_background"><BackgroundSection asPage /></div>,
    headerAction: () => <BackgroundResetButton />,
  },
  {
    id: 'accent',
    title: 'Акцентный цвет',
    subtitle: 'Цвет акцентов интерфейса',
    icon: <DropletIcon className="w-5 h-5" />,
    iconColor: 'pink',
    anchors: ['custom_accent'],
    render: () => <div data-vkify-anchor="custom_accent"><AccentColorSection asPage /></div>,
    headerAction: () => <AccentResetButton />,
  },
  {
    id: 'filters',
    title: 'Визуальные фильтры',
    subtitle: 'Цвет, контраст, эффекты',
    icon: <FilterIcon className="w-5 h-5" />,
    iconColor: 'purple',
    anchors: ['visual_filters'],
    render: () => <div data-vkify-anchor="visual_filters"><VisualFiltersSection asPage /></div>,
    headerAction: () => <FiltersResetButton />,
  },
];

function AccentColorSection({ asPage = false }: { asPage?: boolean }): React.ReactElement {
  const customAccent = useSetting<string | undefined>('custom_accent');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { currentPreset } = useVKTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = asPage || isExpanded;

  const hasCustomAccent = Boolean(customAccent);
  const showThemeHint =
    currentPreset?.id !== 'default' &&
    currentPreset?.accent &&
    customAccent !== currentPreset?.accent;

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-1' : ''}`}>
      {!asPage && (
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
            <DropletIcon className="w-5 h-5 text-pink-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">Акцентный цвет</span>
            {hasCustomAccent && (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium" style={{ color: customAccent }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: customAccent }} />
                {customAccent?.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCustomAccent && (
            <ResetButton
              onClick={(e) => { e.stopPropagation(); void saveSetting('custom_accent', ''); }}
              aria-label="Сбросить акцентный цвет"
            />
          )}
          <div className={`w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center transition-all duration-300 group-hover:bg-[var(--bg-tertiary)] ${isExpanded ? 'rotate-180 bg-primary/10' : ''}`}>
            <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
          </div>
        </div>
      </button>
      )}

      <div className={asPage ? '' : `grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className={asPage ? '' : 'overflow-hidden'}>
          <div className="px-4 pb-4">
            <ColorPicker
              value={customAccent ?? ''}
              onChange={(color) => { void saveSetting('custom_accent', color); }}
            />

            {showThemeHint && currentPreset && (
              <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Рекомендуемый акцент для {currentPreset.name}:
                  <button
                    onClick={() => { void saveSetting('custom_accent', currentPreset.accent); }}
                    className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/50"
                      style={{ backgroundColor: currentPreset.accent }}
                      aria-hidden="true"
                    />
                    {currentPreset.accent}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AppearanceTab(): React.ReactElement {
  return (
    <SubpageHost subpages={SUBPAGES}>
    <div className="space-y-6">
      <div data-vkify-anchor="display_mode"><DisplayModeSection /></div>

      {/* 🎭 Оформление — тема, цвет, шрифт, фильтры, фон */}
      <SettingsSection
        title="Оформление"
        description="Тема, цвет, шрифт и фон"
        icon={<PaletteIcon className="w-5 h-5" />}
        iconColor="purple"
      >
        {/* «Тема» — ключевой блок, визуально выделен */}
        <div className="mx-2 mb-1 rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 to-transparent ring-1 ring-inset ring-primary/20">
          <NavRow
            subpage="theme"
            title="Тема"
            description="Пресеты, цвет, прозрачность"
            icon={<PaletteIcon className="w-5 h-5" />}
            iconColor="purple"
            badge="Основное"
          />
        </div>

        <NavRow
          subpage="accent"
          title="Акцентный цвет"
          description="Цвет акцентов интерфейса"
          icon={<DropletIcon className="w-5 h-5" />}
          iconColor="pink"
        />
        <SectionDivider />
        <NavRow
          subpage="font"
          title="Шрифт"
          description="Семейство, размер, начертание"
          icon={<TypeIcon className="w-5 h-5" />}
          iconColor="blue"
        />
        <SectionDivider />
        <NavRow
          subpage="filters"
          title="Визуальные фильтры"
          description="Цвет, контраст, эффекты"
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="purple"
        />
        <SectionDivider />
        <NavRow
          subpage="background"
          title="Фон"
          description="Обои, видео, эффекты"
          icon={<ImageIcon className="w-5 h-5" />}
          iconColor="green"
        />
      </SettingsSection>

      {/* Профили оформления + экспорт по ссылке */}
      <SettingsSection
        title="Профили"
        description="Сохранение и обмен оформлением"
        icon={<BookmarkIcon className="w-5 h-5" />}
        iconColor="orange"
      >
        <NavRow
          subpage="profiles"
          title="Мои профили"
          description="Сохранённые оформления"
          icon={<BookmarkIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </SettingsSection>

      <div data-vkify-anchor="share_theme">
        <SettingsSection
          title="Поделиться темой"
          description="Ссылка с вашим оформлением для друга"
          icon={<ShareIcon className="w-5 h-5" />}
          iconColor="blue"
        >
          <div className="px-4 pb-4">
            <div className="mb-3">
              <ShareParamsPreview />
            </div>
            <ShareButton />
          </div>
        </SettingsSection>
      </div>
    </div>
    </SubpageHost>
  );
}