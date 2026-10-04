import { Input, Select } from '@/popup/components/ui/FormControls.js';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Toggle from '@/popup/components/ui/Toggle.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import SettingsDisclosure from '@/popup/components/ui/SettingsDisclosure.js';
import { SettingsIcon } from '@/popup/components/icons/Icons.js';
import { useThrottledCallback } from '@/popup/hooks/core/useThrottledCallback.js';
import type { Settings } from '@/popup/store/slices/settingsSlice.js';
import {
  getWallpaperPropertyValues,
  isWallpaperId,
  parseWallpaperPropertySchema,
  parseWallpaperValues,
} from '@/shared/wallpaper-properties.js';
import type { WallpaperPropertyDefinition, WallpaperPropertyValue } from '@/shared/wallpaper-properties.js';

interface Props {
  settings: Settings;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
}

function weColorToHex(value: unknown): string {
  const parts = String(value ?? '').trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return '#0077ff';
  return `#${parts.map((part) => Math.round(Math.min(1, Math.max(0, part)) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function hexToWeColor(hex: string): string {
  const clean = hex.replace(/^#/, '');
  return [0, 2, 4]
    .map((offset) => (Number.parseInt(clean.slice(offset, offset + 2), 16) / 255).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''))
    .join(' ');
}

const WallpaperPropertiesSettings = memo(function WallpaperPropertiesSettings({ settings, saveSetting }: Props): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  const [isOpen, setIsOpen] = useState(false);
  const wallpaperId = typeof settings.web_wallpaper_id === 'string' && isWallpaperId(settings.web_wallpaper_id) ? settings.web_wallpaper_id : '';
  const schema = useMemo(() => parseWallpaperPropertySchema(settings.web_wallpaper_schema), [settings.web_wallpaper_schema]);
  const savedById = useMemo(() => parseWallpaperValues(settings.web_wallpaper_values), [settings.web_wallpaper_values]);
  const values = useMemo(
    () => getWallpaperPropertyValues(schema, savedById[wallpaperId]),
    [schema, savedById, wallpaperId],
  );

  const update = useCallback((property: WallpaperPropertyDefinition, value: WallpaperPropertyValue): void => {
    if (!wallpaperId) return;
    let next: WallpaperPropertyValue = value;
    if (property.type === 'slider' && typeof value === 'number') {
      next = Math.min(property.max ?? value, Math.max(property.min ?? value, value));
    } else if (property.type === 'combo' && !property.options?.some((option) => option.value === value)) {
      return;
    } else if (property.type === 'textinput' && typeof value === 'string') {
      next = value.slice(0, 4096);
    }
    const all = parseWallpaperValues(settings.web_wallpaper_values);
    all[wallpaperId] = { ...(all[wallpaperId] ?? {}), [property.key]: next };
    void saveSetting('web_wallpaper_values', JSON.stringify(all));
  }, [wallpaperId, settings.web_wallpaper_values, saveSetting]);
  const previewColor = useThrottledCallback((property: WallpaperPropertyDefinition, hex: string): void => {
    update(property, hexToWeColor(hex));
  }, 90);

  const controls = schema.filter((property) => property.type !== 'group');
  if (settings.background_type !== 'web' || !wallpaperId || controls.length === 0) return null;

  const renderControl = (property: WallpaperPropertyDefinition): React.ReactNode => {
    const value = values[property.key] ?? property.defaultValue;
    if (property.type === 'slider') {
      const min = property.min ?? 0;
      const max = property.max ?? 100;
      const numeric = typeof value === 'number' ? value : min;
      return (
        <RangeSlider
          id={`web-wallpaper-${property.key}`}
          label={property.label}
          value={numeric}
          min={min}
          max={max}
          step={property.step ?? (property.precision ? 1 / (10 ** property.precision) : 1)}
          onChange={(next) => update(property, next)}
        />
      );
    }
    if (property.type === 'bool') {
      return (
        <div className="flex items-center justify-end gap-3 text-[var(--text-primary)]">
          <Toggle checked={value === true} onChange={(next) => update(property, next)} size="small" label={property.label} labelPosition="left" />
        </div>
      );
    }
    if (property.type === 'combo') {
      return (
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          <span className="block mb-1.5">{property.label}</span>
          <Select icon={<SettingsIcon />}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => update(property, event.target.value)}
            className="w-full cursor-pointer"
          >
            {(property.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </label>
      );
    }
    if (property.type === 'color') {
      return (
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{property.label}</label>
          <ColorPickerField
            value={weColorToHex(value)}
            onInput={(hex) => previewColor(property, hex)}
            onChange={(hex) => update(property, hexToWeColor(hex))}
            variant="pill"
            ariaLabel={property.label}
          />
        </div>
      );
    }
    return (
      <label className="block text-xs font-medium text-[var(--text-secondary)]">
        <span className="block mb-1.5">{property.label}</span>
        <Input
          type="text"
          value={typeof value === 'string' ? value : ''}
          maxLength={4096}
          onChange={(event) => update(property, event.target.value)}
          className="w-full"
        />
      </label>
    );
  };

  return (
    <SettingsDisclosure title={t('background.wallpaper_settings')} icon={<SettingsIcon className="w-4 h-4" />}
      open={isOpen} onToggle={() => setIsOpen((open) => !open)} badge={controls.length}>
      {schema.map((property) => property.type === 'group' ? (
        <h4 key={property.key} className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{property.label}</h4>
      ) : (
        <div key={property.key}>{renderControl(property)}</div>
      ))}
      <p className="text-[10px] text-[var(--text-tertiary)]">{t('background.wallpaper_settings_hint')}</p>
    </SettingsDisclosure>
  );
});

export default WallpaperPropertiesSettings;
