import type { Migration, RawSettings } from './types.js';

/**
 * v1 → v2: spy → online tracker.
 *
 * Историческая правка: список отслеживаемых пользователей раньше был один —
 * `spy_tracked_users` — и обслуживал и активити-спай (сообщения), и онлайн-
 * монитор. Когда два режима разъехались (см. storage-keys.ts), онлайн-монитор
 * переключили на отдельный `online_tracked_users`. Старые пользователи остались
 * с непустым `spy_tracked_users` и пустым/отсутствующим `online_tracked_users`,
 * из-за чего онлайн-монитор «забывал» всех, за кем следили.
 *
 * Раньше эта правка жила инлайном в background/index.ts (по эвристике «если
 * undefined»). Теперь это явная версионированная миграция: идемпотентная
 * (повторный прогон ничего не делает, т.к. online_tracked_users уже заполнен).
 */
export const migrateV1ToV2: Migration = {
  to: 2,
  description: 'Seed online_tracked_users from legacy spy_tracked_users',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };

    const online = next.online_tracked_users;
    const onlineEmpty = !Array.isArray(online) || online.length === 0;

    const legacy = next.spy_tracked_users;
    if (onlineEmpty && Array.isArray(legacy) && legacy.length > 0) {
      next.online_tracked_users = [...legacy];
    }

    return next;
  },
};
