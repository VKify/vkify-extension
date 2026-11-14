import { THEME_SHORT_EXPAND, sanitizeSettings } from './constants/settings-schema.js';
export function decodeThemeSettings(encoded: string): Record<string, unknown> {
  if (!encoded || typeof encoded !== 'string') {
    throw new Error('No encoded payload');
  }
  if (encoded.length > 128 * 1024 || !/^[a-z0-9+/_-]+={0,2}$/i.test(encoded)) {
    throw new Error('Invalid encoded payload');
  }

  let themeSettings: Record<string, unknown>;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padding = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    // TextDecoder корректно обрабатывает multi-byte символы (в отличие от устаревшего escape()).
    const bytes = Uint8Array.from(atob(b64 + padding), c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json) as { v?: number; p?: Record<string, unknown> };

    if (!payload || !payload.p || typeof payload.p !== 'object' || Array.isArray(payload.p) || (payload.v !== undefined && payload.v !== 1 && payload.v !== 2)) {
      throw new Error('Invalid payload structure');
    }

    // v:2 — короткие алиасы ключей; расширяем в полные имена перед валидацией
    const rawParams = payload.p as Record<string, unknown>;
    if ((payload.v ?? 1) >= 2) {
      themeSettings = {};
      for (const [key, value] of Object.entries(rawParams)) {
        const fullKey = THEME_SHORT_EXPAND[key] ?? key;
        themeSettings[fullKey] = value;
      }
    } else {
      themeSettings = rawParams;
    }
  } catch (err) {
    console.warn('[VKify] Failed to decode shared theme:', (err as Error).message);
    throw new Error('Decode failed: ' + (err as Error).message);
  }

  // Канонический санитайзер: разрешённые в scope 'theme' ключи И корректные
  // типы значений. Та же функция используется для импорта файла и site-bridge.
  const sanitized = sanitizeSettings(themeSettings, 'theme');

  if (Object.keys(sanitized).length === 0) {
    throw new Error('No valid appearance settings in payload');
  }

  return sanitized;
}
