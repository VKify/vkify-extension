import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, UploadIcon, ImageIcon, SpinnerIcon, CheckCircleIcon, VideoIcon, ClapperboardIcon, GlobeIcon } from '@/popup/components/icons/Icons.js';
import { parseVideoUrl } from '@/shared/videoEmbed.js';
import { PLATFORM_NAMES } from './constants.js';

interface UrlTypeIndicatorProps {
  url: string;
}

/** Распознаёт вставленный URL и подсказывает, как он будет применён. */
const UrlTypeIndicator = memo(function UrlTypeIndicator({ url }: UrlTypeIndicatorProps): React.ReactElement | null {
  const { t } = useTranslation('appearance');
  if (!url) return null;

  const embed = parseVideoUrl(url);
  if (embed) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <VideoIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] text-primary font-medium">
          {t('background.url_embed', { platform: PLATFORM_NAMES[embed.platform] ?? embed.platform })}
        </span>
      </div>
    );
  }

  const lower = url.toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm')) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <ClapperboardIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] text-primary font-medium">{t('background.url_direct_video')}</span>
      </div>
    );
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg">
        <GlobeIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-[11px] text-primary font-medium">{t('background.url_web')}</span>
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

/** Ввод фона своей ссылкой или загрузкой файла + превью изображения. */
const CustomUpload = memo(function CustomUpload({
  displayUrl, previewUrl, currentType, isUploading, isCustomUploaded,
  fileInputRef, onUrlChange, onApply, onOpenFileDialog, onFileSelect, getPreviewStyle,
}: CustomUploadProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="url"
            value={displayUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={t('background.url_placeholder')}
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
        <span className="text-xs text-[var(--text-tertiary)]">{t('background.or')}</span>
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
            <span className="text-sm text-primary font-medium">{t('background.uploading')}</span>
          </>
        ) : (
          <>
            <UploadIcon className="w-5 h-5 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)] font-medium">{t('background.upload_image')}</span>
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
          <span>{t('background.image_uploaded')}</span>
        </div>
      )}
    </div>
  );
});

export default CustomUpload;
