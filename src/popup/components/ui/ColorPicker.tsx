import React, { useState } from 'react';
import { CheckIcon, ColorPickerIcon, XIcon } from '../icons/Icons.js';

interface PresetTheme {
  id: string;
  name: string;
  color: string;
}

const PRESET_THEMES: PresetTheme[] = [
  { id: 'default', name: 'VK Blue', color: '#0077FF' },
  { id: 'green', name: 'Зелёный', color: '#4BB34B' },
  { id: 'red', name: 'Красный', color: '#E64646' },
  { id: 'purple', name: 'Фиолетовый', color: '#9B59B6' },
  { id: 'orange', name: 'Оранжевый', color: '#FF9500' },
  { id: 'pink', name: 'Розовый', color: '#E91E63' },
  { id: 'teal', name: 'Бирюзовый', color: '#00BCD4' },
  { id: 'indigo', name: 'Индиго', color: '#3F51B5' },
  { id: 'amber', name: 'Янтарный', color: '#FFC107' },
  { id: 'lime', name: 'Лаймовый', color: '#8BC34A' },
  { id: 'cyan', name: 'Голубой', color: '#00ACC1' },
  { id: 'deepPurple', name: 'Тёмно-фиол.', color: '#673AB7' },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value || '#0077FF');
  const [isCustom, setIsCustom] = useState(
    Boolean(value && !PRESET_THEMES.find(t => t.color.toLowerCase() === value?.toLowerCase()))
  );

  const handlePresetClick = (color: string): void => {
    setIsCustom(false);
    onChange(color);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const color = e.target.value;
    setCustomColor(color);
    setIsCustom(true);
    onChange(color);
  };

  const handleReset = (): void => {
    setIsCustom(false);
    setCustomColor('#0077FF');
    onChange('');
  };

  const currentColor = value || '#0077FF';
  const isActive = !!value;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          Готовые темы
        </div>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handlePresetClick(theme.color)}
              className={`
                relative w-full aspect-square rounded-xl transition-all duration-200
                hover:scale-110 active:scale-95
                ${value?.toLowerCase() === theme.color.toLowerCase() && !isCustom
                  ? 'ring-2 ring-offset-2 ring-[var(--text-primary)] ring-offset-[var(--bg-primary)]'
                  : ''}
              `}
              style={{ backgroundColor: theme.color }}
              title={theme.name}
            >
              {value?.toLowerCase() === theme.color.toLowerCase() && !isCustom && (
                <CheckIcon className="absolute inset-0 m-auto w-4 h-4 text-white" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          Свой цвет
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="color"
              value={customColor}
              onChange={handleCustomChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className={`
                w-full h-11 rounded-xl border-2 flex items-center justify-center gap-2 cursor-pointer
                transition-all
                ${isCustom
                  ? 'border-[var(--text-primary)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'}
              `}
              style={{ backgroundColor: isCustom ? customColor : 'var(--bg-secondary)' }}
            >
              <ColorPickerIcon
                className={`w-5 h-5 ${isCustom ? 'text-white' : 'text-[var(--text-secondary)]'}`}
              />
              <span className={`text-sm font-medium ${isCustom ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                {isCustom ? customColor.toUpperCase() : 'Выбрать'}
              </span>
            </div>
          </div>

          {isActive && (
            <button
              onClick={handleReset}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-error/10 hover:text-error transition-colors"
              title="Сбросить"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {isActive && (
        <div
          className="p-3 rounded-xl border border-[var(--border-color)]"
          style={{ borderColor: currentColor }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: currentColor }}
            >
              VK
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: currentColor }}>
                Пример ссылки
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Так будут выглядеть акценты
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}