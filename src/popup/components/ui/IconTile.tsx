import React from 'react';
import { ICON_COLORS, type IconColor } from './iconColors.js';

/**
 * Канонический «плиточный» значок раздела — единый по всему попапу: квадрат со
 * скруглением, полупрозрачный фон цвета акцента и тонкое внутреннее кольцо.
 * Один источник правды для шапок секций (`SettingsSection`), рядов-переходов
 * (`NavRow`) и страниц (`DetailPage`).
 */
interface IconTileProps {
  icon: React.ReactNode;
  color?: IconColor;
  /** 'md' — 40px (по умолчанию), 'sm' — 36px (для шапки страницы). */
  size?: 'md' | 'sm';
  className?: string;
}

export default function IconTile({
  icon,
  color = 'blue',
  size = 'md',
  className = '',
}: IconTileProps): React.ReactElement {
  const c = ICON_COLORS[color];
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  return (
    <div
      className={`${dim} rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ${c.bg} ${c.text} ${c.ring} ${className}`}
    >
      {typeof icon === 'string' ? <span className="text-xl">{icon}</span> : icon}
    </div>
  );
}
