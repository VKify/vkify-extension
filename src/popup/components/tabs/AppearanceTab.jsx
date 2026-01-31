import React, { useState, useEffect, useRef } from 'react';
import SettingRow from '../ui/SettingRow';
import RangeSlider from '../ui/RangeSlider';
import ColorPicker from '../ui/ColorPicker';
import { MonitorIcon, SidebarIcon, SearchIcon, ImageIcon, CheckIcon, XIcon } from '../icons/Icons';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';

// Иконка загрузки
const UploadIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

// Получаем URL для ресурсов расширения
const getExtensionUrl = (path) => {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  // Fallback
  return `/${path}`;
};

// Предустановленные обои
const PRESET_WALLPAPERS = [
  {
    id: 'image-1',
    name: 'Горы',
    type: 'image',
    value: getExtensionUrl('wallpapers/mountains.jpg'),
    preview: getExtensionUrl('wallpapers/mountains_thumb.jpg')
  },
  {
    id: 'image-2',
    name: 'Космос',
    type: 'image',
    value: getExtensionUrl('wallpapers/space.jpg'),
    preview: getExtensionUrl('wallpapers/space_thumb.jpg')
  },
  {
    id: 'image-3',
    name: 'Море',
    type: 'image',
    value: getExtensionUrl('wallpapers/sea.jpg'),
    preview: getExtensionUrl('wallpapers/sea_thumb.jpg')
  },
  {
    id: 'image-4',
    name: 'Лес',
    type: 'image',
    value: getExtensionUrl('wallpapers/forest.jpg'),
    preview: getExtensionUrl('wallpapers/forest_thumb.jpg')
  },
  {
    id: 'image-5',
    name: 'Город',
    type: 'image',
    value: getExtensionUrl('wallpapers/city.jpg'),
    preview: getExtensionUrl('wallpapers/city_thumb.jpg')
  },
  {
    id: 'image-6',
    name: 'Пустыня',
    type: 'image',
    value: getExtensionUrl('wallpapers/desert.jpg'),
    preview: getExtensionUrl('wallpapers/desert_thumb.jpg')
  },
];

