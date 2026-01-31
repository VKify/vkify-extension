import React, { useState } from 'react';
import { MonitorIcon, BanIcon, RefreshIcon } from './icons/Icons';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

export default function QuickActions() {
  const { settings, saveSetting, saveMultiple } = useSettings();
  const { showToast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const wideEnabled = settings.style_widescreen === true;
  
  // Проверяем, включена ли хотя бы одна опция блокировки рекламы
  const adsEnabled = settings.block_left_ads === true || 
                     settings.block_feed_ads === true ||
                     settings.block_stories_ads === true ||
                     settings.block_clips_ads === true;

  const handleWideToggle = async () => {
    const newValue = !wideEnabled;
    await saveSetting('style_widescreen', newValue);
    showToast(`Расширенный режим: ${newValue ? 'вкл' : 'выкл'}`, 'success');
  };

  const handleAdsToggle = async () => {
    // Если хоть что-то включено - выключаем всё, иначе включаем всё
    const newValue = !adsEnabled;
    await saveMultiple({
      block_left_ads: newValue,
      block_feed_ads: newValue,
      block_stories_ads: newValue,
      block_clips_ads: newValue,
    });
    showToast(`Блокировка рекламы: ${newValue ? 'вкл' : 'выкл'}`, 'success');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('vk.com')) {
      chrome.tabs.reload(tab.id);
      showToast('Страница обновлена', 'success');
    } else {
      showToast('Откройте VK для обновления', 'error');
    }

    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div className="px-5 py-4">
      <div className="flex gap-3">
        <QuickCard
          icon={<MonitorIcon className="w-6 h-6" />}
          label="Широкий режим"
          active={wideEnabled}
          onClick={handleWideToggle}
        />
        <QuickCard
          icon={<BanIcon className="w-6 h-6" />}
          label="Без рекламы"
          active={adsEnabled}
          onClick={handleAdsToggle}
        />
        <QuickCard
          icon={<RefreshIcon className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />}
          label="Обновить"
          isAction
          onClick={handleRefresh}
        />
      </div>
    </div>
  );
}

function QuickCard({ icon, label, active, isAction, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex flex-col items-center gap-2 py-3.5 px-3 rounded-2xl transition-all duration-200
        ${isAction
          ? 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--text-tertiary)] hover:shadow-sm active:scale-95'
          : active
            ? 'bg-primary text-white shadow-lg shadow-primary/25 active:scale-95'
            : 'bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-primary/50 hover:shadow-sm active:scale-95'
        }
      `}
    >
      <div className={`${!isAction && !active ? 'text-[var(--text-secondary)]' : ''}`}>
        {icon}
      </div>
      <span className={`text-xs font-medium ${!isAction && !active ? 'text-[var(--text-secondary)]' : ''}`}>
        {label}
      </span>
      {!isAction && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          active 
            ? 'bg-white/20 text-white' 
            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
        }`}>
          {active ? 'Вкл' : 'Выкл'}
        </span>
      )}
    </button>
  );
}