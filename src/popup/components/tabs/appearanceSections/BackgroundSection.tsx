import React, { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LinkButton from '../../ui/LinkButton.js';
import Modal from '../../ui/Modal.js';
import { DashboardNavItem } from '../../ui/DashboardPrimitives.js';
import { ImageIcon, InfoIcon, VideoIcon, GlobeIcon, SettingsIcon, UploadIcon, ClockIcon } from '../../icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useBackground } from '@/popup/hooks/features/useBackground.js';
import { WALLPAPERS_URL, WEB_WALLPAPER_GUIDE_URL } from '@/popup/constants/links.js';
import CustomUpload from './background/CustomUpload.js';
import BackgroundAdvancedSettings from './background/BackgroundAdvancedSettings.js';
import WallpaperPropertiesSettings from './background/WallpaperPropertiesSettings.js';
import WallpaperScheduleSettings from './background/WallpaperScheduleSettings.js';
import WallpaperCatalog from './background/WallpaperCatalog.js';
import { TABS } from './background/constants.js';
import type { WallpaperPeriod } from '@/shared/wallpaper-schedule.js';

const BackgroundSection = memo(function BackgroundSection(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const [selectedPeriod, setSelectedPeriod] = useState<WallpaperPeriod | null>(null);
  const [sourcePeriod, setSourcePeriod] = useState<WallpaperPeriod | null>(null);
  const onWallpaperSaved = useCallback(() => setSelectedPeriod(null), []);
  const background = useBackground({ period: selectedPeriod, onSaved: onWallpaperSaved });

  return (
    <section aria-label={t('items.background.title')} className="dashboard-panel py-4">
          <div className="px-4">
            <div role="group" aria-label={t('items.background.title')} className="dashboard-segments mb-4 !grid grid-cols-3 min-[480px]:grid-cols-5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={background.activeTab === tab.id}
                  onClick={() => {
                    if (tab.id === 'schedule' || tab.id === 'settings') setSelectedPeriod(null);
                    background.setActiveTab(tab.id);
                  }}
                  disabled={tab.id === 'settings' && !background.hasBackground}
                  className="dashboard-segments__item disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {tab.iconId === 'custom' ? <UploadIcon className="w-3.5 h-3.5 shrink-0" /> : tab.iconId === 'settings' ? <SettingsIcon className="w-3.5 h-3.5 shrink-0" /> : tab.iconId === 'schedule' ? <ClockIcon className="w-3.5 h-3.5 shrink-0" /> : tab.iconId === 'videos' ? <VideoIcon className="w-3.5 h-3.5 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
                  {t(`background.tabs.${tab.id}`, { defaultValue: tab.label })}
                </button>
              ))}
            </div>

            {background.activeTab === 'schedule' && <WallpaperScheduleSettings onChoose={setSourcePeriod} />}

            {sourcePeriod && <Modal onClose={() => setSourcePeriod(null)}
              title={t('background.schedule.choosing', { period: t(`background.schedule.${sourcePeriod}`) })}
              ariaLabel={t('background.schedule.choosing', { period: t(`background.schedule.${sourcePeriod}`) })}>
              <div className="p-4 space-y-2">
                {(['photos', 'videos', 'custom'] as const).map(source => <DashboardNavItem key={source}
                  title={t(`background.schedule.source_${source}`)}
                  description={t(`background.schedule.source_${source}_hint`)}
                  icon={source === 'custom' ? <UploadIcon className="h-5 w-5" /> : source === 'videos' ? <VideoIcon className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                  onClick={() => {
                    setSelectedPeriod(sourcePeriod);
                    setSourcePeriod(null);
                    background.setActiveTab(source);
                  }} />)}
              </div>
            </Modal>}

            {selectedPeriod && (
              <div className="mb-4 rounded-xl bg-primary/10 p-3 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <strong className="text-primary">{t('background.schedule.choosing', { period: t(`background.schedule.${selectedPeriod}`) })}</strong>
                <button type="button" disabled={background.isUploading} className="shrink-0 font-semibold text-primary disabled:opacity-40" onClick={() => { setSelectedPeriod(null); background.setActiveTab('schedule'); }}>{t('background.schedule.cancel')}</button>
              </div>
            )}

            {settings.wallpaper_schedule_enabled === true && !selectedPeriod && background.activeTab !== 'schedule' && (
              <div className="mb-4 rounded-xl bg-primary/10 p-3 flex items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                <span>{t('background.schedule.priority')}</span>
                <button type="button" className="shrink-0 font-semibold text-primary" onClick={() => void saveSetting('wallpaper_schedule_enabled', false)}>{t('background.schedule.pause')}</button>
              </div>
            )}

            {(background.activeTab === 'photos' || background.activeTab === 'videos') && <WallpaperCatalog
              key={background.activeTab} kind={background.activeTab}
              onSelect={background.selectWallpaper} isSelected={background.isWallpaperSelected} />}

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
                <BackgroundAdvancedSettings settings={settings} saveSetting={saveSetting} saveMultiple={saveMultiple} />
                </div>
              </div>
            )}
          </div>
    </section>
  );
});

export default BackgroundSection;
