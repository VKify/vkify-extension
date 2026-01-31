import React from 'react';
import Toggle from './Toggle';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

export default function SettingRow({ 
  id, 
  title, 
  description, 
  icon: Icon, 
  iconColor = 'blue' 
}) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  
  // Получаем значение напрямую из settings
  const checked = settings[id] === true;

  const handleChange = async (value) => {
    const success = await saveSetting(id, value);
    if (success) {
      showToast(`${title}: ${value ? 'включено' : 'выключено'}`, 'success');
    }
  };

  const iconColorClasses = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-emerald-500/10 text-emerald-500',
    red: 'bg-red-500/10 text-red-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
    pink: 'bg-pink-500/10 text-pink-500',
  };

  return (
    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors active:bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColorClasses[iconColor]}`}>
          {Icon}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
          {description && (
            <span className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">
        <Toggle checked={checked} onChange={handleChange} />
      </div>
    </label>
  );
}