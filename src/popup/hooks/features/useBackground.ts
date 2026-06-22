import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import {
  BACKGROUND_SETTINGS,
  BACKGROUND_FILTERS,
  BACKGROUND_EFFECTS,
} from '../../constants/appearance.js';
import { detectBackgroundType } from '@/shared/videoEmbed.js';
import type { WallpaperPreset } from '../../constants/appearance.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
  image: '🖼️ Изображение',
  video: '🎬 Видео',
  embed: '📺 Видео (embed)',
  web: '🌐 Веб-обои',
};

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return ['http:', 'https:', 'data:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export interface BackgroundHook {
  bgUrl: string;
  displayUrl: string;
  previewUrl: string;
  isUploading: boolean;
  activeTab: string;
  currentType: string;
  hasBackground: boolean;
  isCustomUploaded: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  setActiveTab: (tab: string) => void;
  updateBgUrl: (value: string) => void;
  applyBackground: () => Promise<void>;
  clearBackground: () => Promise<void>;
  selectPreset: (preset: WallpaperPreset) => Promise<void>;
  isPresetSelected: (preset: WallpaperPreset) => boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  openFileDialog: () => void;
  getPreviewStyle: () => React.CSSProperties;
}

export function useBackground(): BackgroundHook {
  const { settings, saveMultiple } = useSettings();
  const { showToast } = useToast();

  const [bgUrl, setBgUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('presets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentType = (settings['background_type'] as string) || 'image';

  useEffect(() => {
    const savedBg = (settings['custom_background'] as string) || '';
    setBgUrl(savedBg);
    setPreviewUrl(savedBg);
  }, [settings['custom_background']]);

  const applyBackground = useCallback(async (): Promise<void> => {
    const url = bgUrl.trim();
    if (!url) {
      showToast('Введите URL', 'error');
      return;
    }
    if (!isValidUrl(url)) {
      showToast('Неверный формат URL', 'error');
      return;
    }

    const type = detectBackgroundType(url);

    await saveMultiple({
      custom_background: url,
      background_type: type,
      background_preset_id: '',
    });

    setPreviewUrl(url);
    showToast(`${TYPE_LABELS[type] || 'Фон'} установлено`, 'success');
  }, [bgUrl, saveMultiple, showToast]);

  const clearBackground = useCallback(async (): Promise<void> => {
    setBgUrl('');
    setPreviewUrl('');

    const resetData: Record<string, unknown> = {
      custom_background: '',
      background_type: '',
      background_preset_id: '',
      background_overlay_color: '',
      background_overlay_opacity: 0,
      background_position: 'center',
      background_size: 'cover',
      background_video_speed: 100,
      background_video_volume: 0,
    };

    for (const setting of [...BACKGROUND_SETTINGS, ...BACKGROUND_FILTERS, ...BACKGROUND_EFFECTS]) {
      resetData[setting.id] = setting.defaultValue;
    }

    await saveMultiple(resetData);
    showToast('Фон сброшен', 'success');
  }, [saveMultiple, showToast]);

  const selectPreset = useCallback(async (preset: WallpaperPreset): Promise<void> => {
    const type = preset.type || 'image';
    const url = preset.value || preset.url;

    if (settings['custom_background'] === url) {
      await saveMultiple({
        custom_background: '',
        background_type: '',
        background_preset_id: '',
      });
      setBgUrl('');
      setPreviewUrl('');
      showToast('Фон убран', 'success');
      return;
    }

    await saveMultiple({
      custom_background: url,
      background_type: type,
      background_preset_id: preset.id,
    });

    setBgUrl(url ?? '');
    setPreviewUrl(url ?? '');
    showToast(`Фон "${preset.name}" установлен`, 'success');
  }, [settings, saveMultiple, showToast]);

  const isPresetSelected = useCallback((preset: WallpaperPreset): boolean => {
    const url = preset.value || preset.url;
    return settings['custom_background'] === url;
  }, [settings]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Выберите изображение', 'error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast('Файл слишком большой (макс. 5MB)', 'error');
      return;
    }

    setIsUploading(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setBgUrl(base64);
      setPreviewUrl(base64);

      await saveMultiple({
        custom_background: base64,
        background_type: 'image',
        background_preset_id: '',
      });

      showToast('Фон загружен', 'success');
    } catch (error) {
      console.error('Image upload error:', error);
      showToast('Ошибка загрузки', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [saveMultiple, showToast]);

  const openFileDialog = useCallback((): void => {
    fileInputRef.current?.click();
  }, []);

  const updateBgUrl = useCallback((value: string): void => {
    setBgUrl(value);
    if (value && isValidUrl(value)) {
      setPreviewUrl(value);
    }
  }, []);

  const getPreviewStyle = useCallback((): React.CSSProperties => {
    if (!previewUrl) return {};

    if (previewUrl.startsWith('linear-gradient')) {
      return { background: previewUrl };
    }

    if (currentType === 'video' || currentType === 'embed') {
      return { background: '#1a1a2e' };
    }

    return {
      backgroundImage: `url(${previewUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }, [previewUrl, currentType]);

  const displayUrl = (() => {
    if (!bgUrl) return '';
    if (bgUrl.startsWith('data:')) return '';
    if (bgUrl.startsWith('linear-gradient')) return '';
    return bgUrl;
  })();

  return {
    bgUrl,
    displayUrl,
    previewUrl,
    isUploading,
    activeTab,
    currentType,
    hasBackground: Boolean(settings['custom_background']),
    isCustomUploaded: Boolean((settings['custom_background'] as string)?.startsWith('data:')),
    fileInputRef,
    setActiveTab,
    updateBgUrl,
    applyBackground,
    clearBackground,
    selectPreset,
    isPresetSelected,
    handleFileSelect,
    openFileDialog,
    getPreviewStyle,
  };
}