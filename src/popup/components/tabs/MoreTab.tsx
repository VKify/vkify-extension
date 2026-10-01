import { IS_FIREFOX } from '@/shared/constants/browser.js';
import ExtensionUpdatePanel from './more/ExtensionUpdatePanel.js';
import './more/MoreTab.css';
import React, { useState, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import DiagnosticsModal from '../modals/DiagnosticsModal.js';
import ActionCard from '../ui/ActionCard.js';
import LinkButton from '../ui/LinkButton.js';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import DocsLink from '../ui/DocsLink.js';
import { DashboardHero, DashboardHeroArtwork, DashboardPanel, DashboardNavItem } from '../ui/DashboardPrimitives.js';
import SettingRow from '../ui/SettingRow.js';
// Дашборд производительности (PerformanceDashboard + PerfCharts + FeatureExplorer)
// — тяжёлый и открывается редко, только как подстраница. Грузим его лениво
// отдельным чанком: открытие вкладки «Ещё» больше не парсит весь дашборд.
const PerformanceDashboard = lazy(() => import('./performance/PerformanceDashboard.js'));
import LanguagePage from './more/LanguagePage.js';
import {
  DownloadIcon, UploadIcon, ResetIcon, VKifyLogo,
  GitHubIcon, TelegramIcon, VKIcon, HeartIcon, GlobeIcon,
  ZapIcon, DatabaseIcon, RefreshIcon, ExternalLinkIcon,
  SpeedometerIcon, StatisticsIcon, LayoutRowsIcon,
} from '../icons/Icons.js';
import { useDataManagement } from '../../hooks/features/useDataManagement.js';
import { useApiMethod } from '../../hooks/features/useApiMethod.js';
import { SOCIAL_LINKS, WEBSITE_URL } from '../../constants/links.js';
import { SITE_HOST } from '@/shared/constants/site.js';
import { openTab } from '../../utils/tabs.js';
import TelegramNotificationsSection from './more/TelegramNotificationsSection.js';

type LinkIconId = 'telegram' | 'vk' | 'github' | 'donate';

const LINK_ICONS: Record<LinkIconId, React.ComponentType<{ className?: string }>> = {
  telegram: TelegramIcon,
  vk: VKIcon,
  github: GitHubIcon,
  donate: HeartIcon,
};

export default function MoreTab(): React.ReactElement {
  const { t } = useTranslation(['settings', 'common']);
  const {
    fileInputRef,
    handleExport,
    handleImportClick,
    handleFileChange,
    handleReset,
  } = useDataManagement();

  const { apiMethod, loading: apiLoading, refresh: refreshApiMethod } = useApiMethod();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const openLink = (url: string): void => { openTab(url); };

  // Performance Dashboard живёт отдельной подстраницей (паттерн SubpageHost):
  // вкладка «Ещё» уже плотная, а дашборду нужен весь экран попапа.
  const perfSubpage: Subpage = {
    id: 'performance',
    title: t('more.performance.page_title'),
    subtitle: t('more.performance.page_subtitle'),
    icon: <SpeedometerIcon className="w-5 h-5" />,
    iconColor: 'blue',
    anchors: ['performance_dashboard'],
    render: () => (
      <div data-vkify-anchor="performance_dashboard">
        <Suspense fallback={<div className="min-h-[320px]" />}>
          <PerformanceDashboard />
        </Suspense>
      </div>
    ),
  };

  // Выбор языка интерфейса — отдельная подстраница по тому же паттерну.
  const languageSubpage: Subpage = {
    id: 'language',
    title: t('language.page_title'),
    subtitle: t('language.page_subtitle'),
    icon: <GlobeIcon className="w-5 h-5" />,
    iconColor: 'blue',
    anchors: ['language'],
    render: () => <LanguagePage />,
  };

  return (
    <SubpageHost subpages={[perfSubpage, languageSubpage]}>
    <div className="more-dashboard space-y-4 pb-4">
      <DashboardHero
        title={t('more.dashboard.title')}
        subtitle={t('more.dashboard.subtitle')}
        description={t('more.dashboard.description')}
        artwork={<DashboardHeroArtwork name="more" />}
      />
      {IS_FIREFOX && <ExtensionUpdatePanel />}
      <MoreNavigation />

      <DashboardPanel
        title={t('more.api.section')}
        action={<DocsLink featureId="api_method" />}
        icon={<ZapIcon className="w-5 h-5" />}

      >
        <div className="px-4 pb-4">
          {apiLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : apiMethod ? (
            <div className="more-api-status p-3 rounded-xl border border-[var(--dashboard-item-border)] bg-[var(--dashboard-surface-muted)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{apiMethod.label}</span>
                <button
                  onClick={refreshApiMethod}
                  className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                  title={t('common:action.refresh')}
                >
                  <RefreshIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs opacity-75">{apiMethod.description}</p>
            </div>
          ) : (
            <div className="text-center py-3 text-sm text-[var(--text-secondary)]">
              {t('more.api.unavailable')}
            </div>
          )}

          <button
            onClick={() => setShowDiagnostics(true)}
            className="dashboard-button mt-3 w-full justify-center"
          >
            {t('more.api.diagnostics')}
          </button>
        </div>
      </DashboardPanel>

      <DashboardPanel
        title={t('more.data.section')}
        action={<DocsLink featureId="export_settings" />}
        icon={<DatabaseIcon className="w-5 h-5" />}

      >
        <div className="more-data-grid px-4 pb-4">
          <div data-vkify-anchor="export_settings">
            <ActionCard
              title={t('more.data.export_title')}
              description={t('more.data.export_desc')}
              icon={<DownloadIcon className="w-5 h-5" />}
              iconColor="green"
              onClick={handleExport}
            />
          </div>
          <div data-vkify-anchor="import_settings">
            <ActionCard
              title={t('more.data.import_title')}
              description={t('more.data.import_desc')}
              icon={<UploadIcon className="w-5 h-5" />}
              iconColor="blue"
              onClick={handleImportClick}
            />
          </div>
          <div data-vkify-anchor="reset_settings">
            <ActionCard
              title={t('more.data.reset_title')}
              description={t('more.data.reset_desc')}
              icon={<ResetIcon className="w-5 h-5" />}
              iconColor="red"
              danger
              onClick={handleReset}
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </DashboardPanel>

      <TelegramNotificationsSection />

      <DashboardPanel title="VKify" description={t('common:app.tagline')}
        icon={<VKifyLogo className="w-5 h-5" />} action={<DocsLink featureId="project_links" />}>
        <div className="px-4 pb-4">
        <button
          onClick={() => openLink(WEBSITE_URL)}
          className="w-full mb-3 p-3 bg-primary/10 hover:bg-primary/15 border border-primary/20 rounded-xl flex items-center justify-center gap-2 transition-colors group"
        >
          <GlobeIcon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium text-primary">{SITE_HOST}</span>
          <ExternalLinkIcon className="w-3.5 h-3.5 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <div className="grid grid-cols-2 gap-2">
          {SOCIAL_LINKS.map((link) => {
            const Icon = LINK_ICONS[link.id as LinkIconId];
            if (!Icon) return null;
            return (
              <LinkButton
                key={link.id}
                icon={<Icon className="w-4 h-4" />}
                label={t(`more.links.${link.id}`, { defaultValue: link.label })}
                onClick={() => openLink(link.url)}
                variant={link.variant as 'default' | 'telegram' | 'vk' | 'donate'}
              />
            );
          })}
        </div>
        </div>
      </DashboardPanel>

      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} />}
    </div>
    </SubpageHost>
  );
}

