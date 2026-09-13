export type WallpaperPropertyValue = string | number | boolean;

export interface WallpaperPropertyOption {
  label: string;
  value: string;
}

export interface WallpaperPropertyDefinition {
  key: string;
  type: 'slider' | 'bool' | 'combo' | 'textinput' | 'color' | 'group';
  label: string;
  defaultValue?: WallpaperPropertyValue;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  options?: WallpaperPropertyOption[];
}

export type WallpaperPropertyValues = Record<string, WallpaperPropertyValue>;
export type WallpaperValuesById = Record<string, WallpaperPropertyValues>;

const PROPERTY_KEY = /^[A-Za-z0-9_]{1,128}$/;
const WALLPAPER_ID = /^[A-Za-z0-9_.-]{1,128}$/;
const TYPES = new Set(['slider', 'bool', 'combo', 'textinput', 'color', 'group']);
const RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const isPropertyKey = (key: string): boolean => PROPERTY_KEY.test(key) && !RESERVED_KEYS.has(key);
export const isWallpaperId = (id: string): boolean => WALLPAPER_ID.test(id) && !RESERVED_KEYS.has(id);

const isValue = (value: unknown): value is WallpaperPropertyValue =>
  typeof value === 'string' || typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));

function humanizeWallpaperLabel(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  if (!value.startsWith('ui_')) return value.trim();
  return value
    .replace(/^ui_(?:browse_)?(?:properties_)?/, '')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

/** Normalizes `project.json.general.properties` without trusting its shape. */
export function normalizeWallpaperEngineProperties(raw: unknown): WallpaperPropertyDefinition[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const normalized = Object.entries(raw as Record<string, unknown>)
    .slice(0, 200)
    .flatMap(([key, item]) => {
      if (!isPropertyKey(key) || !item || typeof item !== 'object' || Array.isArray(item)) return [];
      const property = item as Record<string, unknown>;
      if (typeof property.type !== 'string' || !TYPES.has(property.type)) return [];
      const definition: WallpaperPropertyDefinition & { order?: number } = {
        key,
        type: property.type as WallpaperPropertyDefinition['type'],
        label: humanizeWallpaperLabel(property.text, key),
      };
      if (isValue(property.value)) definition.defaultValue = property.value;
      if (typeof property.min === 'number' && Number.isFinite(property.min)) definition.min = property.min;
      if (typeof property.max === 'number' && Number.isFinite(property.max)) definition.max = property.max;
      if (typeof property.step === 'number' && Number.isFinite(property.step) && property.step > 0) definition.step = property.step;
      if (typeof property.precision === 'number' && Number.isInteger(property.precision)) definition.precision = Math.min(10, Math.max(0, property.precision));
      if (typeof property.order === 'number' && Number.isFinite(property.order)) definition.order = property.order;
      if (Array.isArray(property.options)) {
        definition.options = property.options.slice(0, 100).flatMap((option) => {
          if (!option || typeof option !== 'object') return [];
          const record = option as Record<string, unknown>;
          if (typeof record.value !== 'string') return [];
          return [{
            value: record.value.slice(0, 1024),
            label: humanizeWallpaperLabel(record.label, record.value).slice(0, 256),
          }];
        });
      }
      return [definition];
    })
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return normalized.map(({ order: _order, ...property }) => property);
}

/** Stable storage namespace for a Web wallpaper pasted as a raw URL. */
export function deriveWebWallpaperId(url: string): string {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index++) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `url-${(hash >>> 0).toString(36)}`;
}

export function parseWallpaperPropertySchema(raw: unknown): WallpaperPropertyDefinition[] {
  if (typeof raw !== 'string' || raw.length > 65536) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 200) return [];
    const result: WallpaperPropertyDefinition[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const p = item as Record<string, unknown>;
      if (typeof p.key !== 'string' || !isPropertyKey(p.key)) continue;
      if (typeof p.type !== 'string' || !TYPES.has(p.type)) continue;
      if (typeof p.label !== 'string' || !p.label.trim() || p.label.length > 256) continue;

      const definition: WallpaperPropertyDefinition = {
        key: p.key,
        type: p.type as WallpaperPropertyDefinition['type'],
        label: p.label.trim(),
      };
      if (isValue(p.defaultValue)) definition.defaultValue = p.defaultValue;
      if (typeof p.min === 'number' && Number.isFinite(p.min)) definition.min = p.min;
      if (typeof p.max === 'number' && Number.isFinite(p.max)) definition.max = p.max;
      if (typeof p.step === 'number' && Number.isFinite(p.step) && p.step > 0) definition.step = p.step;
      if (typeof p.precision === 'number' && Number.isInteger(p.precision) && p.precision >= 0 && p.precision <= 10) definition.precision = p.precision;
      if (Array.isArray(p.options)) {
        definition.options = p.options.slice(0, 100).flatMap((option) => {
          if (!option || typeof option !== 'object') return [];
          const o = option as Record<string, unknown>;
          if (typeof o.label !== 'string' || typeof o.value !== 'string') return [];
          if (o.label.length > 256 || o.value.length > 1024) return [];
          return [{ label: o.label, value: o.value }];
        });
      }
      result.push(definition);
    }
    return result;
  } catch {
    return [];
  }
}

export function parseWallpaperValues(raw: unknown): WallpaperValuesById {
  if (typeof raw !== 'string' || raw.length > 65536) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: WallpaperValuesById = {};
    for (const [wallpaperId, entry] of Object.entries(parsed as Record<string, unknown>).slice(0, 100)) {
      if (!isWallpaperId(wallpaperId) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const values: WallpaperPropertyValues = {};
      for (const [key, value] of Object.entries(entry as Record<string, unknown>).slice(0, 200)) {
        if (isPropertyKey(key) && isValue(value) && !(typeof value === 'string' && value.length > 4096)) {
          values[key] = value;
        }
      }
      result[wallpaperId] = values;
    }
    return result;
  } catch {
    return {};
  }
}

export function getWallpaperPropertyValues(
  schema: WallpaperPropertyDefinition[],
  saved: WallpaperPropertyValues | undefined,
): WallpaperPropertyValues {
  const values: WallpaperPropertyValues = {};
  for (const property of schema) {
    if (property.type === 'group') continue;
    const value = saved?.[property.key] ?? property.defaultValue;
    if (isValue(value)) values[property.key] = value;
  }
  return values;
}

export function createWallpaperEnginePayload(
  schema: WallpaperPropertyDefinition[],
  values: WallpaperPropertyValues,
): Record<string, { value: WallpaperPropertyValue; text?: string }> {
  const payload: Record<string, { value: WallpaperPropertyValue; text?: string }> = {};
  for (const property of schema) {
    if (property.type === 'group' || !Object.prototype.hasOwnProperty.call(values, property.key)) continue;
    const item: { value: WallpaperPropertyValue; text?: string } = { value: values[property.key] };
    if (property.type === 'combo') {
      item.text = property.options?.find((option) => option.value === values[property.key])?.label;
    }
    payload[property.key] = item;
  }
  return payload;
}

export const isWallpaperPropertySchemaJson = (value: unknown): boolean =>
  typeof value === 'string' && value.length <= 65536 &&
  (value === '[]' || parseWallpaperPropertySchema(value).length > 0);

export const isWallpaperValuesJson = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length > 65536) return false;
  try {
    const parsed = JSON.parse(value) as unknown;
    return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
};
