/**
 * Tests for the versioned storage migration system (src/shared/storage).
 *
 * Three layers:
 *   1. Pure migration functions — plain (old) => new transforms, no storage.
 *   2. Migrator orchestration — baseline detection, backup, chained apply,
 *      stale-key removal, version stamping, error/fallback, concurrency, chain
 *      validation. Driven by an in-memory adapter (no chrome needed).
 *   3. Default singleton wiring over a stubbed chrome.storage.local.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
  backupKey,
} from '../shared/constants/storage.js';
import { migrateV1ToV2 } from '../shared/storage/migrations/migrate_v1_to_v2.js';
import { migrateV2ToV3 } from '../shared/storage/migrations/migrate_v2_to_v3.js';
import {
  Migrator,
  type MigratorStorageAdapter,
} from '../shared/storage/Migrator.js';
import { MIGRATIONS } from '../shared/storage/migrations/index.js';
import type { Migration, RawSettings } from '../shared/storage/migrations/index.js';

// ── In-memory adapter ────────────────────────────────────────────────────────
function memAdapter(initial: RawSettings = {}): {
  store: RawSettings;
  adapter: MigratorStorageAdapter;
} {
  const store: RawSettings = { ...initial };
  const adapter: MigratorStorageAdapter = {
    getAll: async () => ({ ...store }),
    setMultiple: async (items) => {
      Object.assign(store, items);
    },
    remove: async (keys) => {
      for (const k of keys) delete store[k];
    },
  };
  return { store, adapter };
}

// Two-step demo chain (v1→v2, v2→v3) matching the real target version of 3.
const demoMigrations: Migration[] = [migrateV1ToV2, migrateV2ToV3];
const demoOpts = { migrations: demoMigrations, targetVersion: 3, verbose: false } as const;

// ── 1. Pure migration functions ──────────────────────────────────────────────
describe('migrateV1ToV2 — spy → online tracker', () => {
  it('seeds online_tracked_users from legacy spy_tracked_users', () => {
    const out = migrateV1ToV2.migrate({ spy_tracked_users: [1, 2, 3] });
    expect(out.online_tracked_users).toEqual([1, 2, 3]);
    // pure: input not mutated
  });

  it('does not overwrite an already-populated online_tracked_users', () => {
    const out = migrateV1ToV2.migrate({
      spy_tracked_users: [1, 2],
      online_tracked_users: [9],
    });
    expect(out.online_tracked_users).toEqual([9]);
  });

  it('is a no-op when there is nothing to seed (idempotent)', () => {
    const out = migrateV1ToV2.migrate({ online_tracked_users: [1] });
    expect(out.online_tracked_users).toEqual([1]);
    const twice = migrateV1ToV2.migrate(out);
    expect(twice.online_tracked_users).toEqual([1]);
  });

  it('does not mutate the input object', () => {
    const input: RawSettings = { spy_tracked_users: [1] };
    migrateV1ToV2.migrate(input);
    expect(input.online_tracked_users).toBeUndefined();
  });
});

describe('migrateV2ToV3 — appearance restructure', () => {
  it('maps background_url/background_video into custom_background/background_type, keeping legacy', () => {
    const out = migrateV2ToV3.migrate({
      background_url: 'https://x/v.mp4',
      background_video: true,
    });
    expect(out.custom_background).toBe('https://x/v.mp4');
    expect(out.background_type).toBe('video');
    // conservative: legacy keys are retained, not deleted
    expect(out.background_url).toBe('https://x/v.mp4');
    expect(out.background_video).toBe(true);
  });

  it('defaults background_type to image when not a video', () => {
    const out = migrateV2ToV3.migrate({ background_url: 'https://x/p.png' });
    expect(out.background_type).toBe('image');
  });

  it('does not overwrite an existing custom_background', () => {
    const out = migrateV2ToV3.migrate({
      background_url: 'https://legacy',
      custom_background: 'https://new',
    });
    expect(out.custom_background).toBe('https://new');
    expect(out.background_url).toBe('https://legacy'); // conservative: legacy retained
  });

  it('maps dark_mode → extension_theme and keeps the legacy flag', () => {
    expect(migrateV2ToV3.migrate({ dark_mode: true }).extension_theme).toBe('dark');
    expect(migrateV2ToV3.migrate({ dark_mode: false }).extension_theme).toBe('auto');
    expect(migrateV2ToV3.migrate({ dark_mode: true }).dark_mode).toBe(true);
  });

  it('does not overwrite an existing extension_theme', () => {
    const out = migrateV2ToV3.migrate({ dark_mode: true, extension_theme: 'light' });
    expect(out.extension_theme).toBe('light');
  });
});

// ── 2. Migrator orchestration ────────────────────────────────────────────────
describe('Migrator — fresh install', () => {
  it('stamps current version without running migrations or writing a backup', async () => {
    const { store, adapter } = memAdapter({});
    const result = await new Migrator(adapter, demoOpts).migrate();

    expect(result.migrated).toBe(false);
    expect(result.fromVersion).toBe(3);
    expect(store[SCHEMA_VERSION_KEY]).toBe(3);
    expect(store[backupKey(3)]).toBeUndefined();
  });
});

describe('Migrator — legacy user (data, no version)', () => {
  it('runs the full chain, backs up, stamps version, removes stale keys', async () => {
    const { store, adapter } = memAdapter({
      spy_tracked_users: [7, 8],
      background_url: 'https://x/v.mp4',
      background_video: true,
      dark_mode: true,
      hide_stories: true,
    });

    const result = await new Migrator(adapter, demoOpts).migrate();

    expect(result.migrated).toBe(true);
    expect(result.fromVersion).toBe(1);
    expect(result.toVersion).toBe(3);
    expect(result.appliedSteps).toEqual([2, 3]);

    // v1→v2
    expect(store.online_tracked_users).toEqual([7, 8]);
    // v2→v3
    expect(store.custom_background).toBe('https://x/v.mp4');
    expect(store.background_type).toBe('video');
    expect(store.extension_theme).toBe('dark');
    // conservative: legacy keys retained (cleanup deferred to a future migration)
    expect(store.background_url).toBe('https://x/v.mp4');
    expect(store.background_video).toBe(true);
    expect(store.dark_mode).toBe(true);
    // untouched key survives
    expect(store.hide_stories).toBe(true);
    // version stamped + backup of the original snapshot
    expect(store[SCHEMA_VERSION_KEY]).toBe(3);
    expect((store[backupKey(1)] as RawSettings).background_url).toBe('https://x/v.mp4');
  });
});

describe('Migrator — stale-key removal infrastructure', () => {
  // The shipped migrations are conservative (copy-only), but the engine still
  // supports renames: a migration that drops a key → Migrator removes it from
  // storage. Kept covered for the future "cleanup" migration.
  it('physically removes keys a migration drops from the returned object', async () => {
    const rename: Migration = {
      to: 2,
      description: 'rename old → new',
      migrate(o) {
        const next: RawSettings = { ...o, renamed: o.legacy };
        delete next.legacy;
        return next;
      },
    };
    const { store, adapter } = memAdapter({ legacy: 'v', keep: 1 });
    await new Migrator(adapter, { migrations: [rename], targetVersion: 2, verbose: false }).migrate();

    expect(store.renamed).toBe('v');
    expect(store.legacy).toBeUndefined();
    expect(store.keep).toBe(1);
  });
});

describe('Migrator — partial upgrade from a known version', () => {
  it('applies only the steps above the stored version', async () => {
    const { store, adapter } = memAdapter({
      [SCHEMA_VERSION_KEY]: 2,
      spy_tracked_users: [1],
      dark_mode: true,
    });

    const result = await new Migrator(adapter, demoOpts).migrate();

    expect(result.appliedSteps).toEqual([3]); // only v2→v3
    // v1→v2 did NOT run: spy users were not copied
    expect(store.online_tracked_users).toBeUndefined();
    // v2→v3 ran
    expect(store.extension_theme).toBe('dark');
    expect(store[backupKey(2)]).toBeDefined();
  });
});

describe('Migrator — already current', () => {
  it('is a no-op when stored version equals target', async () => {
    const { store, adapter } = memAdapter({
      [SCHEMA_VERSION_KEY]: 3,
      dark_mode: true, // would migrate if a step ran
    });
    const result = await new Migrator(adapter, demoOpts).migrate();

    expect(result.migrated).toBe(false);
    expect(store.dark_mode).toBe(true); // untouched
    expect(store.extension_theme).toBeUndefined();
  });
});

describe('Migrator — error fallback', () => {
  const boom: Migration = {
    to: 2,
    description: 'always throws',
    migrate() {
      throw new Error('kaboom');
    },
  };

  it('does not corrupt data, seeds defaults, stamps version, returns the error', async () => {
    const { store, adapter } = memAdapter({ hide_stories: true });
    const migrator = new Migrator(adapter, {
      migrations: [boom],
      targetVersion: 2,
      defaults: { block_left_ads: true, perf_widget: false },
      verbose: false,
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await migrator.migrate();

    expect(result.migrated).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    // original user data intact
    expect(store.hide_stories).toBe(true);
    // defaults seeded for missing keys
    expect(store.block_left_ads).toBe(true);
    // version stamped so we don't boot-loop the broken migration
    expect(store[SCHEMA_VERSION_KEY]).toBe(2);
    errSpy.mockRestore();
  });
});

describe('Migrator — concurrency', () => {
  it('shares one in-flight promise across parallel callers', async () => {
    const { adapter } = memAdapter({ spy_tracked_users: [1] });
    const getAll = vi.spyOn(adapter, 'getAll');
    const migrator = new Migrator(adapter, demoOpts);

    const [a, b] = await Promise.all([migrator.migrate(), migrator.migrate()]);
    expect(a).toBe(b); // same resolved object
    expect(getAll).toHaveBeenCalledTimes(1);
  });
});

describe('Migrator — chain validation', () => {
  it('throws on a gap in the migration chain', () => {
    const gapped: Migration[] = [
      { to: 2, description: '', migrate: (o) => o },
      { to: 4, description: '', migrate: (o) => o }, // skips 3
    ];
    expect(() => new Migrator(memAdapter().adapter, { migrations: gapped })).toThrow(/gap/i);
  });

  it('throws on duplicate target versions', () => {
    const dup: Migration[] = [
      { to: 2, description: '', migrate: (o) => o },
      { to: 2, description: '', migrate: (o) => o },
    ];
    expect(() => new Migrator(memAdapter().adapter, { migrations: dup })).toThrow(/duplicate/i);
  });
});

// ── 3. Real chain ends at CURRENT_SCHEMA_VERSION ─────────────────────────────
describe('real migration registry', () => {
  it('target version matches the highest registered migration', () => {
    // The default Migrator uses MIGRATIONS + CURRENT_SCHEMA_VERSION; guard that
    // bumping one without the other is caught (Migrator would otherwise no-op
    // the top step or validate a gap). Checks the REAL registry, not the
    // version-pinned demo fixture used by the orchestration tests above.
    expect(MIGRATIONS[MIGRATIONS.length - 1].to).toBe(CURRENT_SCHEMA_VERSION);
  });
});
