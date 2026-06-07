import React, { memo, useMemo, useState, useCallback } from 'react';
import RangeSlider from '../../ui/RangeSlider.js';
import LinkButton from '../../ui/LinkButton.js';
import { XIcon, CheckIcon, UploadIcon, ImageIcon, ChevronDownIcon, PlayIconFilled, SpinnerIcon, CheckCircleIcon } from '../../icons/Icons.js';
import { useSettings } from '../../../context/SettingsContext.js';
import { useBackground } from '../../../hooks/features/useBackground.js';
import { parseVideoUrl } from '../../../../shared/videoEmbed.js';
import { WALLPAPERS_URL } from '../../../constants/links.js';
import { SITE_HOST } from '../../../../shared/constants/site.js';
import type { Settings } from '../../../context/SettingsContext.js';
import type { BackgroundPreset, WallpaperPreset } from '../../../constants/appearance.js';
import {
  createPresetWallpapers,
  BACKGROUND_SETTINGS,
  BACKGROUND_FILTERS,
  BACKGROUND_EFFECTS,
  BACKGROUND_POSITIONS,
  BACKGROUND_SIZES,
  BACKGROUND_PRESETS,
  VIDEO_SETTINGS,
} from '../../../constants/appearance.js';

const TABS = [
  { id: 'presets', label: '🎭 Готовые' },
  { id: 'custom', label: '📤 Свой' },
] as const;

const TYPE_ICONS: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
  embed: '📺',
  web: '🌐',
};

const TYPE_NAMES: Record<string, string> = {
  image: 'Изображение',
  video: 'Видео',
  embed: 'Видео (embed)',
  web: 'Веб-обои',
};


interface EffectPresetButtonProps {
  preset: BackgroundPreset;
  isActive: boolean;
  onClick: () => void;
}

const EffectPresetButton = memo(function EffectPresetButton({ preset, isActive, onClick }: EffectPresetButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all min-w-0
        ${isActive ? 'bg-primary text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'}`}
      title={preset.name}
    >
      <span className="text-base">{preset.icon}</span>
      <span className="text-[9px] font-medium truncate w-full text-center">{preset.name}</span>
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
  icon?: string;
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


type MediaCardVariant = 'image' | 'video' | 'web';

interface MediaCardProps {
  preset: WallpaperPreset;
  isSelected: boolean;
  onSelect: (preset: WallpaperPreset) => void;
  variant?: MediaCardVariant;
}

const MediaCard = memo(function MediaCard({ preset, isSelected, onSelect, variant = 'image' }: MediaCardProps): React.ReactElement {
  return (
    <button
      onClick={() => onSelect(preset)}
      className={`group relative aspect-[16/10] rounded-xl overflow-hidden transition-all duration-200
        hover:scale-[1.02] active:scale-[0.98]
        ${isSelected
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-primary)]'
          : 'hover:ring-2 hover:ring-primary/40'
        }`}
    >
      {/* Картинка с зумом при наведении */}
      <img
        src={preset.preview}
        alt={preset.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />

      {/* Затемнение при hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

      {/* Кнопка воспроизведения для видео */}
      {variant === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center
                          transition-transform duration-200 group-hover:scale-110 shadow-lg">
            <PlayIconFilled className="w-3.5 h-3.5 text-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Бейдж типа для видео / веб */}
      {variant !== 'image' && (
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold text-white rounded-full backdrop-blur-sm shadow-sm
            ${variant === 'video' ? 'bg-violet-500/80' : 'bg-blue-500/80'}`}>
            {variant === 'video' ? '🎬' : '🌐'}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
        <span className="text-[10px] font-semibold text-white leading-tight line-clamp-1 drop-shadow">
          {preset.name}
        </span>
      </div>

      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <CheckIcon className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
});


const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  vk: 'VK Video',
  vimeo: 'Vimeo',
  coub: 'Coub',
  dailymotion: 'Dailymotion',
  rutube: 'Rutube',
  twitch: 'Twitch',
};

interface UrlTypeIndicatorProps {
  url: string;
}

const UrlTypeIndicator = memo(function UrlTypeIndicator({ url }: UrlTypeIndicatorProps): React.ReactElement | null {
  if (!url) return null;

  const embed = parseVideoUrl(url);
  if (embed) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <span className="text-xs">📺</span>
        <span className="text-[11px] text-primary font-medium">
          {PLATFORM_NAMES[embed.platform] ?? embed.platform} — будет встроено как фон
        </span>
      </div>
    );
  }

  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <span className="text-xs">🎬</span>
        <span className="text-[11px] text-primary font-medium">Прямое видео</span>
      </div>
    );
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <span className="text-xs">🌐</span>
        <span className="text-[11px] text-primary font-medium">Веб-обои</span>
      </div>
    );
  }

  return null;
});


interface CustomUploadProps {
  displayUrl: string;
  previewUrl: string;
  currentType: string;
  isUploading: boolean;
  isCustomUploaded: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUrlChange: (value: string) => void;
  onApply: () => void;
  onOpenFileDialog: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getPreviewStyle: () => React.CSSProperties;
}

