import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, PlayIconFilled, VideoIcon, GlobeIcon, ImageIcon } from '@/popup/components/icons/Icons.js';
import type { WallpaperPreset } from '@/popup/constants/appearance.js';

export type MediaCardVariant = 'image' | 'video' | 'web';

interface MediaCardProps {
  preset: WallpaperPreset;
  isSelected: boolean;
  onSelect: (preset: WallpaperPreset) => void;
  variant?: MediaCardVariant;
}

/** Карточка пресета-обоев: превью с зумом, бейдж типа, play-иконка для видео. */
const MediaCard = memo(function MediaCard({ preset, isSelected, onSelect, variant = 'image' }: MediaCardProps): React.ReactElement {
  const { t } = useTranslation('appearance');
  const name = t(`background.wallpapers.${preset.id}`, { defaultValue: preset.name });
  const [failedSource, setFailedSource] = useState<string>();
  const failed = failedSource === preset.preview;
  return (
    <button
      onClick={() => onSelect(preset)}
      aria-label={name}
      aria-pressed={isSelected}
      className={`group relative w-full aspect-[16/8] rounded-xl overflow-hidden border
        ${isSelected
          ? 'border-primary ring-1 ring-primary'
          : 'border-[var(--dashboard-item-border)] hover:border-primary/40'
        }`}
    >
      {/* Картинка с зумом при наведении */}
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg-secondary)] px-4 pb-5 text-[var(--text-secondary)]">
          <ImageIcon className="h-7 w-7" />
          <span className="text-xs">{t('background.preview_unavailable')}</span>
        </div>
      ) : <img
        src={preset.preview}
        alt=""
        onError={() => setFailedSource(preset.preview)}
        className="absolute inset-0 w-full h-full object-cover"
        decoding="sync"
        draggable={false}
      />}

      {/* Затемнение при hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />

      {/* Кнопка воспроизведения для видео */}
      {variant === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
            <PlayIconFilled className="w-3.5 h-3.5 text-white ml-0.5" />
          </div>
        </div>
      )}

      {/* Бейдж типа для видео / веб */}
      {variant !== 'image' && (
        <div className="absolute top-1.5 left-1.5">
          <span className={`inline-flex items-center justify-center w-5 h-5 text-white rounded-full
            ${variant === 'video' ? 'bg-violet-500/80' : 'bg-blue-500/80'}`}>
            {variant === 'video' ? <VideoIcon className="w-3 h-3" /> : <GlobeIcon className="w-3 h-3" />}
          </span>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
        <span className="text-[10px] font-semibold text-white leading-tight line-clamp-1 drop-shadow">
          {name}
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

export default MediaCard;
