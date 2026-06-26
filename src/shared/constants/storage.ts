/**
 * Версионирование схемы `chrome.storage.local`.
 *
 * До этого файла структура хранилища нигде не была версионирована: каждая
 * «миграция» жила инлайном в background (напр. spy_tracked_users → online_tracked_users)
 * и срабатывала по эвристике «если ключ undefined». Это не масштабируется —
 * нельзя переименовать/реструктурировать ключ, не рискуя зацепить старые данные.
 *
 * Теперь есть единая ось версий: storage хранит `schema_version`, а `Migrator`
 * (src/shared/storage/Migrator.ts) последовательно прогоняет миграции
 * INITIAL_SCHEMA_VERSION → CURRENT_SCHEMA_VERSION при каждом старте.
 *
 * ВАЖНО: поднимая CURRENT_SCHEMA_VERSION, добавь файл миграции
 * `src/shared/storage/migrations/migrate_v{N-1}_to_v{N}.ts` и зарегистрируй его
 * в `migrations/index.ts`. Цепочка обязана быть непрерывной — Migrator это
 * проверяет на старте (бросит в dev, если шаг пропущен).
 */

/** Версия схемы, которую понимает текущая сборка. Поднимать при каждой миграции. */
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Базовая версия для пользователей, чьё хранилище появилось ДО введения
 * версионирования (ключа `schema_version` нет, но данные есть). Считаем их v1 и
 * прогоняем всю цепочку миграций.
 */
export const INITIAL_SCHEMA_VERSION = 1;

/** Ключ, под которым в storage лежит номер текущей схемы. */
export const SCHEMA_VERSION_KEY = 'schema_version';

/** Префикс ключей с резервными копиями настроек, снятыми перед миграцией. */
export const SETTINGS_BACKUP_PREFIX = 'settings_backup_v';

/** Имя ключа бэкапа для конкретной (исходной) версии: `settings_backup_v2`. */
export function backupKey(fromVersion: number): string {
  return `${SETTINGS_BACKUP_PREFIX}${fromVersion}`;
}

/** True для служебных ключей миграций (версия + бэкапы) — их прячут из UI/экспорта. */
export function isMigrationMetaKey(key: string): boolean {
  return key === SCHEMA_VERSION_KEY || key.startsWith(SETTINGS_BACKUP_PREFIX);
}
