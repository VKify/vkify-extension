/**
 * Валидация настроек для store.
 *
 * Важно про разделение источников:
 *   • СОБСТВЕННЫЙ chrome.storage.local — доверенный источник. Полную Zod-схему на
 *     все ~150 ключей ExtensionSettings руками не пишем: она дублировала бы
 *     TS-интерфейс и стала бы второй точкой дрейфа — ровно то, против чего создан
 *     `settings-schema.ts`. Поэтому здесь — лёгкая КОЭРЦИЯ по typeof относительно
 *     DEFAULT_SETTINGS: чиним явный мусор/повреждённый storage, но не выкидываем
 *     легитимные ключи (spy_*, message_templates, …), которых нет в security-таблице.
 *   • НЕдоверенные границы (import / site-bridge / shared-theme URL) — это уже
 *     решено `sanitizeSettings` из settings-schema.ts (единый SSOT-санитайзер).
 *     Здесь его только реэкспортим, чтобы у потребителей store была одна точка входа.
 */
import { DEFAULT_SETTINGS } from '@/shared/constants/defaults.js';
import { sanitizeSettings, type SettingScope } from '@/shared/constants/settings-schema.js';
import type { Settings } from './types.js';

/**
 * Коэрция сырого среза из собственного storage. Если по дефолту ключ —
 * boolean/number/string, а в storage пришёл другой примитив, ключ откатывается
 * к дефолту. Массивы/объекты не трогаем — их форму гарантируют миграции.
 */
export function coerceStoredSettings(raw: Record<string, unknown>): Settings {
  const out: Settings = { ...raw };
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const expected = typeof def;
    if (expected === 'object' || def === undefined) continue;
    if (key in out && out[key] !== undefined && typeof out[key] !== expected) {
      out[key] = def;
    }
  }
  return out;
}

/**
 * Санитайз НЕдоверенного объекта под конкретную границу доверия. Тонкая обёртка
 * над единым `sanitizeSettings` (security-allowlist), чтобы import/site/theme-пути
 * шли через store, а не дёргали settings-schema напрямую.
 */
export function sanitizeForBoundary(
  raw: Record<string, unknown>,
  scope: SettingScope,
): Settings {
  return sanitizeSettings(raw, scope) as Settings;
}
