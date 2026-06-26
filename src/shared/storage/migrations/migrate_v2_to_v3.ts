import type { Migration, RawSettings } from './types.js';

/**
 * v2 → v3: реструктуризация appearance-настроек.
 *
 * Старые сборки хранили оформление «плоско»:
 *   - background_url: string            — URL обоев
 *   - background_video: boolean         — это видео, а не картинка
 *   - dark_mode: boolean                — тёмная тема
 *
 * Текущая схема (settings-schema.ts) — нормализованная:
 *   - custom_background: string         — единый источник обоев
 *   - background_type: 'image'|'video'|'embed'|'web'
 *   - extension_theme: 'light'|'dark'|'auto'
 *
 * КОНСЕРВАТИВНЫЙ ПОДХОД (осознанно): миграция только ДОБАВЛЯЕТ/ПРЕОБРАЗУЕТ
 * значения в новые ключи и НЕ удаляет легаси. Старые ключи остаются в storage
 * (просто больше не читаются). Причина — пока нет полной уверенности в истории
 * версий: удалять данные рано. Зачистка легаси выносится в будущую отдельную
 * «cleanup»-миграцию, когда история станет точной.
 *
 * Каждый перенос защищён условием «новый ключ ещё не задан», поэтому миграция
 * идемпотентна и не затирает уже выставленные пользователем значения.
 */
export const migrateV2ToV3: Migration = {
  to: 3,
  description: 'Map legacy appearance keys → new (background_url/video, dark_mode), keep legacy',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };

    // ── Обои: background_url (+background_video) → custom_background/background_type
    if (
      typeof next.background_url === 'string' &&
      next.background_url.length > 0 &&
      next.custom_background === undefined
    ) {
      next.custom_background = next.background_url;
      next.background_type = next.background_video === true ? 'video' : 'image';
    }

    // ── Тема: dark_mode (boolean) → extension_theme ('dark'/'auto')
    if (typeof next.dark_mode === 'boolean' && next.extension_theme === undefined) {
      next.extension_theme = next.dark_mode ? 'dark' : 'auto';
    }

    // Легаси-ключи (background_url/background_video/dark_mode) НЕ удаляем — см.
    // шапку файла. Они остаются в storage как есть.
    return next;
  },
};
