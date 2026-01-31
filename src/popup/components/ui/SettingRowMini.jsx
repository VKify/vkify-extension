import React from 'react';
import Toggle from './Toggle';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

export default function SettingRowMini({ id, title, emoji, description }) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  
  // Получаем значение напрямую из settings
  const checked = settings[id] === true;

  const handleChange = async (value) => {
    const success = await saveSetting(id, value);
    if (success) {
      showToast(`${title}: ${value ? 'скрыто' : 'показано'}`, 'success');
    }
  };

  return (
    <label className="flex items-center justify-between py-3 px-3 cursor-pointer hover:bg-[var(--bg-secondary)]/50 rounded-xl transition-colors group active:bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-lg w-6 text-center flex-shrink-0">{emoji}</span>
        <div className="min-w-0">
          <span className="text-sm text-[var(--text-primary)] font-medium block truncate">{title}</span>
          {description && (
            <span className="text-xs text-[var(--text-tertiary)] block mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate">
              {description}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">
        <Toggle checked={checked} onChange={handleChange} size="small" />
      </div>
    </label>
  );
}