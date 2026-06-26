/**
 * Migrator — версионированная миграция `chrome.storage.local`.
 *
 * Один сервис, который при старте каждого контекста (background / popup /
 * content) приводит хранилище к CURRENT_SCHEMA_VERSION:
 *
 *   1. читает текущую версию из storage (`schema_version`);
 *   2. определяет базовую версию (см. resolveBaseline — учитывает «свежую
 *      установку» и «легаси без версии»);
 *   3. если миграции нужны — снимает БЭКАП исходного снимка в `settings_backup_vN`;
 *   4. последовательно прогоняет чистые миграции old → new (migrations/);
 *   5. персистит результат: пишет изменённые ключи, УДАЛЯЕТ исчезнувшие
 *      (поддержка переименований), штампует новую версию;
 *   6. при ошибке любой миграции — не калечит данные: бэкап остаётся, версия
 *      штампуется в CURRENT (чтобы не зациклить старт), недостающие ключи
 *      добиваются из defaults (fallback на дефолты).
 *
 * Сам Migrator не привязан к chrome — он работает через `MigratorStorageAdapter`,
 * поэтому в тестах подменяется in-memory реализацией. Дефолтный синглтон
 * `migrator` использует chrome.storage.local.
 */

import {
  CURRENT_SCHEMA_VERSION,
  INITIAL_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  SETTINGS_BACKUP_PREFIX,
  backupKey,
} from '../constants/storage.js';
import { DEFAULT_SETTINGS } from '../constants/defaults.js';
import { MIGRATIONS, type Migration, type RawSettings } from './migrations/index.js';

/** Минимальный storage-контракт, нужный Migrator'у. Реализуется поверх chrome или мока. */
export interface MigratorStorageAdapter {
  /** Прочитать всё содержимое (эквивалент chrome.storage.local.get(null)). */
  getAll(): Promise<RawSettings>;
  /** Записать пачку ключей. */
  setMultiple(items: RawSettings): Promise<void>;
  /** Удалить ключи (нужно для переименований — set не умеет «разъустанавливать»). */
  remove(keys: string[]): Promise<void>;
}

export interface MigrationResult {
  /** Были ли реально применены миграции (false для свежей установки / актуальной схемы). */
  migrated: boolean;
  /** С какой версии стартовали. */
  fromVersion: number;
  /** До какой версии довели (== targetVersion при успехе). */
  toVersion: number;
  /** Целевые версии применённых шагов, напр. [2, 3]. */
  appliedSteps: number[];
  /** Ключ снятого бэкапа, если миграции выполнялись. */
  backupKey?: string;
  /** Заполнено, если миграция упала и сработал fallback. */
  error?: Error;
}

export interface MigratorOptions {
  migrations?: readonly Migration[];
  defaults?: RawSettings;
  targetVersion?: number;
  /** Принудительно вкл/выкл лог. По умолчанию — только в dev-сборке. */
  verbose?: boolean;
}