const CustomUpload = memo(function CustomUpload({
  displayUrl, previewUrl, currentType, isUploading, isCustomUploaded,
  fileInputRef, onUrlChange, onApply, onOpenFileDialog, onFileSelect, getPreviewStyle,
}: CustomUploadProps): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="url"
            value={displayUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Вставьте ссылку..."
            className="w-full pl-10 pr-3 py-2.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-primary text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>
        <button
          onClick={onApply}
          disabled={!displayUrl}
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
      </div>

      <UrlTypeIndicator url={displayUrl} />

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-[var(--border-color)]" />
        <span className="text-xs text-[var(--text-tertiary)]">или</span>
        <div className="flex-1 border-t border-[var(--border-color)]" />
      </div>

      <button
        onClick={onOpenFileDialog}
        disabled={isUploading}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed transition-all
          ${isUploading ? 'border-primary/50 bg-primary/5' : 'border-[var(--border-color)] hover:border-primary hover:bg-primary/5'}`}
      >
        {isUploading ? (
          <>
            <SpinnerIcon className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-primary font-medium">Загрузка...</span>
          </>
        ) : (
          <>
            <UploadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)] font-medium">Загрузить изображение</span>
          </>
        )}
      </button>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />

      {previewUrl && !previewUrl.startsWith('linear-gradient') && currentType === 'image' && (
        <div className="h-24 rounded-xl border-2 border-primary/30 overflow-hidden" style={getPreviewStyle()} />
      )}

      {isCustomUploaded && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <CheckCircleIcon className="w-4 h-4 text-success" />
          <span>Изображение загружено</span>
        </div>
      )}
    </div>
  );
});


interface BackgroundAdvancedSettingsProps {
  settings: Settings;
  saveSetting: (key: string, value: unknown) => Promise<boolean>;
  saveMultiple: (updates: Settings) => Promise<boolean>;
}

const BackgroundAdvancedSettings = memo(function BackgroundAdvancedSettings({ settings, saveSetting, saveMultiple }: BackgroundAdvancedSettingsProps): React.ReactElement {
  const [showFilters, setShowFilters] = useState(false);
  const [showEffects, setShowEffects] = useState(false);
  const [showPosition, setShowPosition] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

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

  return (
    <div className="space-y-0">
      <div className="pb-3">
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">✨ Быстрые пресеты</label>
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
            label={setting.label}
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
          title={isEmbed ? `Настройки видео (${embedPlatform ?? 'embed'})` : 'Настройки видео'}
          icon="🎬"
          isOpen={showVideo}
          onToggle={() => setShowVideo(!showVideo)}
        >
          {videoSettings.map((setting) => (
            <RangeSlider
              key={setting.id}
              id={setting.id}
              label={setting.label}
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
              {embedPlatform === 'rutube' && '⚠️ Rutube: автозапуск и loop через postMessage API'}
              {embedPlatform === 'youtube' && '💡 YouTube: громкость переключает mute/unmute'}
              {embedPlatform === 'vk' && '💡 VK Video: громкость переключает mute/unmute'}
              {embedPlatform === 'twitch' && '💡 Twitch: громкость переключает mute/unmute'}
              {!['rutube', 'youtube', 'vk', 'twitch'].includes(embedPlatform) && '💡 Громкость управляется плеером платформы'}
            </p>
          )}
        </CollapsibleSection>
      )}

      {!isWeb && (
        <CollapsibleSection
          title="Цветовые фильтры"
          icon="🎨"
          isOpen={showFilters}
          onToggle={() => setShowFilters(!showFilters)}
          badge={activeFiltersCount > 0 ? activeFiltersCount : null}
        >
          {BACKGROUND_FILTERS.map((filter) => (
            <RangeSlider
              key={filter.id}
              id={filter.id}
              label={`${filter.icon ?? ''} ${filter.label}`}
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
        title="Эффекты"
        icon="✨"
        isOpen={showEffects}
        onToggle={() => setShowEffects(!showEffects)}
        badge={activeEffectsCount > 0 ? activeEffectsCount : null}
      >
        {BACKGROUND_EFFECTS.map((effect) => (
          <RangeSlider
            key={effect.id}
            id={effect.id}
            label={`${effect.icon ?? ''} ${effect.label}`}
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
            <span>🎭</span>Цветной оверлей
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={(settings['background_overlay_color'] as string | undefined) ?? '#000000'}
              onChange={(e) => { void saveSetting('background_overlay_color', e.target.value); }}
              className="w-10 h-10 rounded-lg cursor-pointer border border-[var(--border-color)] bg-transparent"
            />
            <div className="flex-1">
              <RangeSlider
                id="background_overlay_opacity"
                label="Интенсивность"
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
          title="Позиционирование"
          icon="📐"
          isOpen={showPosition}
          onToggle={() => setShowPosition(!showPosition)}
        >
          <div className="grid grid-cols-2 gap-3">
            <SelectOption
              label="Позиция"
              options={BACKGROUND_POSITIONS}
              value={(settings['background_position'] as string | undefined) ?? 'center'}
              onChange={(value) => { void saveSetting('background_position', value); }}
            />
            <SelectOption
              label="Размер"
              options={BACKGROUND_SIZES}
              value={(settings['background_size'] as string | undefined) ?? 'cover'}
              onChange={(value) => { void saveSetting('background_size', value); }}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
});


const BackgroundSection = memo(function BackgroundSection(): React.ReactElement {
  const { settings, saveSetting, saveMultiple } = useSettings();
  const background = useBackground();
  const [isExpanded, setIsExpanded] = useState(false);

  const presetWallpapers = useMemo(() => createPresetWallpapers(), []);

  const getVariant = useCallback((preset: WallpaperPreset): MediaCardVariant => {
    if (preset.type === 'video') return 'video';
    if (preset.type === 'web') return 'web';
    return 'image';
  }, []);

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block leading-tight">Фон</span>
            {background.hasBackground ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5
                ${background.currentType === 'video' ? 'bg-violet-500/15 text-violet-500' :
                  background.currentType === 'embed' ? 'bg-orange-500/15 text-orange-500' :
                  background.currentType === 'web'   ? 'bg-blue-500/15 text-blue-500' :
                                                       'bg-emerald-500/15 text-emerald-500'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {TYPE_NAMES[background.currentType] ?? 'Изображение'}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--text-tertiary)]">Не установлен</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {background.hasBackground && (
            <button
              onClick={(e) => { e.stopPropagation(); void background.clearBackground(); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                         text-[var(--text-secondary)] hover:text-error
                         bg-[var(--bg-secondary)] hover:bg-error/10
                         rounded-lg transition-all duration-150"
            >
              <XIcon className="w-3.5 h-3.5" />Сбросить
            </button>
          )}
          <div className={`w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center transition-all duration-300 group-hover:bg-[var(--bg-tertiary)] ${isExpanded ? 'rotate-180 bg-primary/10' : ''}`}>
            <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
          </div>
        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">
            <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl mb-4 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => background.setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex-1 py-2 px-2.5 text-xs font-medium rounded-lg transition-all
                    ${background.activeTab === tab.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {background.activeTab === 'presets' && (
              presetWallpapers.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {presetWallpapers.map((preset) => (
                    <MediaCard
                      key={preset.id}
                      preset={preset}
                      variant={getVariant(preset)}
                      isSelected={background.isPresetSelected(preset)}
                      onSelect={(p) => { void background.selectPreset(p); }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] text-center py-6">Пресеты не найдены</p>
              )
            )}

            {background.activeTab === 'custom' && (
              <div className="space-y-4">
                <CustomUpload
                  displayUrl={background.displayUrl}
                  previewUrl={background.previewUrl}
                  currentType={background.currentType}
                  isUploading={background.isUploading}
                  isCustomUploaded={background.isCustomUploaded}
                  fileInputRef={background.fileInputRef}
                  onUrlChange={background.updateBgUrl}
                  onApply={() => { void background.applyBackground(); }}
                  onOpenFileDialog={background.openFileDialog}
                  onFileSelect={(e) => { void background.handleFileSelect(e); }}
                  getPreviewStyle={background.getPreviewStyle}
                />

                <div className="border-t border-[var(--border-color)] pt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Что поддерживается
                  </p>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-sm flex-shrink-0">🖼️</span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Изображение</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">Прямая ссылка или файл кнопкой выше</p>
                      <div className="flex flex-wrap gap-1">
                        {['JPG', 'PNG', 'WebP', 'GIF', 'AVIF'].map(f => (
                          <span key={f} className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center text-sm flex-shrink-0">🎬</span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Видео-фон</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">Ссылка на сервис или прямой файл</p>
                      <div className="flex flex-wrap gap-1">
                        {['YouTube', 'VK Video', 'Rutube', 'Twitch', 'Vimeo', 'Coub', '.mp4', '.webm'].map(name => (
                          <span key={name} className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md">{name}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">💡 Скорость и громкость — в параметрах фона</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center text-sm flex-shrink-0">🌐</span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">Веб-обои</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">HTML-страница — анимации, Wallpaper Engine</p>
                      <ol className="space-y-1">
                        {['Загрузите папку WE на хостинг', 'Вставьте URL файла index.html'].map((step, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]">
                            <span className="w-4 h-4 rounded-full bg-blue-500/15 text-blue-500 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                      <div className="flex flex-wrap gap-1">
                        {['Wallpaper Engine', 'CodePen', 'Shadertoy'].map(name => (
                          <span key={name} className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md">{name}</span>
                        ))}
                      </div>
                      <LinkButton
                        icon={<span>🌐</span>}
                        label={`Каталог обоев на ${SITE_HOST}`}
                        variant="vk"
                        onClick={() => window.open(WALLPAPERS_URL, '_blank')}
                      />
                    </div>
                  </div>

                </div>
              </div>
            )}

            {background.hasBackground && (
              <div className="pt-4 mt-4 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">⚙️</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Настройки отображения</span>
                </div>
                <BackgroundAdvancedSettings settings={settings} saveSetting={saveSetting} saveMultiple={saveMultiple} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default BackgroundSection;