import React from 'react';
import SettingRow from '../ui/SettingRow';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

// Иконка фильтра
const FilterIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

export default function FiltersTab() {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const filters = [
    { id: 'filter_grayscale', title: 'Чёрно-белый', emoji: '⚫', description: 'Убрать все цвета' },
    { id: 'filter_sepia', title: 'Сепия', emoji: '🟤', description: 'Тёплый винтажный оттенок' },
    { id: 'filter_invert', title: 'Инверсия', emoji: '🔄', description: 'Инвертировать все цвета' },
    { id: 'filter_dim_images', title: 'Затемнить фото', emoji: '🌙', description: 'Приглушить яркость изображений' },
    { id: 'filter_low_brightness', title: 'Низкая яркость', emoji: '🔅', description: 'Снизить яркость страницы' },
    { id: 'filter_high_contrast', title: 'Высокий контраст', emoji: '◐', description: 'Увеличить контрастность' },
    { id: 'filter_blur', title: 'Размытие', emoji: '💨', description: 'Размыть содержимое (hover снимает)' },
  ];

  const filterIds = filters.map(f => f.id);
  const activeCount = filterIds.filter(id => settings[id] === true).length;

  const handleResetAll = async () => {
    const updates = {};
    filterIds.forEach(id => { updates[id] = false; });
    await saveMultiple(updates);
    showToast('Все фильтры отключены', 'success');
  };

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Визуальные фильтры</h3>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/5 rounded-lg transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Сбросить
            </button>
          )}
        </div>

        <div className="px-2 pb-2">
          {filters.map((filter, index) => (
            <React.Fragment key={filter.id}>
              <FilterRow 
                id={filter.id} 
                title={filter.title} 
                emoji={filter.emoji}
                description={filter.description}
              />
              {index < filters.length - 1 && (
                <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Предупреждение */}
      {activeCount > 1 && (
        <div className="flex gap-3 p-3.5 rounded-xl bg-warning/10 border border-warning/20">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div>
            <div className="text-xs font-medium text-warning mb-0.5">Внимание</div>
            <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Активно несколько фильтров. Это может замедлить работу и вызвать визуальные артефакты.
            </div>
          </div>
        </div>
      )}

      {/* Подсказка */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/10">
        <span className="text-xl flex-shrink-0">💡</span>
        <div>
          <div className="text-xs font-medium text-primary mb-0.5">Совет</div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Фильтры применяются ко всей странице. Используйте «Затемнить фото» для комфортного просмотра ночью.
          </div>
        </div>
      </div>
    </div>
  );
}

// Компонент строки фильтра
function FilterRow({ id, title, emoji, description }) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  
  const checked = settings[id] === true;

  const handleChange = async (value) => {
    await saveSetting(id, value);
    showToast(`${title}: ${value ? 'вкл' : 'выкл'}`, 'success');
  };

  return (
    <label className="flex items-center justify-between py-3 px-3 cursor-pointer hover:bg-[var(--bg-secondary)]/50 rounded-xl transition-colors group active:bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg w-6 text-center flex-shrink-0">{emoji}</span>
        <div className="min-w-0">
          <span className="text-sm text-[var(--text-primary)] font-medium block">{title}</span>
          <span className="text-xs text-[var(--text-tertiary)] block mt-0.5 truncate">
            {description}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">
        <Toggle checked={checked} onChange={handleChange} size="small" />
      </div>
    </label>
  );
}

// Toggle компонент (копия)
function Toggle({ checked, onChange, size = 'default' }) {
  const sizes = {
    small: {
      track: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: checked ? 'translate-x-4' : 'translate-x-0.5',
    },
    default: {
      track: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: checked ? 'translate-x-5' : 'translate-x-0.5',
    },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`
        relative inline-flex items-center rounded-full transition-all duration-200 ease-out
        ${s.track}
        ${checked ? 'bg-primary shadow-inner shadow-primary/20' : 'bg-[var(--bg-tertiary)]'}
        focus:outline-none
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-md transition-all duration-200 ease-out
          ${s.thumb} ${s.translate}
        `}
      />
    </button>
  );
}