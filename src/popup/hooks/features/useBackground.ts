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
import type { WallpaperSelection } from '@/shared/wallpaper-catalog.js';
import i18n from '@/popup/i18n.js';
import { isSafeBackgroundResource } from '@/shared/constants/settings-schema.js';
import { deriveWebWallpaperId } from '@/shared/wallpaper-properties.js';
import { captureWallpaper, manualWallpaperPatch, parseWallpaperSchedule, type WallpaperPeriod } from '@/shared/wallpaper-schedule.js';

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
  selectWallpaper: (wallpaper: WallpaperSelection) => Promise<void>;
  isWallpaperSelected: (wallpaper: WallpaperSelection) => boolean;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  openFileDialog: () => void;
  getPreviewStyle: () => React.CSSProperties;
}

export function useBackground(options: { period?: WallpaperPeriod | null; onSaved?: () => void } = {}): BackgroundHook {
  const { period, onSaved } = options;
  // Фон зависит ровно от этих ключей — узкие подписки вместо всего settings.
  const backgroundType = useSetting<string | undefined>('background_type');
  const customBackground = useSetting<string | undefined>('custom_background');
  // Выбранные обои определяем по id: фото сохраняется в base64, а не по URL.
  // Существующий ключ storage также используется каталогом и расписанием.
  const selectedWallpaperId = useSetting<string | undefined>('background_preset_id');
  const scheduleEnabled = useSetting<boolean>('wallpaper_schedule_enabled');
  const scheduleValue = useSetting<string>('wallpaper_schedule');
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();

  const [bgUrl, setBgUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('photos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentType = period ? parseWallpaperSchedule(scheduleValue)[period]?.type || detectBackgroundType(bgUrl) : backgroundType || 'image';

  const saveWallpaper = useCallback(async (patch: Record<string, unknown>): Promise<void> => {
    if (period) {
      const wallpaper = captureWallpaper(patch);
      if (!wallpaper) throw new Error('Invalid wallpaper');
      const currentSettings = useVKifyStore.getState().settings;
      const schedule = parseWallpaperSchedule(currentSettings.wallpaper_schedule);
      await saveMultiple({ wallpaper_schedule: JSON.stringify({ ...schedule, [period]: wallpaper }) });
      showToast(i18n.t('appearance:background.schedule.saved', { period: i18n.t(`appearance:background.schedule.${period}`) }), 'success');
      setActiveTab('schedule');
      onSaved?.();
    } else {
      await saveMultiple(manualWallpaperPatch(patch));
    }
  }, [period, onSaved, saveMultiple, showToast]);
  const notifyApplied = useCallback((key: string, args?: Record<string, string>): void => {
    if (!period) showToast(i18n.t(key, args), 'success');
  }, [period, showToast]);

  // The header reset uses a separate hook instance; follow the stored background.
  useEffect(() => {
    if (!customBackground && activeTab === 'settings') setActiveTab('photos');
  }, [customBackground, activeTab]);

  useEffect(() => {
    const savedBg = period ? parseWallpaperSchedule(scheduleValue)[period]?.url || '' : customBackground || '';
    setBgUrl(savedBg);
    setPreviewUrl(savedBg);
  }, [customBackground, period, scheduleValue]);

  // Готовит картинку по стороннему URL к сохранению: конвертирует в base64, т.к.
  // прямой сторонний URL режет CSP VK. Возвращает data:-URL (успех), либо прямой
  // URL при CORS-фейле (с предупреждением), либо null при жёсткой ошибке/превышении
  // размера (тост уже показан). Используется и «своим URL», и каталогом.
  const resolveImageUrl = useCallback(async (url: string, preserveOriginal = false): Promise<string | null> => {
    const info = await validateImage(url);
    if (!info.valid) {
      showToast(i18n.t('appearance:background.toast.load_failed'), 'error');
      return null;
    }
    if (!preserveOriginal && info.width > 3840) {
      showToast(i18n.t('appearance:background.toast.compressing'), 'warning');
    }
    try {
      const base64 = await getBase64Image(url, { maxWidth: 1920, quality: 0.85, preserveOriginal });
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
      await saveWallpaper({
        custom_background: url,
        background_type: type,
        background_preset_id: '',
        web_wallpaper_id: type === 'web' ? deriveWebWallpaperId(url) : '',
        web_wallpaper_schema: '[]',
      });
      setPreviewUrl(url);
      notifyApplied('appearance:background.toast.installed', {
        type: i18n.t(`appearance:background.types.${type}`, {
          defaultValue: i18n.t('appearance:background.type_fallback'),
        }),
      });
      return;
    }

    setIsUploading(true);
    try {
      const finalUrl = await resolveImageUrl(url);
      if (finalUrl === null) return;

      await saveWallpaper({
        custom_background: finalUrl,
        background_type: 'image',
        background_preset_id: '',
        web_wallpaper_id: '',
        web_wallpaper_schema: '[]',
      });
      setPreviewUrl(finalUrl);
      notifyApplied('appearance:background.toast.image_installed');
    } finally {
      setIsUploading(false);
    }
  }, [bgUrl, saveWallpaper, showToast, resolveImageUrl, notifyApplied]);

  const clearBackground = useCallback(async (): Promise<void> => {
    setBgUrl('');
    setPreviewUrl('');

    const resetData: Record<string, unknown> = {
      wallpaper_schedule_enabled: false,
      custom_background: '',
      background_type: '',
      background_preset_id: '',
      background_overlay_color: '',
      background_overlay_opacity: 0,
      background_position: 'center',
      background_size: 'cover',
      background_video_speed: 100,
      background_video_volume: 0,
      web_wallpaper_id: '',
      web_wallpaper_schema: '[]',
    };

    for (const setting of [...BACKGROUND_SETTINGS, ...BACKGROUND_FILTERS, ...BACKGROUND_EFFECTS]) {
      resetData[setting.id] = setting.defaultValue;
    }

    await saveMultiple(resetData);
    showToast(i18n.t('appearance:background.toast.reset'), 'success');
  }, [saveMultiple, showToast]);

  const selectWallpaper = useCallback(async (wallpaper: WallpaperSelection): Promise<void> => {
    const type = wallpaper.type;
    const rawUrl = wallpaper.url;

    // Повторный клик по активным обоям снимает фон (сверка по id, не по URL).
    if (!period && !scheduleEnabled && selectedWallpaperId === wallpaper.id) {
      await saveWallpaper({
        custom_background: '',
        background_type: '',
        background_preset_id: '',
        web_wallpaper_id: '',
        web_wallpaper_schema: '[]',
      });
      setBgUrl('');
      setPreviewUrl('');
      showToast(i18n.t('appearance:background.toast.removed'), 'success');
      return;
    }

    // Фото сохраняем в base64 для CSP VK; ссылку на видеоплеер — как есть.
    let finalUrl = rawUrl;
    if (type === 'image' && /^https?:/i.test(rawUrl)) {
      setIsUploading(true);
      try {
        const resolved = await resolveImageUrl(rawUrl, wallpaper.preserveOriginal);
        if (resolved === null) return;   // жёсткая ошибка — тост уже показан
        finalUrl = resolved;
      } finally {
        setIsUploading(false);
      }
    }

    await saveWallpaper({
      custom_background: finalUrl,
      background_type: type,
      background_preset_id: wallpaper.id,
      web_wallpaper_id: '',
      web_wallpaper_schema: '[]',
    });

    setBgUrl(finalUrl);
    setPreviewUrl(finalUrl);
    notifyApplied('appearance:background.toast.wallpaper_installed', {
      name: wallpaper.name,
    });
  }, [selectedWallpaperId, saveWallpaper, showToast, resolveImageUrl, period, scheduleEnabled, notifyApplied]);

  const isWallpaperSelected = useCallback((wallpaper: WallpaperSelection): boolean => {
    if (period) return parseWallpaperSchedule(scheduleValue)[period]?.presetId === wallpaper.id;
    return !scheduleEnabled && selectedWallpaperId === wallpaper.id;
  }, [selectedWallpaperId, period, scheduleValue, scheduleEnabled]);

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

      await saveWallpaper({
        custom_background: base64,
        background_type: 'image',
        background_preset_id: '',
        web_wallpaper_id: '',
        web_wallpaper_schema: '[]',
      });

      notifyApplied('appearance:background.toast.uploaded');
    } catch (error) {
      console.error('Image upload error:', error);
      showToast(i18n.t('appearance:background.toast.upload_failed'), 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [saveWallpaper, showToast, notifyApplied]);

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
    isCustomUploaded: Boolean((period ? previewUrl : customBackground)?.startsWith('data:')),
    fileInputRef,
    setActiveTab,
    updateBgUrl,
    applyBackground,
    clearBackground,
    selectWallpaper,
    isWallpaperSelected,
    handleFileSelect,
    openFileDialog,
    getPreviewStyle,
  };
}
