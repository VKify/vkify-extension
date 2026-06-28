import type { Migration, RawSettings } from './types.js';

/**
 * v4 → v5: удаляет ключ фичи «Убрать окно авторизации» (`hide_auth_popup`).
 *
 * Сама фича выпилена из расширения (CSS + handler + UI), поэтому её настройка в
 * storage стала мусором. Возвращаем снимок БЕЗ этого ключа — Migrator вычислит
 * дифф и физически удалит исчезнувший ключ из chrome.storage (тот же механизм,
 * что и для переименований), предварительно сняв автобэкап (settings_backup_v4).
 *
 * Идемпотентность: `delete` по отсутствующему ключу — no-op, а после штампа
 * версии v5 шаг больше не запускается. Повторный прогон ничего не меняет.
 */
export const migrateV4ToV5: Migration = {
  to: 5,
  description: 'Drop removed hide_auth_popup feature key',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };
    delete next.hide_auth_popup;
    return next;
  },
};
