import React, { lazy, Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import ColorPicker from '../ui/ColorPicker.js';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import ResetButton from '../ui/ResetButton.js';
import { DashboardHero, DashboardHeroImage, DashboardNavItem, DashboardPanel } from '../ui/DashboardPrimitives.js';
import { ClockIcon, DropletIcon, ShareIcon, TypeIcon, ImageIcon, PaletteIcon, BookmarkIcon, FilterIcon, InfoIcon, SparklesIcon, LayoutIcon } from '../icons/Icons.js';

import DisplayModeSection from './appearanceSections/DisplayModeSection.js';
import ThemeResetButton from './appearanceSections/ThemeResetButton.js';
import ShareButton, { ShareParamsPreview } from './appearanceSections/ShareSection.js';
// Мелкие секции оставляем статикой: собственный чанк для ~1–2 KB кода — почти
// чистый оверхед (хуже сжатие + boilerplate), выгоды в парсинге нет.
import VisualFiltersSection from './appearanceSections/VisualFiltersSection.js';
import PresetsSection from './appearanceSections/PresetsSection.js';

// Тяжёлые секции «Вида» открываются только как подстраницы (SubpageHost →
// render() по клику), поэтому грузим их лениво — каждая едет отдельным чанком и
// не попадает в чанк вкладки. Открытие самой вкладки «Вид» парсит лишь каркас со
// списком NavRow, а не все секции сразу. DisplayMode/Share/мелкие секции —
// статикой (всегда видны в базовом списке либо слишком малы для отдельного чанка).
const ClockSection = lazy(() => import('./appearanceSections/clock/ClockSection.js'));
const ThemeSection = lazy(() => import('./appearanceSections/ThemeSection.js'));
const FontSection = lazy(() => import('./appearanceSections/FontSection.js'));
const BackgroundSection = lazy(() => import('./appearanceSections/BackgroundSection.js'));
const ProfilesSection = lazy(() => import('./appearanceSections/ProfilesSection.js'));

// Граница ленивой загрузки секции: ненавязчивый плейсхолдер, пока едет чанк.
// Литеральный data-vkify-anchor остаётся на внешнем <div> в самих render() —
// чтобы Ctrl+K-прокрутка и статический тест functions-anchors его находили.
function Lazy({ children }: { children: React.ReactNode }): React.ReactElement {
  return <Suspense fallback={<div className="min-h-[320px]" />}>{children}</Suspense>;
}

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
  const { t } = useTranslation('appearance');
  const customAccent = useSetting<string | undefined>('custom_accent');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  if (!customAccent) return null;
  return <ResetButton onClick={() => { void saveSetting('custom_accent', ''); }} aria-label={t('reset.accent')} />;
}

function FontResetButton(): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const { hasChanges, reset } = useFont();
  if (!hasChanges) return null;
  return <ResetButton onClick={() => { void reset(); }} aria-label={t('reset.font')} />;
}

function BackgroundResetButton(): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const { hasBackground, clearBackground } = useBackground();
  if (!hasBackground) return null;
  return <ResetButton onClick={() => { void clearBackground(); }} aria-label={t('reset.background')} />;
}

function FiltersResetButton(): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const { hasActiveFilters, resetFilters } = useVisualFilters();
  if (!hasActiveFilters) return null;
  return <ResetButton onClick={() => { void resetFilters(); }} aria-label={t('reset.filters')} />;
}

function AccentColorSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const customAccent = useSetting<string | undefined>('custom_accent');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { currentPreset } = useVKTheme();
  const showThemeHint =
    currentPreset?.id !== 'default' &&
    currentPreset?.accent &&
    customAccent !== currentPreset?.accent;

  return (
    <section className="dashboard-panel py-4">
          <div className="px-4">
            <ColorPicker
              value={customAccent ?? ''}
              onChange={(color) => { void saveSetting('custom_accent', color); }}
            />

            {showThemeHint && currentPreset && (
              <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                <InfoIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  {t('accent.recommended', { name: currentPreset.name })}
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
    </section>
  );
}

type AppearanceGroup = 'style' | 'layout' | 'profiles';
interface AppearancePage extends Subpage { docsId: string; group: AppearanceGroup }
const APPEARANCE_ORDER = ['theme', 'accent', 'font', 'background', 'filters', 'layout', 'clock', 'profiles', 'presets', 'share'];

function AppearanceOverview({ pages }: { pages: readonly AppearancePage[] }): React.ReactElement {
  const { t } = useTranslation('appearance');
  const { open } = useSubpageNav();
  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('dashboard.title')} subtitle={t('dashboard.subtitle')}
      description={t('dashboard.description')}
      artwork={<DashboardHeroImage src="/assets/dashboard/appearance-hero.png" />} />
    {([
      { id: 'style' as const, title: t('style.section'), description: t('style.section_desc'), icon: <PaletteIcon className="h-5 w-5" /> },
      { id: 'layout' as const, title: t('display.layout.section'), description: t('display.layout.section_desc'), icon: <LayoutIcon className="h-5 w-5" /> },
      { id: 'profiles' as const, title: t('profiles_group.section'), description: t('profiles_group.section_desc'), icon: <BookmarkIcon className="h-5 w-5" /> },
    ]).map(group => <DashboardPanel key={group.id} title={group.title} description={group.description}
      icon={group.icon} className="pb-4">
        <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
          {pages.filter(page => page.group === group.id)
            .sort((a, b) => APPEARANCE_ORDER.indexOf(a.id) - APPEARANCE_ORDER.indexOf(b.id))
            .map(page => <DashboardNavItem key={page.id}
            title={page.title} description={page.subtitle ?? ''} icon={page.icon} docsId={page.docsId}
            onClick={() => open(page.id)} />)}
        </div>
      </DashboardPanel>)}
  </div>;
}

