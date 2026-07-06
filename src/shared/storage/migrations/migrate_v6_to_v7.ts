import type { Migration, RawSettings } from './types.js';

/**
 * v6 → v7: добавляет ключ языка интерфейса (`language`).
 *
 * Локализация (ru + en). Существующим пользователям фиксируем `'ru'`: они уже
 * пользуются русским UI, и авто-детект языка браузера не должен внезапно
 * переключить их на английский. Свежая установка эту миграцию НЕ проходит
 * (Migrator стартует сразу на CURRENT для пустого storage), поэтому `language`
 * там остаётся незаданным → срабатывает детект браузера (см. src/popup/i18n.ts).
 *
 * Идемпотентность: если ключ уже задан — не трогаем; после штампа версии v7 шаг
 * больше не запускается.
 */
export const migrateV6ToV7: Migration = {
  to: 7,
  description: 'Add language setting (existing users pinned to: ru)',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };
    if (next.language === undefined) {
      next.language = 'ru';
    }
    return next;
  },
};
