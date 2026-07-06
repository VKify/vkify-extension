import React, { memo, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import LinkButton from '../../ui/LinkButton.js';
import ResetButton from '../../ui/ResetButton.js';
import { ImageIcon, ChevronDownIcon, InfoIcon, VideoIcon, GlobeIcon, SettingsIcon, UploadIcon } from '../../icons/Icons.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useBackground } from '@/popup/hooks/features/useBackground.js';
import { WALLPAPERS_URL } from '@/popup/constants/links.js';
import { SITE_HOST } from '@/shared/constants/site.js';
import { createPresetWallpapers } from '@/popup/constants/appearance.js';
import type { WallpaperPreset } from '@/popup/constants/appearance.js';
import MediaCard from './background/MediaCard.js';
import type { MediaCardVariant } from './background/MediaCard.js';
import CustomUpload from './background/CustomUpload.js';
import BackgroundAdvancedSettings from './background/BackgroundAdvancedSettings.js';
import { TABS, TYPE_NAMES } from './background/constants.js';

interface BackgroundSectionProps {
  /** Рендер как тело отдельной страницы: без сворачиваемой карточки и шапки. */
  asPage?: boolean;
}

const BackgroundSection = memo(function BackgroundSection({ asPage = false }: BackgroundSectionProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const background = useBackground();
  const [isExpanded, setIsExpanded] = useState(false);
  const expanded = asPage || isExpanded;

  const presetWallpapers = useMemo(() => createPresetWallpapers(), []);

  const getVariant = useCallback((preset: WallpaperPreset): MediaCardVariant => {
    if (preset.type === 'video') return 'video';
    if (preset.type === 'web') return 'web';
    return 'image';
  }, []);

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}>
      {!asPage && (
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
            <span className="text-base font-semibold text-[var(--text-primary)] block leading-tight">{t('items.background.title')}</span>
            {background.hasBackground ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5
                ${background.currentType === 'video' ? 'bg-violet-500/15 text-violet-500' :
                  background.currentType === 'embed' ? 'bg-orange-500/15 text-orange-500' :
                  background.currentType === 'web'   ? 'bg-blue-500/15 text-blue-500' :
                                                       'bg-emerald-500/15 text-emerald-500'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {t(`background.types.${background.currentType}`, { defaultValue: TYPE_NAMES[background.currentType] ?? t('background.type_fallback') })}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--text-tertiary)]">{t('background.not_set')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {background.hasBackground && (
            <ResetButton onClick={(e) => { e.stopPropagation(); void background.clearBackground(); }} />
          )}
          <div className={`w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center transition-all duration-300 group-hover:bg-[var(--bg-tertiary)] ${isExpanded ? 'rotate-180 bg-primary/10' : ''}`}>
            <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
          </div>
        </div>
      </button>
      )}

      <div className={asPage ? '' : `grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className={asPage ? '' : 'overflow-hidden'}>
          <div className="px-4 pb-4">
            <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-xl mb-4 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => background.setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-medium rounded-lg transition-all
                    ${background.activeTab === tab.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab.iconId === 'custom' ? <UploadIcon className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                  {t(`background.tabs.${tab.id}`, { defaultValue: tab.label })}
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

                <div className="border-t border-[var(--border-color)] pt-3 space-y-2">
                  <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    {t('background.supported')}
                  </p>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0 text-emerald-500"><ImageIcon className="w-3.5 h-3.5" /></span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{t('background.image_title')}</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">{t('background.image_desc')}</p>
                      <div className="flex flex-wrap gap-1">
                        {['JPG', 'PNG', 'WebP', 'GIF', 'AVIF'].map(f => (
                          <span key={f} className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md">{f}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0 text-violet-500"><VideoIcon className="w-3.5 h-3.5" /></span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{t('background.video_title')}</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">{t('background.video_desc')}</p>
                      <div className="flex flex-wrap gap-1">
                        {['YouTube', 'VK Video', 'Rutube', 'Twitch', 'Vimeo', 'Coub', '.mp4', '.webm'].map(name => (
                          <span key={name} className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md">{name}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1"><InfoIcon className="w-3 h-3 flex-shrink-0" /> {t('background.video_note')}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 text-blue-500"><GlobeIcon className="w-3.5 h-3.5" /></span>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{t('background.web_title')}</p>
                    </div>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[11px] text-[var(--text-secondary)]">{t('background.web_desc')}</p>
                      <ol className="space-y-1">
                        {[t('background.web_step1'), t('background.web_step2')].map((step, i) => (
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
                        icon={<GlobeIcon className="w-4 h-4" />}
                        label={t('background.catalog', { host: SITE_HOST })}
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
                  <SettingsIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{t('background.display_settings')}</span>
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
