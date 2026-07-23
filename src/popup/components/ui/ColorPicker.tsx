import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, XIcon } from '../icons/Icons.js';
import ColorPickerField from './ColorPickerField.js';
import { useDebouncedCallback } from '../../hooks/core/useDebouncedCallback.js';
import { previewColor } from '../../utils/livePreview.js';

interface PresetTheme {
  id: string;
  name: string;
  color: string;
}

const PRESET_THEMES: PresetTheme[] = [
  { id: 'default', name: 'VK Blue', color: '#0077FF' },
  { id: 'green', name: 'Green', color: '#4BB34B' },
  { id: 'red', name: 'Red', color: '#E64646' },
  { id: 'purple', name: 'Purple', color: '#9B59B6' },
  { id: 'orange', name: 'Orange', color: '#FF9500' },
  { id: 'pink', name: 'Pink', color: '#E91E63' },
  { id: 'teal', name: 'Teal', color: '#00BCD4' },
  { id: 'indigo', name: 'Indigo', color: '#3F51B5' },
  { id: 'amber', name: 'Amber', color: '#FFC107' },
  { id: 'lime', name: 'Lime', color: '#8BC34A' },
  { id: 'cyan', name: 'Cyan', color: '#00ACC1' },
  { id: 'deepPurple', name: 'Deep purple', color: '#673AB7' },
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t: tr } = useTranslation('common');
  const [customColor, setCustomColor] = useState(value || '#0077FF');
  const [isCustom, setIsCustom] = useState(
    Boolean(value && !PRESET_THEMES.find(t => t.color.toLowerCase() === value?.toLowerCase()))
  );

  // Запись в storage дебаунсится: перетаскивание/ввод в пикере шлёт лавину
  // изменений, и без задержки каждое применялось бы контент-скриптом. Страница
  // обновляется мгновенно через previewColor (см. handleCustomPreview).
  const debouncedChange = useDebouncedCallback(onChange, 350);

  const handlePresetClick = (color: string): void => {
    setIsCustom(false);
    onChange(color);
  };

  // Непрерывно при перетаскивании: только мгновенный preview, без setState.
  const handleCustomPreview = (color: string): void => {
    previewColor('custom_accent_preview', color);
  };

  // Фиксация: обновляем локальный свотч и пишем в storage (дебаунс — для ввода).
  const handleCustomCommit = (color: string): void => {
    setCustomColor(color);
    setIsCustom(true);
    debouncedChange(color);
  };

  const handleReset = (): void => {
    setIsCustom(false);
    setCustomColor('#0077FF');
    onChange('');
  };

  const currentColor = isCustom ? customColor : (value || '#0077FF');
  const isActive = !!value;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
          {tr('color.ready_themes')}
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
              title={tr(`color.names.${theme.id}`, { defaultValue: theme.name })}
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
          {tr('color.custom_color')}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <ColorPickerField
              value={isCustom ? customColor : ''}
              onInput={handleCustomPreview}
              onChange={handleCustomCommit}
              variant="pill"
              ariaLabel={tr('color.custom_accent')}
            />
          </div>

          {isActive && (
            <button
              onClick={handleReset}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-error/10 hover:text-error transition-colors"
              title={tr('action.reset')}
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
                {tr('color.link_example')}
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                {tr('color.accent_example')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