export default function AppearanceTab(): React.ReactElement {
  const { t } = useTranslation('appearance');

  // Тяжёлые фичи «Вид» с большим числом опций — на отдельных страницах
  // (SubpageHost → DetailPage), как Шаблоны/Музыка. Якорь живёт в теле
  // подстраницы, поэтому Ctrl+K сам её открывает.
  const subpages = useMemo<AppearancePage[]>(() => [
    {
      id: 'layout', docsId: 'display_mode', group: 'layout', title: t('display.layout.section'),
      subtitle: t('display.layout.section_desc'), icon: <LayoutIcon className="w-5 h-5" />,
      iconColor: 'cyan', anchors: ['display_mode'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="display_mode"><DisplayModeSection /></div>,
    },
    {
      id: 'theme',
      docsId: 'custom_theme',
      group: 'style',
      title: t('items.theme.title'),
      subtitle: t('items.theme.subtitle'),
      icon: <PaletteIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['custom_theme'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="custom_theme"><Lazy><ThemeSection /></Lazy></div>,
      headerAction: () => <ThemeResetButton />,
    },
    {
      id: 'profiles',
      docsId: 'appearance_profiles',
      group: 'profiles',
      title: t('items.profiles.title'),
      subtitle: t('items.profiles.subtitle'),
      icon: <BookmarkIcon className="w-5 h-5" />,
      iconColor: 'orange',
      anchors: ['appearance_profiles'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="appearance_profiles"><Lazy><ProfilesSection asPage /></Lazy></div>,
    },
    {
      id: 'presets',
      docsId: 'builtin_presets',
      group: 'profiles',
      title: t('items.presets.title'),
      subtitle: t('items.presets.subtitle'),
      icon: <SparklesIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['builtin_presets'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="builtin_presets"><PresetsSection /></div>,
    },
    {
      id: 'font',
      docsId: 'custom_font',
      group: 'style',
      title: t('items.font.title'),
      subtitle: t('items.font.subtitle'),
      icon: <TypeIcon className="w-5 h-5" />,
      iconColor: 'blue',
      anchors: ['custom_font'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="custom_font"><Lazy><FontSection asPage /></Lazy></div>,
      headerAction: () => <FontResetButton />,
    },
    {
      id: 'background',
      docsId: 'custom_background',
      group: 'style',
      title: t('items.background.title'),
      subtitle: t('items.background.subtitle'),
      icon: <ImageIcon className="w-5 h-5" />,
      iconColor: 'green',
      anchors: ['custom_background'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="custom_background"><Lazy><BackgroundSection /></Lazy></div>,
      headerAction: () => <BackgroundResetButton />,
    },
    {
      id: 'clock', docsId: 'clock_enabled', group: 'layout', title: t('clock.title'), subtitle: t('clock.description'),
      icon: <ClockIcon className="w-5 h-5" />, iconColor: 'blue',
      anchors: ['clock_enabled'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="clock_enabled"><Lazy><ClockSection /></Lazy></div>,
    },
    {
      id: 'accent',
      docsId: 'custom_accent',
      group: 'style',
      title: t('items.accent.title'),
      subtitle: t('items.accent.subtitle'),
      icon: <DropletIcon className="w-5 h-5" />,
      iconColor: 'pink',
      anchors: ['custom_accent'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="custom_accent"><AccentColorSection /></div>,
      headerAction: () => <AccentResetButton />,
    },
    {
      id: 'filters',
      docsId: 'visual_filters',
      group: 'style',
      title: t('items.filters.title'),
      subtitle: t('items.filters.subtitle'),
      icon: <FilterIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['visual_filters'],
      render: () => <div className="appearance-subpage" data-vkify-anchor="visual_filters"><VisualFiltersSection asPage /></div>,
      headerAction: () => <FiltersResetButton />,
    },
    {
      id: 'share', docsId: 'share_theme', group: 'profiles', title: t('share.section'), subtitle: t('share.section_desc'),
      icon: <ShareIcon className="w-5 h-5" />, iconColor: 'blue', anchors: ['share_theme'],
      render: () => <div className="appearance-subpage"><section className="dashboard-panel py-4">
        <div className="px-4" data-vkify-anchor="share_theme"><ShareParamsPreview /><div className="mt-3"><ShareButton /></div></div>
      </section></div>,
    },
  ], [t]);

  return (
    <SubpageHost subpages={subpages}><AppearanceOverview pages={subpages} /></SubpageHost>
  );
}
