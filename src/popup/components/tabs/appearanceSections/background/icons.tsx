import React from 'react';
import {
  SunIcon, ContrastIcon, PaletteIcon, DropletIcon, CameraIcon, ImageFilterIcon,
  Square4Icon, SparklesIcon, MagicWandIcon, ClapperboardIcon, MoonIcon, ZapIcon,
} from '@/popup/components/icons/Icons.js';

/**
 * Карта iconId → иконка @vkontakte/icons для фильтров, эффектов и пресетов фона.
 * Данные (appearance.ts) хранят семантический iconId (как DISPLAY_MODES.iconId),
 * а рендер берёт компонент отсюда — без эмодзи и без React в файле констант.
 */
const BG_ICONS: Record<string, React.FC<{ className?: string }>> = {
  // Фильтры
  brightness: SunIcon,
  contrast: ContrastIcon,
  saturation: PaletteIcon,
  hue: DropletIcon,
  sepia: CameraIcon,
  grayscale: ImageFilterIcon,
  // Эффекты
  vignette: Square4Icon,
  // Пресеты эффектов
  clear: SparklesIcon,
  soft: DropletIcon,
  dreamy: MagicWandIcon,
  cinematic: ClapperboardIcon,
  vintage: CameraIcon,
  noir: MoonIcon,
  vibrant: ZapIcon,
  dark: MoonIcon,
};

export function BgIcon({ id, className }: { id?: string; className?: string }): React.ReactElement | null {
  if (!id) return null;
  const Cmp = BG_ICONS[id];
  return Cmp ? <Cmp className={className} /> : null;
}
