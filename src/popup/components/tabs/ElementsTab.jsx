import React from 'react';
import SettingRowMini from '../ui/SettingRowMini';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

export default function ElementsTab() {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const elements = [
    { id: 'hide_stories', title: 'Истории', emoji: '📖', description: 'Блок историй в ленте' },
    { id: 'hide_recommendations', title: 'Рекомендации', emoji: '✨', description: 'Рекомендуемый контент' },
    { id: 'hide_friends_suggestions', title: 'Возможные друзья', emoji: '👥', description: 'Блок с предложениями дружбы' },
    { id: 'hide_emoji_status', title: 'Эмодзи-статусы', emoji: '😀', description: 'Статусы с эмодзи у пользователей' },
    { id: 'hide_mini_chat', title: 'Мини-чат', emoji: '💬', description: 'Всплывающий чат в углу' },
    { id: 'hide_scroll_top', title: 'Кнопка «Наверх»', emoji: '⬆️', description: 'Кнопка прокрутки вверх' },
    { id: 'hide_menu_settings', title: 'Настройки в меню', emoji: '⚙️', description: 'Пункт настроек в левом меню' },
  ];

  const hideIds = elements.map(e => e.id);
  const hiddenCount = hideIds.filter(id => settings[id] === true).length;
  const allHidden = hiddenCount === hideIds.length;

  const handleToggleAll = async () => {
    const newValue = !allHidden;
    const updates = {};
    hideIds.forEach(id => { updates[id] = newValue; });
    await saveMultiple(updates);
    showToast(newValue ? 'Все элементы скрыты' : 'Все элементы показаны', 'success');
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">👁️</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Скрыть элементы</h3>
            {hiddenCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                {hiddenCount}
              </span>
            )}
          </div>
          <button
            onClick={handleToggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors active:scale-95"
          >
            {allHidden ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Показать всё
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
                Скрыть всё
              </>
            )}
          </button>
        </div>

        <div className="px-2 pb-2">
          {elements.map((element, index) => (
            <React.Fragment key={element.id}>
              <SettingRowMini 
                id={element.id} 
                title={element.title} 
                emoji={element.emoji}
                description={element.description}
              />
              {index < elements.length - 1 && (
                <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Подсказка */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <div className="text-xs font-medium text-primary mb-0.5">Подсказка</div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Скрытие элементов помогает сосредоточиться на важном контенте и ускоряет загрузку страницы
          </div>
        </div>
      </div>
    </div>
  );
}