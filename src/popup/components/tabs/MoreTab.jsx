import React, { useRef } from 'react';
import ThemeSelector from '../ui/ThemeSelector';
import ActionCard from '../ui/ActionCard';
import { DownloadIcon, UploadIcon, ResetIcon, VKifyLogo, GitHubIcon, TelegramIcon, VKIcon, HeartIcon } from '../icons/Icons';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

export default function MoreTab() {
  const { exportSettings, importSettings, resetSettings } = useSettings();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    await exportSettings();
    showToast('Настройки экспортированы', 'success');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const success = await importSettings(file);
      if (success) {
        showToast('Настройки импортированы', 'success');
      } else {
        showToast('Ошибка: неверный формат файла', 'error');
      }
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    if (confirm('Сбросить все настройки? Это действие нельзя отменить.')) {
      const success = await resetSettings();
      if (success) {
        const tabs = await chrome.tabs.query({ url: '*://*.vk.com/*' });
        for (const tab of tabs) {
          chrome.tabs.reload(tab.id);
        }
        showToast('Настройки сброшены', 'success');
      } else {
        showToast('Ошибка сброса', 'error');
      }
    }
  };

  const openLink = (url) => {
    chrome.tabs.create({ url });
  };

  return (
    <div className="space-y-4">
      {/* Тема */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎨</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Тема оформления</h3>
        </div>
        <ThemeSelector />
      </section>

      {/* Управление данными */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">💾</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Данные</h3>
        </div>

        <div className="space-y-2">
          <ActionCard
            title="Экспорт настроек"
            description="Сохранить в файл"
            icon={<DownloadIcon className="w-5 h-5" />}
            iconColor="green"
            onClick={handleExport}
          />

          <ActionCard
            title="Импорт настроек"
            description="Загрузить из файла"
            icon={<UploadIcon className="w-5 h-5" />}
            iconColor="blue"
            onClick={handleImportClick}
          />

          <ActionCard
            title="Сбросить всё"
            description="Вернуть настройки по умолчанию"
            icon={<ResetIcon className="w-5 h-5" />}
            iconColor="red"
            danger
            onClick={handleReset}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </section>

      {/* О расширении */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <VKifyLogo className="w-7 h-7 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">VKify</h4>
            <p className="text-xs text-[var(--text-secondary)]">Сделай VK удобнее</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <LinkButton
            icon={<GitHubIcon className="w-4 h-4" />}
            label="GitHub"
            onClick={() => openLink('https://github.com/rianvy/vkify')}
          />
          <LinkButton
            icon={<TelegramIcon className="w-4 h-4" />}
            label="Telegram"
            onClick={() => openLink('https://t.me/VKify')}
            variant="telegram"
          />
          <LinkButton
            icon={<VKIcon className="w-4 h-4" />}
            label="Группа VK"
            onClick={() => openLink('https://vk.com/vkify')}
            variant="vk"
          />
          <LinkButton
            icon={<HeartIcon className="w-4 h-4" />}
            label="Поддержать"
            onClick={() => openLink('https://pay.cloudtips.ru/p/b59e1765')}
            variant="donate"
          />
        </div>
      </section>
    </div>
  );
}

function LinkButton({ icon, label, onClick, variant = 'default' }) {
  const variants = {
    default: 'hover:bg-[var(--bg-tertiary)]',
    telegram: 'hover:bg-[#0088cc]/10 hover:text-[#0088cc]',
    vk: 'hover:bg-primary/10 hover:text-primary',
    donate: 'hover:bg-pink-500/10 hover:text-pink-500',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium
        bg-[var(--bg-secondary)] transition-all duration-200
        text-[var(--text-secondary)]
        ${variants[variant]}
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}