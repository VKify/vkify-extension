/**
 * Крошечный переводчик embed-моста и внешней панели макета. Вместо
 * полного словаря content-скриптов (`ru.ts`+`en.ts`, ~600 строк — они раздували
 * IIFE embed.js) держим их здесь и берём текущий язык из общего рантайма
 * `content/i18n/lang.ts`. Живое переключение языка сохраняется: рантайм — тот же,
 * что у content, а пункт меню пересоздаётся обсервером, iframe title ставится на
 * mount. Ключи совпадают с `embed.*` из общих словарей — если строки понадобятся
 * где-то ещё, легко смёржить обратно.
 */
import { getLang } from '@/content/i18n/lang.js';

type EmbedKey = 'embed.iframe_title' | 'embed.menu_item' |
  'layout.title' | 'layout.width' | 'layout.offset' | 'layout.center' | 'layout.done' | 'layout.hint' | 'layout.error' |
  'layout.saving' | 'layout.reset_center' | 'layout.no_space';

const STRINGS: Record<'ru' | 'en', Record<EmbedKey, string>> = {
  ru: {
    'embed.iframe_title': 'VKify · Настройки',
    'embed.menu_item': 'Настройки VKify',
    'layout.title': 'Макет страницы VK',
    'layout.width': 'Ширина контента',
    'layout.offset': 'Смещение страницы',
    'layout.center': 'Центр',
    'layout.done': 'Готово',
    'layout.hint': 'Изменения видны сразу. Esc — готово.',
    'layout.error': 'Не удалось сохранить изменения. Попробуйте ещё раз.',
    'layout.saving': 'Сохранение…',
    'layout.reset_center': 'По центру',
    'layout.no_space': 'Контент занимает всю ширину окна. Чтобы сместить страницу, уменьшите ширину.',
  },
  en: {
    'embed.iframe_title': 'VKify · Settings',
    'embed.menu_item': 'VKify Settings',
    'layout.title': 'VK page layout',
    'layout.width': 'Content width',
    'layout.offset': 'Page offset',
    'layout.center': 'Center',
    'layout.done': 'Done',
    'layout.hint': 'Changes appear immediately. Esc to finish.',
    'layout.error': 'Could not save changes. Please try again.',
    'layout.saving': 'Saving…',
    'layout.reset_center': 'Center page',
    'layout.no_space': 'Content fills the window. Reduce its width to move the page.',
  },
};

/** Перевод одной из двух embed-строк на текущем языке (фолбэк — русский). */
export function t(key: EmbedKey): string {
  return (STRINGS[getLang()] ?? STRINGS.ru)[key];
}