export default function AppearanceTab() {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();
  const [bgUrl, setBgUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('presets'); // 'presets' | 'custom'
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedBg = settings.custom_background || '';
    setBgUrl(savedBg);
    setPreviewUrl(savedBg);
  }, [settings.custom_background]);

  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:';
    } catch {
      return false;
    }
  };

  const handleApplyBackground = async () => {
    const url = bgUrl.trim();
    if (!url) {
      showToast('Введите URL изображения', 'error');
      return;
    }
    if (!isValidUrl(url)) {
      showToast('Неверный формат URL', 'error');
      return;
    }
    await saveSetting('custom_background', url);
    await saveSetting('background_type', 'image');
    setPreviewUrl(url);
    showToast('Фон установлен', 'success');
  };

  const handleClearBackground = async () => {
    setBgUrl('');
    setPreviewUrl('');
    await saveSetting('custom_background', '');
    await saveSetting('background_type', '');
    showToast('Фон сброшен', 'success');
  };

  // Применить предустановленный фон
  const handleSelectPreset = async (preset) => {
    await saveSetting('custom_background', preset.value);
    await saveSetting('background_type', preset.type);
    setBgUrl(preset.value);
    setPreviewUrl(preset.value);
    showToast(`Фон "${preset.name}" установлен`, 'success');
  };

  // Проверка, выбран ли пресет
  const isPresetSelected = (preset) => {
    return settings.custom_background === preset.value;
  };

  // Загрузка файла
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Выберите изображение', 'error');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Файл слишком большой (макс. 5MB)', 'error');
      return;
    }

    setIsUploading(true);

    try {
      const base64 = await fileToBase64(file);
      setBgUrl(base64);
      setPreviewUrl(base64);
      await saveSetting('custom_background', base64);
      await saveSetting('background_type', 'image');
      showToast('Фон загружен', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Ошибка загрузки', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Определяем стиль для предпросмотра
  const getPreviewStyle = () => {
    if (!previewUrl) return {};
    
    if (previewUrl.startsWith('linear-gradient')) {
      return { background: previewUrl };
    }
    return {
      backgroundImage: `url(${previewUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  };

  return (
    <div className="space-y-4">
      {/* Режим отображения */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">🖥️</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Режим отображения</h3>
        </div>

        <SettingRow
          id="style_widescreen"
          title="Расширенный режим"
          description="Контент на всю ширину экрана"
          icon={<MonitorIcon className="w-5 h-5" />}
          iconColor="blue"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="minimalistic_sidebar"
          title="Компактное меню"
          description="Узкая боковая панель с иконками"
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="purple"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="fixed_sidebar"
          title="Фиксированное меню"
          description="Меню остаётся на месте при прокрутке"
          icon={<SidebarIcon className="w-5 h-5" />}
          iconColor="green"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="collapse_search"
          title="Свернуть поиск"
          description="Поле поиска сворачивается в иконку"
          icon={<SearchIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      {/* Настройки размеров */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📐</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Размеры</h3>
        </div>

        <RangeSlider
          id="content_width"
          label="Ширина контента"
          value={settings.content_width || 0}
          min={0}
          max={2500}
          step={50}
          unit="px"
          zeroLabel="Авто"
          onChange={(value) => saveSetting('content_width', value)}
        />

        <div className="my-4 border-t border-[var(--border-color)]" />

        <RangeSlider
          id="border_radius"
          label="Скругление углов"
          value={settings.border_radius || 0}
          min={0}
          max={24}
          step={2}
          unit="px"
          zeroLabel="По умолчанию"
          onChange={(value) => saveSetting('border_radius', value)}
        />
      </section>

      {/* Акцентный цвет */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Цветовая тема</h3>
          </div>
          {settings.custom_accent && (
            <span 
              className="w-6 h-6 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: settings.custom_accent }}
            />
          )}
        </div>
        
        <ColorPicker
          value={settings.custom_accent || ''}
          onChange={(color) => saveSetting('custom_accent', color)}
        />
      </section>

      {/* Фон */}
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖼️</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Фон</h3>
          </div>
          
          {/* Кнопка сброса если есть фон */}
          {settings.custom_background && (
            <button
              onClick={handleClearBackground}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-error bg-[var(--bg-secondary)] hover:bg-error/10 rounded-lg transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
              Сбросить
            </button>
          )}
        </div>

        {/* Табы выбора способа */}
        <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl mb-4">
          <button
            onClick={() => setActiveTab('presets')}
            className={`
              flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'presets'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
            `}
          >
            🎭 Готовые
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`
              flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all
              ${activeTab === 'custom'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}
            `}
          >
            📤 Свой
          </button>
        </div>

        {/* Контент табов */}
        {activeTab === 'presets' ? (
          /* Галерея предустановленных обоев */
          <div className="space-y-4">
            {/* Изображения */}
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Изображения</p>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_WALLPAPERS.filter(w => w.type === 'image').map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`
                      relative aspect-[16/10] rounded-xl overflow-hidden transition-all
                      hover:scale-[1.02] active:scale-[0.98]
                      ${isPresetSelected(preset) 
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--bg-primary)]' 
                        : 'hover:ring-2 hover:ring-[var(--border-color)]'}
                    `}
                    title={preset.name}
                  >
                    <img 
                      src={preset.preview} 
                      alt={preset.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-end p-1.5 bg-gradient-to-t from-black/40 to-transparent">
                      <span className="text-[10px] font-medium text-white drop-shadow-lg">
                        {preset.name}
                      </span>
                    </div>
                    {isPresetSelected(preset) && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Свой фон */
          <div className="space-y-3">
            {/* URL ввод */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={bgUrl.startsWith('data:') || bgUrl.startsWith('linear-gradient') ? '' : bgUrl}
                  onChange={(e) => {
                    setBgUrl(e.target.value);
                    if (e.target.value && isValidUrl(e.target.value)) {
                      setPreviewUrl(e.target.value);
                    }
                  }}
                  placeholder="Вставьте ссылку на изображение"
                  className="w-full pl-10 pr-3 py-2.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <button
                onClick={handleApplyBackground}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm active:scale-95"
                title="Применить URL"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Разделитель */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-[var(--border-color)]" />
              <span className="text-xs text-[var(--text-tertiary)]">или</span>
              <div className="flex-1 border-t border-[var(--border-color)]" />
            </div>

            {/* Кнопка загрузки файла */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`
                w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed
                transition-all active:scale-[0.98]
                ${isUploading 
                  ? 'border-primary/50 bg-primary/5 cursor-wait' 
                  : 'border-[var(--border-color)] hover:border-primary hover:bg-primary/5 cursor-pointer'}
              `}
            >
              {isUploading ? (
                <>
                  <svg className="w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <span className="text-sm text-primary font-medium">Загрузка...</span>
                </>
              ) : (
                <>
                  <UploadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                  <span className="text-sm text-[var(--text-secondary)] font-medium">Загрузить с устройства</span>
                </>
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Предпросмотр для кастомного фона */}
            {previewUrl && !previewUrl.startsWith('linear-gradient') && (
              <div
                className="h-24 rounded-xl border-2 border-primary/30 border-solid overflow-hidden"
                style={getPreviewStyle()}
              />
            )}

            {/* Индикатор что фон загружен с устройства */}
            {settings.custom_background?.startsWith('data:') && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>Изображение загружено с устройства</span>
              </div>
            )}
          </div>
        )}

        {/* Настройки фона */}
        {settings.custom_background && (
          <div className="space-y-4 pt-4 mt-4 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚙️</span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">Настройки отображения</span>
            </div>

            <RangeSlider
              id="background_blur"
              label="Размытие"
              value={settings.background_blur ?? 8}
              min={0}
              max={30}
              step={1}
              unit="px"
              zeroLabel="Без размытия"
              onChange={(value) => saveSetting('background_blur', value)}
            />

            <RangeSlider
              id="background_dim"
              label="Затемнение"
              value={settings.background_dim ?? 30}
              min={0}
              max={80}
              step={5}
              unit="%"
              zeroLabel="Без затемнения"
              onChange={(value) => saveSetting('background_dim', value)}
            />

            <RangeSlider
              id="background_opacity"
              label="Прозрачность"
              value={settings.background_opacity ?? 100}
              min={20}
              max={100}
              step={5}
              unit="%"
              onChange={(value) => saveSetting('background_opacity', value)}
            />
          </div>
        )}
      </section>
    </div>
  );
}