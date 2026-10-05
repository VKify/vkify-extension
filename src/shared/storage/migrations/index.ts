import { migrateV13ToV14 } from './migrate_v13_to_v14.js';
import { migrateV14ToV15 } from './migrate_v14_to_v15.js';
import { migrateV15ToV16 } from './migrate_v15_to_v16.js';
import { migrateV16ToV17 } from './migrate_v16_to_v17.js';
import { migrateV17ToV18 } from './migrate_v17_to_v18.js';
import { migrateV18ToV19 } from './migrate_v18_to_v19.js';
import { migrateV19ToV20 } from './migrate_v19_to_v20.js';
import { migrateV20ToV21 } from './migrate_v20_to_v21.js';
import { migrateV21ToV22 } from './migrate_v21_to_v22.js';
import { migrateV22ToV23 } from './migrate_v22_to_v23.js';
import { migrateV23ToV24 } from './migrate_v23_to_v24.js';
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
import { migrateV12ToV13 } from './migrate_v12_to_v13.js';
import { migrateV11ToV12 } from './migrate_v11_to_v12.js';
import type { Migration } from './types.js';
import { migrateV1ToV2 } from './migrate_v1_to_v2.js';
import { migrateV2ToV3 } from './migrate_v2_to_v3.js';
import { migrateV3ToV4 } from './migrate_v3_to_v4.js';
import { migrateV4ToV5 } from './migrate_v4_to_v5.js';
import { migrateV5ToV6 } from './migrate_v5_to_v6.js';
import { migrateV6ToV7 } from './migrate_v6_to_v7.js';
import { migrateV7ToV8 } from './migrate_v7_to_v8.js';
import { migrateV8ToV9 } from './migrate_v8_to_v9.js';
import { migrateV9ToV10 } from './migrate_v9_to_v10.js';
import { migrateV10ToV11 } from './migrate_v10_to_v11.js';

export type { Migration, RawSettings } from './types.js';

export const MIGRATIONS: readonly Migration[] = [
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
  migrateV7ToV8,
  migrateV8ToV9,
  migrateV9ToV10,
  migrateV10ToV11,
  migrateV11ToV12,
  migrateV12ToV13,
  migrateV13ToV14,
  migrateV14ToV15,
  migrateV15ToV16,
  migrateV16ToV17,
  migrateV17ToV18,
  migrateV18ToV19,
  migrateV19ToV20,
  migrateV20ToV21,
  migrateV21ToV22,
  migrateV22ToV23,
  migrateV23ToV24,
];
