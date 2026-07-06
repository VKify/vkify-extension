/**
 * Барель миграций: упорядоченная цепочка преобразований схемы storage.
 *
 * Чтобы добавить миграцию:
 *   1. подними CURRENT_SCHEMA_VERSION в shared/constants/storage.ts;
 *   2. создай migrate_v{N-1}_to_v{N}.ts с `to: N`;
 *   3. вставь её сюда (порядок в массиве не важен — Migrator сортирует по `to`,
 *      но держим по возрастанию для читаемости).
 *
 * Migrator валидирует непрерывность цепочки (2,3,4,…) на старте.
 */
import type { Migration } from './types.js';
import { migrateV1ToV2 } from './migrate_v1_to_v2.js';
import { migrateV2ToV3 } from './migrate_v2_to_v3.js';
import { migrateV3ToV4 } from './migrate_v3_to_v4.js';
import { migrateV4ToV5 } from './migrate_v4_to_v5.js';
import { migrateV5ToV6 } from './migrate_v5_to_v6.js';
import { migrateV6ToV7 } from './migrate_v6_to_v7.js';

export type { Migration, RawSettings } from './types.js';

export const MIGRATIONS: readonly Migration[] = [
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
];