function MoreNavigation(): React.ReactElement {
  const { t } = useTranslation('settings');
  const { open } = useSubpageNav();
  return <DashboardPanel title={t('more.overview.title')} description={t('more.overview.description')}
    icon={<LayoutRowsIcon className="w-5 h-5" />}>
    <div className="px-4 pb-4 space-y-2">
      <div data-vkify-anchor="language"><DashboardNavItem title={t('language.nav_title')}
        description={t('language.nav_desc')} icon={<GlobeIcon className="w-5 h-5" />}
        docsId="language" onClick={() => open('language')} /></div>
      <div data-vkify-anchor="performance_dashboard"><DashboardNavItem title={t('more.performance.nav_title')}
        description={t('more.performance.nav_desc')} icon={<StatisticsIcon className="w-5 h-5" />}
        docsId="performance_dashboard" onClick={() => open('performance')} /></div>
    </div>
    <SettingRow id="dashboard_hero_enabled" title={t('more.interface.hero_title')}
      description={t('more.interface.hero_desc')} icon={<LayoutRowsIcon className="w-5 h-5" />} />
    <SettingRow id="popup_sidebar_enabled" title={t('more.interface.navigation_title')}
      description={t('more.interface.sidebar_desc')} icon={<LayoutRowsIcon className="w-5 h-5" />} />
  </DashboardPanel>;
}
