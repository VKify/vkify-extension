import React from 'react';
import SettingRow from '../ui/SettingRow';
import { BanIcon } from '../icons/Icons';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

export default function AdsTab() {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const adsSettings = ['block_left_ads', 'block_feed_ads', 'block_stories_ads', 'block_clips_ads'];
  
  // Подсчёт активных фильтров
  const activeCount = adsSettings.filter(id => settings[id] === true).length;
  const allBlocked = activeCount === adsSettings.length;

  const handleBlockAll = async () => {
    const newValue = !allBlocked;
    const updates = {};
    adsSettings.forEach(id => { updates[id] = newValue; });
    await saveMultiple(updates);
    showToast(newValue ? 'Вся реклама заблокирована' : 'Блокировка отключена', 'success');
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Блокировка рекламы</h3>
          </div>
          <button
            onClick={handleBlockAll}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all active:scale-95
              ${allBlocked 
                ? 'text-error hover:bg-error/5' 
                : 'text-success hover:bg-success/5'}
            `}
          >
            <BanIcon className="w-3.5 h-3.5" />
            {allBlocked ? 'Отключить всё' : 'Заблокировать всё'}
          </button>
        </div>

        <SettingRow
          id="block_left_ads"
          title="Боковая панель"
          description="Рекламные блоки слева"
          icon={<BanIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="block_feed_ads"
          title="Лента новостей"
          description="Рекламные посты в ленте"
          icon={<BanIcon className="w-5 h-5" />}
          iconColor="red"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="block_stories_ads"
          title="Истории"
          description="Рекламные истории"
          icon={<BanIcon className="w-5 h-5" />}
          iconColor="orange"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="block_clips_ads"
          title="Клипы"
          description="Рекламные ролики в клипах"
          icon={<BanIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      {/* Статус */}
      <div className={`
        flex items-center gap-3 p-4 rounded-2xl border-2 transition-all
        ${allBlocked 
          ? 'bg-success/5 border-success/20' 
          : activeCount > 0
            ? 'bg-primary/5 border-primary/20'
            : 'bg-[var(--bg-primary)] border-[var(--border-color)]'}
      `}>
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          ${allBlocked 
            ? 'bg-success/10' 
            : activeCount > 0 
              ? 'bg-primary/10' 
              : 'bg-[var(--bg-secondary)]'}
        `}>
          {allBlocked ? (
            <svg className="w-6 h-6 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          ) : activeCount > 0 ? (
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          ) : (
            <BanIcon className="w-6 h-6 text-[var(--text-tertiary)]" />
          )}
        </div>
        <div>
          <div className={`text-sm font-medium ${
            allBlocked 
              ? 'text-success' 
              : activeCount > 0 
                ? 'text-primary' 
                : 'text-[var(--text-primary)]'
          }`}>
            {allBlocked 
              ? 'Полная защита' 
              : activeCount > 0 
                ? 'Частичная защита' 
                : 'Защита отключена'}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {allBlocked 
              ? 'Все фильтры активны' 
              : `Активно ${activeCount} из ${adsSettings.length} фильтров`}
          </div>
        </div>
      </div>
    </div>
  );
}