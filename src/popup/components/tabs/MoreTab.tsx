import React, { useState } from 'react';
import DiagnosticsModal from '../modals/DiagnosticsModal.js';
import ActionCard from '../ui/ActionCard.js';
import LinkButton from '../ui/LinkButton.js';
import SettingsSection from '../ui/SettingsSection.js';
import {
  DownloadIcon, UploadIcon, ResetIcon, VKifyLogo,
  GitHubIcon, TelegramIcon, VKIcon, HeartIcon, GlobeIcon,
  ZapIcon, DatabaseIcon, RefreshIcon, ExternalLinkIcon,
} from '../icons/Icons.js';
import { useDataManagement } from '../../hooks/features/useDataManagement.js';
import { useApiMethod } from '../../hooks/features/useApiMethod.js';
import { SOCIAL_LINKS, WEBSITE_URL } from '../../constants/links.js';
import { SITE_HOST } from '@/shared/constants/site.js';
import { openTab } from '../../utils/tabs.js';

type LinkIconId = 'telegram' | 'vk' | 'github' | 'donate';

const LINK_ICONS: Record<LinkIconId, React.ComponentType<{ className?: string }>> = {
  telegram: TelegramIcon,
  vk: VKIcon,
  github: GitHubIcon,
  donate: HeartIcon,
};

const API_COLOR_CLASSES: Record<string, string> = {
  green: 'bg-green-500/10 border-green-500/30 text-green-600',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  red: 'bg-red-500/10 border-red-500/30 text-red-600',
  gray: 'bg-gray-500/10 border-gray-500/30 text-gray-600',
};

export default function MoreTab(): React.ReactElement {
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

  const getApiColorClass = (color: string): string =>
    API_COLOR_CLASSES[color] ?? API_COLOR_CLASSES['gray'];

  return (
    <div className="space-y-4">
      <SettingsSection
        title="Метод API"
        icon={<ZapIcon className="w-5 h-5" />}
        iconColor="orange"
      >
        <div className="px-4 pb-4">
          {apiLoading ? (
            <div className="flex items-center justify-center py-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : apiMethod ? (
            <div className={`p-3 rounded-xl border ${getApiColorClass(apiMethod.color)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{apiMethod.label}</span>
                <button
                  onClick={refreshApiMethod}
                  className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                  title="Обновить"
                >
                  <RefreshIcon className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs opacity-75">{apiMethod.description}</p>
            </div>
          ) : (
            <div className="text-center py-3 text-sm text-[var(--text-secondary)]">
              Информация недоступна
            </div>
          )}

          <button
            onClick={() => setShowDiagnostics(true)}
            className="w-full mt-3 py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Диагностика расширения
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Данные"
        icon={<DatabaseIcon className="w-5 h-5" />}
        iconColor="cyan"
      >
        <div className="px-4 pb-4 space-y-2">
          <div data-vkify-anchor="export_settings">
            <ActionCard
              title="Экспорт настроек"
              description="Сохранить в файл"
              icon={<DownloadIcon className="w-5 h-5" />}
              iconColor="green"
              onClick={handleExport}
            />
          </div>
          <div data-vkify-anchor="import_settings">
            <ActionCard
              title="Импорт настроек"
              description="Загрузить из файла"
              icon={<UploadIcon className="w-5 h-5" />}
              iconColor="blue"
              onClick={handleImportClick}
            />
          </div>
          <div data-vkify-anchor="reset_settings">
            <ActionCard
              title="Сбросить всё"
              description="Вернуть настройки по умолчанию"
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
      </SettingsSection>

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <VKifyLogo className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">VKify</h4>
            <p className="text-xs text-[var(--text-secondary)]">Сделай VK удобнее</p>
          </div>
        </div>

        <button
          onClick={() => openLink(WEBSITE_URL)}
          className="w-full mb-3 p-3 bg-gradient-to-r from-primary/10 to-blue-500/10 hover:from-primary/20 hover:to-blue-500/20 border border-primary/20 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 group"
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
                label={link.label}
                onClick={() => openLink(link.url)}
                variant={link.variant as 'default' | 'telegram' | 'vk' | 'donate'}
              />
            );
          })}
        </div>
      </section>

      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} />}
    </div>
  );
}