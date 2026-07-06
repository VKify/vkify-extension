/**
 * Мини-i18n для content-/injected-скриптов. Эти бандлы — classic IIFE, в них
 * НЕЛЬЗЯ тянуть i18next (assertClassicScriptsHaveNoImports), поэтому здесь
 * собственный крошечный рантайм: плоские словари (`ru.ts`/`en.ts`) + `t()` с
 * dot-path и `{{var}}`-интерполяцией.
 *
 * Язык = та же настройка `language`, что пишет переключатель в попапе (см.
 * [[i18n-localization]]). Хранится плоским ключом в chrome.storage.local, так
 * что читается напрямую и слушается через chrome.storage.onChanged — контент
 * следует за выбором пользователя и переключается синхронно с попапом.
 *
 * Синхронная доступность на document_start обеспечивается localStorage-зеркалом
 * `vkify_lang` (тот же приём, что у темы — см. appearance/theme/mirror.ts):
 * `currentLang` читается из зеркала синхронно при загрузке модуля, а
 * авторитетный reconcile из chrome.storage приходит через несколько мс.
 */
import {
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  isSupportedLanguage,
  type SupportedLanguage,
} from '../../locales/index.js';
import { RU } from './ru.js';
import { EN } from './en.js';

export type Dict = { [key: string]: string | Dict };

const DICTS: Record<SupportedLanguage, Dict> = { ru: RU, en: EN };
const MIRROR_KEY = 'vkify_lang';

function readMirror(): SupportedLanguage {
  try {
    const v = localStorage.getItem(MIRROR_KEY);
    if (isSupportedLanguage(v)) return v;
  } catch {
    // localStorage недоступен — дефолт ниже
  }
  return DEFAULT_LANGUAGE;
}

function writeMirror(lang: SupportedLanguage): void {
  try {
    localStorage.setItem(MIRROR_KEY, lang);
  } catch {
    // quota / disabled — некритично
  }
}

let currentLang: SupportedLanguage = readMirror();

function lookup(dict: Dict, path: string): string | undefined {
  let node: string | Dict | undefined = dict;
  for (const seg of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[seg];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

/**
 * Перевод по dot-path ключу с `{{var}}`-интерполяцией. Порядок фолбэка:
 * текущий язык → русский (язык-фолбэк) → сам ключ (чтобы промах был виден).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = lookup(DICTS[currentLang], key) ?? lookup(DICTS.ru, key) ?? key;
  return interpolate(raw, params);
}

/** Текущий язык контента (для дат/`Intl` и т.п.). */
export function getLang(): SupportedLanguage {
  return currentLang;
}

type Listener = (lang: SupportedLanguage) => void;
const listeners = new Set<Listener>();

/**
 * Подписка на смену языка. Большинство инжектируемых элементов пересоздаётся
 * обсерверами при перерисовке страницы и подхватит новый язык само; долгоживущим
 * панелям (плеер, эквалайзер) стоит подписаться и перерендериться.
 * Возвращает функцию отписки.
 */
export function onLanguageChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setLang(lang: SupportedLanguage): void {
  if (lang === currentLang) return;
  currentLang = lang;
  writeMirror(lang);
  for (const cb of listeners) {
    try {
      cb(lang);
    } catch {
      // изолируем подписчиков друг от друга
    }
  }
}

let inited = false;

/**
 * Авторитетная инициализация из chrome.storage + подписка на изменения.
 * Вызывать один раз рано в content/index.ts (после installExtApi).
 */
export function initI18n(): void {
  if (inited) return;
  inited = true;
  try {
    void chrome.storage.local
      .get('language')
      .then((s) => {
        const lang = (s as { language?: unknown }).language;
        // Свежая установка: попап ещё не записал `language` → детект браузера
        // (то же поведение, что у попапа), иначе — сохранённый выбор.
        setLang(isSupportedLanguage(lang) ? lang : detectBrowserLanguage());
        writeMirror(currentLang);
      })
      .catch(() => {
        // orphaned script — контекст умер, не мешаем странице
      });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.language) return;
      const nv = changes.language.newValue;
      if (isSupportedLanguage(nv)) setLang(nv);
    });
  } catch {
    // chrome.* недоступен — остаёмся на зеркальном языке
  }
}
