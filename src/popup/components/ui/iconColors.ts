/**
 * Единая палитра цветных иконок-плиток попапа. Раньше эта таблица классов
 * дублировалась в каждом компоненте (SettingRow, NestedSettings, …); вынесена
 * сюда, чтобы новые элементы (DetailPage, NavRow) и старые ссылались на один
 * источник — цвет акцента у тумблера, его вложенных настроек и ряда-перехода
 * на подстраницу совпадает по определению.
 */

export type IconColor =
  | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

export interface IconColorClasses {
  /** Фон плитки (полупрозрачный). */
  bg: string;
  /** Цвет самой иконки/текста. */
  text: string;
  /** Тонкое внутреннее кольцо плитки. */
  ring: string;
  /** Насыщенный фон — для индикаторов «включено». */
  active: string;
}

export const ICON_COLORS: Record<IconColor, IconColorClasses> = {
  blue:   { bg: 'bg-blue-500/10',    text: 'text-blue-500',    ring: 'ring-blue-500/20',    active: 'bg-blue-500' },
  green:  { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20', active: 'bg-emerald-500' },
  red:    { bg: 'bg-red-500/10',     text: 'text-red-500',     ring: 'ring-red-500/20',     active: 'bg-red-500' },
  purple: { bg: 'bg-purple-500/10',  text: 'text-purple-500',  ring: 'ring-purple-500/20',  active: 'bg-purple-500' },
  orange: { bg: 'bg-orange-500/10',  text: 'text-orange-500',  ring: 'ring-orange-500/20',  active: 'bg-orange-500' },
  cyan:   { bg: 'bg-cyan-500/10',    text: 'text-cyan-500',    ring: 'ring-cyan-500/20',    active: 'bg-cyan-500' },
  pink:   { bg: 'bg-pink-500/10',    text: 'text-pink-500',    ring: 'ring-pink-500/20',    active: 'bg-pink-500' },
};
