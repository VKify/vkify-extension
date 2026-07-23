import { useState, useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
import { useToast } from '../../context/ToastContext.js';
import {
  BACKGROUND_SETTINGS,
  BACKGROUND_FILTERS,
  BACKGROUND_EFFECTS,
} from '../../constants/appearance.js';
import { detectBackgroundType } from '@/shared/videoEmbed.js';
import {
  validateImage,
  getBase64Image,
  dataUrlByteSize,
  formatBytes,
} from '../../utils/imageToBase64.js';
import type { WallpaperPreset } from '../../constants/appearance.js';
import i18n from '@/popup/i18n.js';
import { isSafeBackgroundResource } from '@/shared/constants/settings-schema.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
// chrome.storage.local без unlimitedStorage держит ~10 МБ на всё хранилище,
// поэтому одну картинку ограничиваем 5 МБ (как и загрузку файлом).
const MAX_BG_BYTES = 5 * 1024 * 1024;

function isValidUrl(string: string): boolean {
  return isSafeBackgroundResource(string);
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
  // Фон зависит ровно от этих ключей — узкие подписки вместо всего settings.
  const backgroundType = useSetting<string | undefined>('background_type');
  const customBackground = useSetting<string | undefined>('custom_background');
  // Выбранный пресет определяем по id, а не по URL: картинки-пресеты сохраняются
  // в base64 (CSP VK режет прямой URL), поэтому сравнивать custom_background с URL
  // пресета больше нельзя.
  const backgroundPresetId = useSetting<string | undefined>('background_preset_id');
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const [bgUrl, setBgUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('presets');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentType = backgroundType || 'image';

  useEffect(() => {
    const savedBg = customBackground || '';
    setBgUrl(savedBg);
    setPreviewUrl(savedBg);
  }, [customBackground]);

  // Готовит картинку по стороннему URL к сохранению: конвертирует в base64, т.к.
  // прямой сторонний URL режет CSP VK. Возвращает data:-URL (успех), либо прямой
  // URL при CORS-фейле (с предупреждением), либо null при жёсткой ошибке/превышении
  // размера (тост уже показан). Используется и «своим URL», и пресетами.
  const resolveImageUrl = useCallback(async (url: string): Promise<string | null> => {
    const info = await validateImage(url);
    if (!info.valid) {
      showToast(i18n.t('appearance:background.toast.load_failed'), 'error');
      return null;
    }
    if (info.width > 3840) {
      showToast(i18n.t('appearance:background.toast.compressing'), 'warning');
    }
    try {
      const base64 = await getBase64Image(url, { maxWidth: 1920, quality: 0.85 });
      const size = dataUrlByteSize(base64);
      if (size > MAX_BG_BYTES) {
        showToast(i18n.t('appearance:background.toast.image_too_large', { size: formatBytes(size) }), 'error');
        return null;
      }
      return base64;
    } catch {
      // CORS не дал прочитать пиксели — оставляем прямой URL (как раньше).
      // На странице VK его может срезать CSP, поэтому честно предупреждаем.
      showToast(i18n.t('appearance:background.toast.cors_warning'), 'warning');
      return url;
    }
  }, [showToast]);

  const applyBackground = useCallback(async (): Promise<void> => {
    const url = bgUrl.trim();
    if (!url) {
      showToast(i18n.t('appearance:background.toast.enter_url'), 'error');
      return;
    }
    if (!isValidUrl(url)) {
      showToast(i18n.t('appearance:background.toast.invalid_url'), 'error');
      return;
    }

    const type = detectBackgroundType(url);

    // Видео/embed/web и уже готовые data:-URL сохраняем как есть.
    // Картинку по сторонней ссылке конвертируем в base64: прямой URL режет CSP VK.
    if (type !== 'image' || url.startsWith('data:')) {
      await saveMultiple({
        custom_background: url,
        background_type: type,
        background_preset_id: '',
      });
      setPreviewUrl(url);
      showToast(i18n.t('appearance:background.toast.installed', {
        type: i18n.t(`appearance:background.types.${type}`, {
          defaultValue: i18n.t('appearance:background.type_fallback'),
        }),
      }), 'success');
      return;
    }

    setIsUploading(true);
    try {
      const finalUrl = await resolveImageUrl(url);
      if (finalUrl === null) return;

      await saveMultiple({
        custom_background: finalUrl,
        background_type: 'image',
        background_preset_id: '',
      });
      setPreviewUrl(finalUrl);
      showToast(i18n.t('appearance:background.toast.image_installed'), 'success');
    } finally {
      setIsUploading(false);
    }
  }, [bgUrl, saveMultiple, showToast, resolveImageUrl]);

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
    showToast(i18n.t('appearance:background.toast.reset'), 'success');
  }, [saveMultiple, showToast]);

  const selectPreset = useCallback(async (preset: WallpaperPreset): Promise<void> => {
    const type = preset.type || 'image';
    const rawUrl = preset.value || preset.url || '';

    // Повторный клик по активному пресету — снимаем фон (сверка по id, не по URL).
    if (backgroundPresetId === preset.id) {
      await saveMultiple({
        custom_background: '',
        background_type: '',
        background_preset_id: '',
      });
      setBgUrl('');
      setPreviewUrl('');
      showToast(i18n.t('appearance:background.toast.removed'), 'success');
      return;
    }

    // Картинку-пресет (сторонний http-URL) конвертируем в base64 — иначе CSP VK
    // не даст применить фон. Градиенты/data:/видео/embed/web сохраняем как есть.
    let finalUrl = rawUrl;
    if (type === 'image' && /^https?:/i.test(rawUrl)) {
      setIsUploading(true);
      try {
        const resolved = await resolveImageUrl(rawUrl);
        if (resolved === null) return;   // жёсткая ошибка — тост уже показан
        finalUrl = resolved;
      } finally {
        setIsUploading(false);
      }
    }

    await saveMultiple({
      custom_background: finalUrl,
      background_type: type,
      background_preset_id: preset.id,
    });

    setBgUrl(finalUrl);
    setPreviewUrl(finalUrl);
    showToast(i18n.t('appearance:background.toast.preset_installed', {
      name: i18n.t(`appearance:background.wallpapers.${preset.id}`, { defaultValue: preset.name }),
    }), 'success');
  }, [backgroundPresetId, saveMultiple, showToast, resolveImageUrl]);

  const isPresetSelected = useCallback((preset: WallpaperPreset): boolean => {
    return backgroundPresetId === preset.id;
  }, [backgroundPresetId]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast(i18n.t('appearance:background.toast.choose_image'), 'error');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast(i18n.t('appearance:background.toast.file_too_large'), 'error');
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

      if (!isSafeBackgroundResource(base64)) {
        showToast(i18n.t('appearance:background.toast.choose_image'), 'error');
        return;
      }

      setBgUrl(base64);
      setPreviewUrl(base64);

      await saveMultiple({
        custom_background: base64,
        background_type: 'image',
        background_preset_id: '',
      });

      showToast(i18n.t('appearance:background.toast.uploaded'), 'success');
    } catch (error) {
      console.error('Image upload error:', error);
      showToast(i18n.t('appearance:background.toast.upload_failed'), 'error');
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
    hasBackground: Boolean(customBackground),
    isCustomUploaded: Boolean(customBackground?.startsWith('data:')),
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
