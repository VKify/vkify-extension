import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import ColorPicker from '../ui/ColorPicker.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
import { XIcon, DropletIcon, ShareIcon, ChevronDownIcon, TypeIcon, ImageIcon, PaletteIcon, BookmarkIcon, FilterIcon } from '../icons/Icons.js';

import DisplayModeSection from './appearanceSections/DisplayModeSection.js';
import ThemeSection from './appearanceSections/ThemeSection.js';
import FontSection from './appearanceSections/FontSection.js';
import VisualFiltersSection from './appearanceSections/VisualFiltersSection.js';
import BackgroundSection from './appearanceSections/BackgroundSection.js';
import ProfilesSection from './appearanceSections/ProfilesSection.js';
import ShareButton, { ShareParamsPreview } from './appearanceSections/ShareSection.js';

import { useVKTheme } from '../../hooks/features/useVKTheme.js';

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
  },
  {
    id: 'background',
    title: 'Фон',
    subtitle: 'Обои, видео, эффекты',
    icon: <ImageIcon className="w-5 h-5" />,
    iconColor: 'green',
    anchors: ['custom_background'],
    render: () => <div data-vkify-anchor="custom_background"><BackgroundSection asPage /></div>,
  },
  {
    id: 'accent',
    title: 'Акцентный цвет',
    subtitle: 'Цвет акцентов интерфейса',
    icon: <DropletIcon className="w-5 h-5" />,
    iconColor: 'pink',
    anchors: ['custom_accent'],
    render: () => <div data-vkify-anchor="custom_accent"><AccentColorSection asPage /></div>,
  },
  {
    id: 'filters',
    title: 'Визуальные фильтры',
    subtitle: 'Цвет, контраст, эффекты',
    icon: <FilterIcon className="w-5 h-5" />,
    iconColor: 'purple',
    anchors: ['visual_filters'],
    render: () => <div data-vkify-anchor="visual_filters"><VisualFiltersSection asPage /></div>,
  },
];

function AccentColorSection({ asPage = false }: { asPage?: boolean }): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const { currentPreset } = useVKTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = asPage || isExpanded;

  const hasCustomAccent = Boolean(settings['custom_accent']);
  const showThemeHint =
    currentPreset?.id !== 'default' &&
    currentPreset?.accent &&
    settings['custom_accent'] !== currentPreset?.accent;

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-1' : ''}`}>
      {asPage && hasCustomAccent && (
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={() => { void saveSetting('custom_accent', ''); }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-error bg-[var(--bg-secondary)] hover:bg-error/10 rounded-lg transition-colors"
            aria-label="Сбросить акцентный цвет"
          >
            <XIcon className="w-3 h-3" />
            Сбросить
          </button>
        </div>
      )}
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
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium" style={{ color: settings['custom_accent'] as string }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: settings['custom_accent'] as string }} />
                {(settings['custom_accent'] as string)?.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCustomAccent && (
            <button
              onClick={(e) => { e.stopPropagation(); void saveSetting('custom_accent', ''); }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-error bg-[var(--bg-secondary)] hover:bg-error/10 rounded-lg transition-colors"
              aria-label="Сбросить акцентный цвет"
            >
              <XIcon className="w-3 h-3" />
              Сбросить
            </button>
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
              value={(settings['custom_accent'] as string | undefined) ?? ''}
              onChange={(color) => { void saveSetting('custom_accent', color); }}
            />

            {showThemeHint && currentPreset && (
              <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                <span className="text-xs" aria-hidden="true">💡</span>
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
    <div className="space-y-4">
      <div data-vkify-anchor="display_mode"><DisplayModeSection /></div>

      <SettingsSection>
        <NavRow
          subpage="theme"
          title="Тема"
          description="Пресеты, цвет, прозрачность"
          icon={<PaletteIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </SettingsSection>

      <SettingsSection>
        <NavRow
          subpage="accent"
          title="Акцентный цвет"
          description="Цвет акцентов интерфейса"
          icon={<DropletIcon className="w-5 h-5" />}
          iconColor="pink"
        />
      </SettingsSection>

      <SettingsSection>
        <NavRow
          subpage="font"
          title="Шрифт"
          description="Семейство, размер, начертание"
          icon={<TypeIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </SettingsSection>

      <SettingsSection>
        <NavRow
          subpage="filters"
          title="Визуальные фильтры"
          description="Цвет, контраст, эффекты"
          icon={<FilterIcon className="w-5 h-5" />}
          iconColor="purple"
        />
      </SettingsSection>

      <SettingsSection>
        <NavRow
          subpage="background"
          title="Фон"
          description="Обои, видео, эффекты"
          icon={<ImageIcon className="w-5 h-5" />}
          iconColor="green"
        />
      </SettingsSection>

      <SettingsSection>
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