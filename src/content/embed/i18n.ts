/**
 * Крошечный переводчик embed-моста. Эмбеду нужны ровно две строки, поэтому вместо
 * полного словаря content-скриптов (`ru.ts`+`en.ts`, ~600 строк — они раздували
 * IIFE embed.js) держим их здесь и берём текущий язык из общего рантайма
 * `content/i18n/lang.ts`. Живое переключение языка сохраняется: рантайм — тот же,
 * что у content, а пункт меню пересоздаётся обсервером, iframe title ставится на
 * mount. Ключи совпадают с `embed.*` из общих словарей — если строки понадобятся
 * где-то ещё, легко смёржить обратно.
 */
import { getLang } from '@/content/i18n/lang.js';

type EmbedKey = 'embed.iframe_title' | 'embed.menu_item';

const STRINGS: Record<'ru' | 'en', Record<EmbedKey, string>> = {
  ru: {
    'embed.iframe_title': 'VKify · Настройки',
    'embed.menu_item': 'Настройки VKify',
  },
  en: {
    'embed.iframe_title': 'VKify · Settings',
    'embed.menu_item': 'VKify Settings',
  },
};

/** Перевод одной из двух embed-строк на текущем языке (фолбэк — русский). */
export function t(key: EmbedKey): string {
  return (STRINGS[getLang()] ?? STRINGS.ru)[key];
}
