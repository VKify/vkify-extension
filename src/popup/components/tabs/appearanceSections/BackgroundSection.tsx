import React, { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import LinkButton from '../../ui/LinkButton.js';
import { ImageIcon, InfoIcon, VideoIcon, GlobeIcon, SettingsIcon, UploadIcon } from '../../icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useBackground } from '@/popup/hooks/features/useBackground.js';
import { WALLPAPERS_URL, WEB_WALLPAPER_GUIDE_URL, VIDEO_WALLPAPERS_URL, PHOTO_WALLPAPERS_URL } from '@/popup/constants/links.js';
import { createPresetWallpapers } from '@/popup/constants/appearance.js';
import type { WallpaperPreset } from '@/popup/constants/appearance.js';
import MediaCard from './background/MediaCard.js';
import type { MediaCardVariant } from './background/MediaCard.js';
import CustomUpload from './background/CustomUpload.js';
import BackgroundAdvancedSettings from './background/BackgroundAdvancedSettings.js';
import WallpaperPropertiesSettings from './background/WallpaperPropertiesSettings.js';
import { TABS } from './background/constants.js';

const BackgroundSection = memo(function BackgroundSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const background = useBackground();

  const presetWallpapers = useMemo(() => createPresetWallpapers(), []);

  const getVariant = useCallback((preset: WallpaperPreset): MediaCardVariant => {
    if (preset.type === 'video') return 'video';
    if (preset.type === 'web') return 'web';
    return 'image';
  }, []);

  return (
    <section aria-label={t('items.background.title')} className="dashboard-panel py-4">
          <div className="px-4">
            <div role="group" aria-label={t('items.background.title')} className="dashboard-segments mb-4">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={background.activeTab === tab.id}
                  onClick={() => background.setActiveTab(tab.id)}
                  disabled={tab.id === 'settings' && !background.hasBackground}
                  className="dashboard-segments__item disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {tab.iconId === 'custom' ? <UploadIcon className="w-3.5 h-3.5" /> : tab.iconId === 'settings' ? <SettingsIcon className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {t(`background.tabs.${tab.id}`, { defaultValue: tab.label })}
                </button>
              ))}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <LinkButton
                icon={<ImageIcon className="w-4 h-4" />}
                label={t('background.photo_wallpapers')}
                variant="vk"
                onClick={() => window.open(PHOTO_WALLPAPERS_URL, '_blank', 'noopener,noreferrer')}
              />
              <LinkButton
                icon={<VideoIcon className="w-4 h-4" />}
                label={t('background.video_wallpapers')}
                variant="vk"
                onClick={() => window.open(VIDEO_WALLPAPERS_URL, '_blank', 'noopener,noreferrer')}
              />
            </div>

            {background.activeTab === 'presets' && (
              presetWallpapers.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
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
                  <LinkButton
                    icon={<GlobeIcon className="w-4 h-4" />}
                    label={t('background.catalog_short')}
                    variant="vk"
                    onClick={() => window.open(WALLPAPERS_URL, '_blank')}
                  />
                </div>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] text-center py-6">{t('background.presets_not_found')}</p>
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

                <div className="border-t border-[var(--border-color)] pt-3 space-y-3">
                  <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    {t('background.supported')}
                  </p>
                  <div className="rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                    <p className="flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5 flex-none text-primary" />{t('background.supported_images')}</p>
                    <p className="flex items-center gap-2"><VideoIcon className="w-3.5 h-3.5 flex-none text-primary" />{t('background.supported_video')}</p>
                    <p className="flex items-center gap-2"><GlobeIcon className="w-3.5 h-3.5 flex-none text-primary" />{t('background.supported_web')}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <LinkButton
                      icon={<GlobeIcon className="w-4 h-4" />}
                      label={t('background.catalog_short')}
                      variant="vk"
                      onClick={() => window.open(WALLPAPERS_URL, '_blank')}
                    />
                    <LinkButton
                      icon={<InfoIcon className="w-4 h-4" />}
                      label={t('background.web_guide_short')}
                      onClick={() => window.open(WEB_WALLPAPER_GUIDE_URL, '_blank')}
                    />
                  </div>
                </div>
              </div>
            )}

            {background.activeTab === 'settings' && background.hasBackground && (
              <div className="space-y-3">
                <WallpaperPropertiesSettings settings={settings} saveSetting={saveSetting} />
                <div className="pt-3 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-2 mb-3">
                  <SettingsIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{t('background.display_settings')}</span>
                </div>
                <BackgroundAdvancedSettings settings={settings} saveSetting={saveSetting} saveMultiple={saveMultiple} />
                </div>
              </div>
            )}
          </div>
    </section>
  );
});

export default BackgroundSection;