function isDev(): boolean {
  try {
    return Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

export class Migrator {
  private readonly adapter: MigratorStorageAdapter;
  private readonly migrations: readonly Migration[];
  private readonly defaults: RawSettings;
  private readonly targetVersion: number;
  private readonly verbose: boolean;

  /** Гард: один прогон на жизнь сервиса (повторные initStorageSync — no-op). */
  private inFlight: Promise<MigrationResult> | null = null;

  constructor(adapter: MigratorStorageAdapter, options: MigratorOptions = {}) {
    this.adapter = adapter;
    this.migrations = [...(options.migrations ?? MIGRATIONS)].sort((a, b) => a.to - b.to);
    this.defaults = options.defaults ?? (DEFAULT_SETTINGS as RawSettings);
    this.targetVersion = options.targetVersion ?? CURRENT_SCHEMA_VERSION;
    this.verbose = options.verbose ?? isDev();
    this.validateChain();
  }

  /**
   * Прогнать миграции. Идемпотентна и конкурентно-безопасна: параллельные вызовы
   * (background + popup стартуют почти одновременно) делят один промис.
   */
  migrate(): Promise<MigrationResult> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<MigrationResult> {
    const all = await this.adapter.getAll();
    const fromVersion = this.resolveBaseline(all);

    // Уже на актуальной (или новее) схеме — только проштамповать версию, если её нет.
    if (fromVersion >= this.targetVersion) {
      if (all[SCHEMA_VERSION_KEY] !== this.targetVersion) {
        await this.adapter.setMultiple({ [SCHEMA_VERSION_KEY]: this.targetVersion });
      }
      return { migrated: false, fromVersion, toVersion: this.targetVersion, appliedSteps: [] };
    }

    const steps = this.migrations.filter(m => m.to > fromVersion && m.to <= this.targetVersion);
    const bKey = backupKey(fromVersion);

    // Снимок исходных настроек ДО любых изменений (без служебных backup-ключей,
    // чтобы бэкапы не вкладывались друг в друга и не пухли).
    const snapshot = this.stripBackups(all);

    try {
      // 1. Бэкап. Пишем первым: если миграция упадёт, данные восстановимы.
      await this.adapter.setMultiple({ [bKey]: snapshot });
      this.log(`backup saved → ${bKey} (${Object.keys(snapshot).length} keys)`);

      // 2. Чистая цепочка преобразований в памяти.
      let working: RawSettings = snapshot;
      const appliedSteps: number[] = [];
      for (const step of steps) {
        working = step.migrate(working);
        appliedSteps.push(step.to);
        this.log(`applied v${step.to - 1} → v${step.to}: ${step.description}`);
      }

      // 3. Персист: записать новое состояние + версию, удалить исчезнувшие ключи.
      working[SCHEMA_VERSION_KEY] = this.targetVersion;
      await this.persist(snapshot, working);

      this.log(`done: v${fromVersion} → v${this.targetVersion}`);
      return {
        migrated: true,
        fromVersion,
        toVersion: this.targetVersion,
        appliedSteps,
        backupKey: bKey,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[VKify][Migrator] migration failed, falling back to defaults:', error);
      // Fallback: данные в storage не тронуты (персист — единственная запись, и до
      // неё мы не дошли). Добиваем недостающие дефолты и штампуем версию, чтобы
      // не зациклить старт на падающей миграции. Бэкап остаётся для разбора.
      await this.applyFallback(all);
      return {
        migrated: false,
        fromVersion,
        toVersion: this.targetVersion,
        appliedSteps: [],
        backupKey: bKey,
        error,
      };
    }
  }

  /**
   * Базовая версия, от которой стартуем:
   *   - есть числовой schema_version → он;
   *   - storage пуст (нет пользовательских ключей) → свежая установка, считаем
   *     уже актуальной (targetVersion) — миграции не нужны, только штамп;
   *   - есть данные, но нет версии → легаси-пользователь до версионирования.
   */
  private resolveBaseline(all: RawSettings): number {
    const stored = all[SCHEMA_VERSION_KEY];
    if (typeof stored === 'number' && Number.isFinite(stored)) return stored;

    const hasUserData = Object.keys(all).some(
      k => k !== SCHEMA_VERSION_KEY && !k.startsWith(SETTINGS_BACKUP_PREFIX),
    );
    return hasUserData ? INITIAL_SCHEMA_VERSION : this.targetVersion;
  }

  /** Записать изменения и удалить ключи, исчезнувшие после миграций (renames). */
  private async persist(before: RawSettings, after: RawSettings): Promise<void> {
    await this.adapter.setMultiple(after);
    const removed = Object.keys(before).filter(k => !(k in after));
    if (removed.length > 0) {
      await this.adapter.remove(removed);
      this.log(`removed stale keys: ${removed.join(', ')}`);
    }
  }

  private async applyFallback(all: RawSettings): Promise<void> {
    const patch: RawSettings = {};
    for (const [key, value] of Object.entries(this.defaults)) {
      if (!(key in all)) patch[key] = value;
    }
    patch[SCHEMA_VERSION_KEY] = this.targetVersion;
    await this.adapter.setMultiple(patch);
  }

  private stripBackups(all: RawSettings): RawSettings {
    const out: RawSettings = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(SETTINGS_BACKUP_PREFIX)) continue;
      out[key] = value;
    }
    return out;
  }

  /** Цепочка обязана быть непрерывной (…, N-1→N, N→N+1, …) без дублей и дыр. */
  private validateChain(): void {
    const seen = new Set<number>();
    let prev: number | null = null;
    for (const m of this.migrations) {
      if (seen.has(m.to)) {
        throw new Error(`[VKify][Migrator] duplicate migration to v${m.to}`);
      }
      if (prev !== null && m.to !== prev + 1) {
        throw new Error(`[VKify][Migrator] gap in migration chain: v${prev} → v${m.to}`);
      }
      seen.add(m.to);
      prev = m.to;
    }
  }

  private log(msg: string): void {
    if (this.verbose) console.log(`[VKify][Migrator] ${msg}`);
  }
}

/** Дефолтный адаптер поверх chrome.storage.local. */
export const chromeStorageAdapter: MigratorStorageAdapter = {
  getAll: () => chrome.storage.local.get(null),
  setMultiple: items => chrome.storage.local.set(items),
  remove: keys => chrome.storage.local.remove(keys),
};

/**
 * Глобальный синглтон Migrator'а. Используется напрямую в background и в popup
 * (через storageClient), а также регистрируется в content ServiceContainer
 * (SERVICES.migrator) — см. feature-manager.registerCoreServices.
 */
export const migrator = new Migrator(chromeStorageAdapter);
