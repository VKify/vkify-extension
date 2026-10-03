import React from 'react';
import './dashboard-primitives.css';

/**
 * Канонический «плиточный» значок раздела — единый по всему попапу: квадрат со
 * скруглением, полупрозрачный фон цвета акцента и тонкое внутреннее кольцо.
 * Один источник правды для шапок секций (`SettingsSection`), рядов-переходов
 * (`NavRow`) и страниц (`DetailPage`).
 */
interface IconTileProps {
  icon: React.ReactNode;
  /** 'md' — 40px (по умолчанию), 'sm' — 36px (для шапки страницы). */
  size?: 'md' | 'sm';
  className?: string;
}

export default function IconTile({
  icon,
  size = 'md',
  className = '',
}: IconTileProps): React.ReactElement {
  return (
    <div
      className={`dashboard-icon dashboard-icon--primary ${size === 'sm' ? 'dashboard-icon--small' : ''} ${className}`}
    >
      {icon}
    </div>
  );
}
