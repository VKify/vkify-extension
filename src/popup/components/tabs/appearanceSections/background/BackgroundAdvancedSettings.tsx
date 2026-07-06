import React, { memo, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import ColorPickerField from '@/popup/components/ui/ColorPickerField.js';
import { useThrottledCallback } from '@/popup/hooks/core/useThrottledCallback.js';
import { ChevronDownIcon, SparklesIcon, PaletteIcon, ImageIcon } from '@/popup/components/icons/Icons.js';
import { BgIcon } from './icons.js';
import { parseVideoUrl } from '@/shared/videoEmbed.js';
import type { Settings } from '@/popup/store/slices/settingsSlice.js';
import type { BackgroundPreset } from '@/popup/constants/appearance.js';
import {
  BACKGROUND_SETTINGS,
  BACKGROUND_FILTERS,
  BACKGROUND_EFFECTS,
  BACKGROUND_POSITIONS,
  BACKGROUND_SIZES,
  BACKGROUND_PRESETS,
  VIDEO_SETTINGS,
} from '@/popup/constants/appearance.js';


interface EffectPresetButtonProps {
  preset: BackgroundPreset;
  isActive: boolean;
  onClick: () => void;
}

const EffectPresetButton = memo(function EffectPresetButton({ preset, isActive, onClick }: EffectPresetButtonProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  const name = t(`background.presets.${preset.id}`, { defaultValue: preset.name });
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all min-w-0
        ${isActive ? 'bg-primary text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
      title={name}
    >
      <BgIcon id={preset.iconId} className="w-4 h-4" />
      <span className="text-[9px] font-medium truncate w-full text-center">{name}</span>
    </button>
  );
});

interface SelectOptionItem {
  id: string;
  name: string;
  value: string;
}

interface SelectOptionProps {
  label: string;
  options: readonly SelectOptionItem[];
  value: string;
  onChange: (value: string) => void;
  icon?: string;
}

const SelectOption = memo(function SelectOption({ label, options, value, onChange, icon }: SelectOptionProps): React.ReactElement {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-primary cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.value}>{opt.name}</option>
        ))}
      </select>
    </div>
  );
});

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: number | null;
}

const CollapsibleSection = memo(function CollapsibleSection({ title, icon, isOpen, onToggle, children, badge }: CollapsibleSectionProps): React.ReactElement {
  return (
    <div className="border-t border-[var(--border-color)]">
      <button onClick={onToggle} className="w-full flex items-center justify-between py-3 text-sm font-medium text-[var(--text-primary)]">
        <span className="flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
          {badge != null && <span className="px-1.5 py-0.5 text-[10px] bg-primary/10 text-primary rounded-full">{badge}</span>}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="pb-3 space-y-3">{children}</div>}
    </div>
  );
});


interface BackgroundAdvancedSettingsProps {
  settings: Settings;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (updates: Settings) => Promise<boolean>;
}

