import React, { useState, useEffect } from 'react';
import SettingRow from '../ui/SettingRow';
import RangeSlider from '../ui/RangeSlider';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

// Иконки
const UnlockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const UsersIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PlayIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);

const StopIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);

const EyeOffIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const EditIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const CheckIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export default function ScriptsTab() {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const [autoAddStats, setAutoAddStats] = useState({ added: 0, isRunning: false });

  // Получаем статистику авто-добавления
  useEffect(() => {
    const getStats = async () => {
      try {
        const result = await chrome.storage.local.get(['auto_add_stats']);
        if (result.auto_add_stats) {
          setAutoAddStats(result.auto_add_stats);
        }
      } catch (e) {}
    };
    
    getStats();
    
    // Обновляем каждые 2 секунды если запущено
    const interval = setInterval(getStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenFriendsPage = () => {
    chrome.tabs.create({ url: 'https://vk.com/friends?act=find' });
  };

  return (
    <div className="space-y-4">
      
      {/* Анти-слежка в сообщениях */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">👻</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Невидимка в сообщениях</h3>
        </div>

        <SettingRow
          id="prevent_typing"
          title="Не показывать «печатает»"
          description="Собеседник не увидит что вы печатаете"
          icon={<EditIcon className="w-5 h-5" />}
          iconColor="purple"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="prevent_read"
          title="Не отмечать прочитанным"
          description="Сообщения останутся непрочитанными"
          icon={<CheckIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      {/* Обход авторизации */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">🔓</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Обход ограничений</h3>
        </div>

        <SettingRow
          id="bypass_auth_popup"
          title="Убрать окно авторизации"
          description="Скрывает всплывающие окна входа и баннеры"
          icon={<UnlockIcon className="w-5 h-5" />}
          iconColor="green"
        />
      </section>

      {/* Авто-добавление друзей */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Авто-добавление друзей</h3>
          </div>
          {autoAddStats.isRunning && (
            <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-success/10 text-success rounded-lg">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
              Активно
            </span>
          )}
        </div>

        {/* Описание */}
        <p className="text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
          Автоматически отправляет заявки в друзья случайным пользователям на странице поиска друзей. 
          Работает только на странице <span className="text-primary font-medium">vk.com/friends?act=find</span>
        </p>

        {/* Переключатель */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-xl mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              settings.auto_add_friends ? 'bg-success/10' : 'bg-[var(--bg-tertiary)]'
            }`}>
              <UsersIcon className={`w-5 h-5 ${settings.auto_add_friends ? 'text-success' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {settings.auto_add_friends ? 'Скрипт включён' : 'Скрипт выключен'}
              </div>
              {autoAddStats.added > 0 && (
                <div className="text-xs text-[var(--text-secondary)]">
                  Добавлено за сессию: {autoAddStats.added}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              const newValue = !settings.auto_add_friends;
              saveSetting('auto_add_friends', newValue);
              if (!newValue) {
                // Сбрасываем статистику при выключении
                chrome.storage.local.set({ auto_add_stats: { added: 0, isRunning: false } });
                setAutoAddStats({ added: 0, isRunning: false });
              }
              showToast(newValue ? 'Авто-добавление включено' : 'Авто-добавление выключено', 'success');
            }}
            className={`
              w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95
              ${settings.auto_add_friends 
                ? 'bg-error text-white' 
                : 'bg-success text-white'}
            `}
          >
            {settings.auto_add_friends ? <StopIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Настройки */}
        {settings.auto_add_friends && (
          <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            <RangeSlider
              id="auto_add_limit"
              label="Лимит в час"
              value={settings.auto_add_limit ?? 50}
              min={10}
              max={100}
              step={5}
              unit=" заявок"
              onChange={(value) => saveSetting('auto_add_limit', value)}
            />

            <RangeSlider
              id="auto_add_delay_min"
              label="Мин. задержка"
              value={settings.auto_add_delay_min ?? 20}
              min={10}
              max={60}
              step={5}
              unit=" сек"
              onChange={(value) => saveSetting('auto_add_delay_min', value)}
            />

            <RangeSlider
              id="auto_add_delay_max"
              label="Макс. задержка"
              value={settings.auto_add_delay_max ?? 40}
              min={20}
              max={120}
              step={5}
              unit=" сек"
              onChange={(value) => saveSetting('auto_add_delay_max', value)}
            />
          </div>
        )}

        {/* Кнопка открытия страницы */}
        <button
          onClick={handleOpenFriendsPage}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/15 text-primary font-medium rounded-xl transition-colors active:scale-[0.98]"
        >
          <UsersIcon className="w-5 h-5" />
          Открыть страницу поиска друзей
        </button>
      </section>

      {/* Предупреждение */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-warning/10 border border-warning/20">
        <span className="text-xl flex-shrink-0">⚠️</span>
        <div>
          <div className="text-xs font-medium text-warning mb-0.5">Внимание</div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Злоупотребление авто-добавлением может привести к временной блокировке аккаунта. 
            Используйте умеренные настройки.
          </div>
        </div>
      </div>
    </div>
  );
}