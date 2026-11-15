import React from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerIcon } from '@/popup/components/icons/Icons.js';

/** Shared loading state inside wallpaper cards and previews. */
export default function WallpaperLoading({ applying = false }: { applying?: boolean }): React.ReactElement {
  const { t } = useTranslation('appearance');
  return <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
    <span role="status" className="flex max-w-full items-center gap-2 rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-xs font-medium text-primary shadow-lg">
      <SpinnerIcon aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
      {t(applying ? 'background.gallery.applying' : 'background.gallery.loading')}
    </span>
  </div>;
}