/** «Настройки отображения» фона: пресеты эффектов, фильтры, видео, позиция. */
const BackgroundAdvancedSettings = memo(function BackgroundAdvancedSettings({ settings, saveSetting, saveMultiple }: BackgroundAdvancedSettingsProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  const sLabel = (id: string, fallback: string): string => t(`background.settings.${id}`, { defaultValue: fallback });
  const [showFilters, setShowFilters] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  // У оверлея нет канала мгновенного preview — единственный путь применения это
  // запись в storage. Троттлим (а не дебаунсим): цвет применяется непрерывно во
  // время перетаскивания (≈11 раз/с), без лавины записей в chrome.storage.
  const saveOverlayColor = useThrottledCallback((color: string): void => {
    void saveSetting('background_overlay_color', color);
  }, 90);

  const currentType = (settings['background_type'] as string | undefined) ?? 'image';
  const isDirectVideo = currentType === 'video';
  const isEmbed = currentType === 'embed';
  const isAnyVideo = isDirectVideo || isEmbed;
  const isWeb = currentType === 'web';
  const isImage = currentType === 'image';

  const embedPlatform = useMemo<string | null>(() => {
    if (!isEmbed || !settings['custom_background']) return null;
    const data = parseVideoUrl(settings['custom_background'] as string);
    return data?.platform ?? null;
  }, [isEmbed, settings['custom_background']]);

  const videoSettings = useMemo(() => {
    return VIDEO_SETTINGS.filter(s => {
      if (s.id === 'background_video_speed') return isDirectVideo;
      if (s.id === 'background_video_volume') return isDirectVideo || isEmbed;
      return true;
    });
  }, [isDirectVideo, isEmbed]);

  const activeFiltersCount = useMemo(() => {
    return BACKGROUND_FILTERS.filter(f => {
      const value = settings[f.id];
      return value !== undefined && value !== f.defaultValue;
    }).length;
  }, [settings]);

  const activeEffectsCount = useMemo(() => {
    let count = 0;
    BACKGROUND_EFFECTS.forEach(e => {
      if (settings[e.id] !== undefined && settings[e.id] !== e.defaultValue) count++;
    });
    if ((settings['background_overlay_opacity'] as number | undefined) ?? 0 > 0) count++;
    return count;
  }, [settings]);

  const applyEffectPreset = useCallback(async (preset: BackgroundPreset): Promise<void> => {
    const settingsToSave: Record<string, unknown> = {};
    [...BACKGROUND_SETTINGS, ...BACKGROUND_FILTERS, ...BACKGROUND_EFFECTS].forEach(s => {
      settingsToSave[s.id] = s.defaultValue;
    });
    settingsToSave['background_overlay_opacity'] = 0;
    Object.entries(preset.settings).forEach(([key, value]) => {
      settingsToSave[`background_${key}`] = value;
    });
    await saveMultiple(settingsToSave as Settings);
  }, [saveMultiple]);

  const activePresetId = useMemo<string | null>(() => {
    return BACKGROUND_PRESETS.find(preset => {
      return Object.entries(preset.settings).every(([key, value]) => {
        const settingKey = `background_${key}`;
        const currentValue = settings[settingKey];
        const defaultSetting = [...BACKGROUND_SETTINGS, ...BACKGROUND_FILTERS, ...BACKGROUND_EFFECTS].find(s => s.id === settingKey);
        return currentValue === value || (currentValue === undefined && value === defaultSetting?.defaultValue);
      });
    })?.id ?? null;
  }, [settings]);

  const localizedPositions = useMemo(
    () => BACKGROUND_POSITIONS.map((o) => ({ ...o, name: t(`background.options.${o.id}`, { defaultValue: o.name }) })),
    [t],
  );
  const localizedSizes = useMemo(
    () => BACKGROUND_SIZES.map((o) => ({ ...o, name: t(`background.options.${o.id}`, { defaultValue: o.name }) })),
    [t],
  );

  return (
    <div className="space-y-0">
      <div className="pb-3">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 flex items-center gap-1.5">
          <SparklesIcon className="w-3.5 h-3.5" />{t('background.quick_presets')}
        </label>
        <div className="grid grid-cols-8 gap-1">
          {BACKGROUND_PRESETS.map((preset) => (
            <EffectPresetButton
              key={preset.id}
              preset={preset}
              isActive={activePresetId === preset.id}
              onClick={() => { void applyEffectPreset(preset); }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 py-3 border-t border-[var(--border-color)]">
        {BACKGROUND_SETTINGS.map((setting) => (
          <RangeSlider
            key={setting.id}
            id={setting.id}
            label={sLabel(setting.id, setting.label)}
            value={(settings[setting.id] as number | undefined) ?? setting.defaultValue}
            min={setting.min}
            max={setting.max}
            step={setting.step}
            unit={setting.unit}
            onChange={(value) => { void saveSetting(setting.id, value); }}
          />
        ))}
      </div>

      {isAnyVideo && videoSettings.length > 0 && (
        <CollapsibleSection
          title={isEmbed ? t('background.video_settings_platform', { platform: embedPlatform ?? 'embed' }) : t('background.video_settings')}
          icon={<SparklesIcon className="w-4 h-4" />}
          isOpen={showVideo}
          onToggle={() => setShowVideo(!showVideo)}
        >
          {videoSettings.map((setting) => (
            <RangeSlider
              key={setting.id}
              id={setting.id}
              label={sLabel(setting.id, setting.label)}
              value={(settings[setting.id] as number | undefined) ?? setting.defaultValue}
              min={setting.min}
              max={setting.max}
              step={setting.step}
              unit={setting.unit}
              onChange={(value) => { void saveSetting(setting.id, value); }}
            />
          ))}
          {isEmbed && embedPlatform && (
            <p className="text-[10px] text-[var(--text-tertiary)]">
              {t(`background.embed_note.${['rutube', 'youtube', 'vk', 'twitch'].includes(embedPlatform) ? embedPlatform : 'default'}`)}
            </p>
          )}
        </CollapsibleSection>
      )}

      {!isWeb && (
        <CollapsibleSection
          title={t('background.color_filters')}
          icon={<PaletteIcon className="w-4 h-4" />}
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
          badge={activeFiltersCount > 0 ? activeFiltersCount : null}
        >
          {BACKGROUND_FILTERS.map((filter) => (
            <RangeSlider
              key={filter.id}
              id={filter.id}
              label={sLabel(filter.id, filter.label)}
              icon={<BgIcon id={filter.iconId} className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
              value={(settings[filter.id] as number | undefined) ?? filter.defaultValue}
              min={filter.min}
              max={filter.max}
              step={filter.step}
              unit={filter.unit}
              onChange={(value) => { void saveSetting(filter.id, value); }}
            />
          ))}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title={t('background.effects')}
        icon={<SparklesIcon className="w-4 h-4" />}
        isOpen={showEffects}
        onToggle={() => setShowEffects(!showEffects)}
        badge={activeEffectsCount > 0 ? activeEffectsCount : null}
      >
        {BACKGROUND_EFFECTS.map((effect) => (
          <RangeSlider
            key={effect.id}
            id={effect.id}
            label={sLabel(effect.id, effect.label)}
            icon={<BgIcon id={effect.iconId} className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
            value={(settings[effect.id] as number | undefined) ?? effect.defaultValue}
            min={effect.min}
            max={effect.max}
            step={effect.step}
            unit={effect.unit}
            onChange={(value) => { void saveSetting(effect.id, value); }}
          />
        ))}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
            <PaletteIcon className="w-3.5 h-3.5" />{t('background.color_overlay')}
          </label>
          <div className="flex gap-2 items-center">
            <ColorPickerField
              value={(settings['background_overlay_color'] as string | undefined) ?? '#000000'}
              onInput={saveOverlayColor}
              onChange={(color) => { void saveSetting('background_overlay_color', color); }}
              variant="swatch"
              ariaLabel={t('background.overlay_aria')}
            />
            <div className="flex-1">
              <RangeSlider
                id="background_overlay_opacity"
                label={t('background.intensity')}
                value={(settings['background_overlay_opacity'] as number | undefined) ?? 0}
                min={0}
                max={80}
                step={5}
                unit="%"
                onChange={(value) => { void saveSetting('background_overlay_opacity', value); }}
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {isImage && (
        <CollapsibleSection
          title={t('background.positioning')}
          icon={<ImageIcon className="w-4 h-4" />}
          isOpen={showPosition}
          onToggle={() => setShowPosition(!showPosition)}
        >
          <div className="grid grid-cols-2 gap-3">
            <SelectOption
              label={t('background.position')}
              options={localizedPositions}
              value={(settings['background_position'] as string | undefined) ?? 'center'}
              onChange={(value) => { void saveSetting('background_position', value); }}
            />
            <SelectOption
              label={t('background.size')}
              options={localizedSizes}
              value={(settings['background_size'] as string | undefined) ?? 'cover'}
              onChange={(value) => { void saveSetting('background_size', value); }}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
});

export default BackgroundAdvancedSettings;
