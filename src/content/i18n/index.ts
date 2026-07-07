/**
 * Мини-i18n для content-/injected-скриптов. Эти бандлы — classic IIFE, в них
 * НЕЛЬЗЯ тянуть i18next (assertClassicScriptsHaveNoImports), поэтому здесь
 * собственный крошечный рантайм: плоские словари (`ru.ts`/`en.ts`) + `t()` с
 * dot-path и `{{var}}`-интерполяцией.
 *
 * Языковой рантайм (текущий язык, смена, подписка, initI18n) вынесен в
 * `lang.ts` — БЕЗ словарей, чтобы лёгкие потребители (embed-мост) могли следить
 * за языком, не таща оба полных словаря. Здесь — только словари и `t()`. Публичный
 * API (getLang/onLanguageChange/initI18n) реэкспортируется отсюда без изменений.
 */
import { getLang } from './lang.js';
import { RU } from './ru.js';
import { EN } from './en.js';
import type { SupportedLanguage } from '../../locales/index.js';

export { getLang, onLanguageChange, initI18n } from './lang.js';

export type Dict = { [key: string]: string | Dict };

const DICTS: Record<SupportedLanguage, Dict> = { ru: RU, en: EN };

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
  const raw = lookup(DICTS[getLang()], key) ?? lookup(DICTS.ru, key) ?? key;
  return interpolate(raw, params);
}
