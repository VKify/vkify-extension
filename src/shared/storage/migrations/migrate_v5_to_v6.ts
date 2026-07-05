import type { Migration, RawSettings } from './types.js';

/**
 * v5 → v6: добавляет ключ формата скачивания музыки (`audio_download_format`).
 *
 * Новая настройка «Оригинальный / MP3» (см. AudioDownloadPage). Значение по
 * умолчанию — `'mp3'`: сохраняем прежнее поведение для существующих пользователей.
 * Проставляем его явно только там, где ключа ещё нет, чтобы UI/конвейер читали
 * согласованное значение, а не полагались на `?? 'mp3'` в каждом месте.
 *
 * Идемпотентность: если ключ уже задан — не трогаем; после штампа версии v6 шаг
 * больше не запускается.
 */
export const migrateV5ToV6: Migration = {
  to: 6,
  description: 'Add audio_download_format setting (default: mp3)',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };
    if (next.audio_download_format === undefined) {
      next.audio_download_format = 'mp3';
    }
    return next;
  },
};
