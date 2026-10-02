import type { Migration, RawSettings } from './types.js';

// Historical values are frozen; future API defaults must not rewrite this step.
const LEGACY_KEYS = ['auto_add_friends', 'auto_add_limit', 'auto_add_delay_min', 'auto_add_delay_max'];
const record = (value: unknown): value is RawSettings => typeof value === 'object' && value !== null && !Array.isArray(value);
function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

export const migrateV15ToV16: Migration = {
  to: 16,
  description: 'Migrate legacy friend automation to stopped API settings and preserve parser data',
  migrate(old) {
    const next: RawSettings = { ...old, auto_add_friends: false };
    const stats = old.auto_add_stats;
    // API jobs already have options and their own authorization/account checks.
    // Keep their state, member lists and persistent request ledgers untouched.
    if (record(stats) && stats.options !== undefined) return next;
    if (stats !== undefined && !record(stats)) return next;
    if (stats === undefined && !LEGACY_KEYS.some(key => old[key] !== undefined)) return next;
    const delayMin = bounded(old.auto_add_delay_min, 60, 30, 600);
    next.auto_add_stats = {
      ...(record(stats) ? stats : {}),
      isRunning: false,
      inFlight: false,
      nextAt: undefined,
      added: bounded(record(stats) ? stats.added : undefined, 0, 0, Number.MAX_SAFE_INTEGER),
      // DOM successes cannot reconstruct API attempts or account-scoped budgets.
      attempted: 0,
      options: {
        hour: bounded(old.auto_add_limit, 10, 1, 20), day: 25, session: 10,
        delayMin, delayMax: Math.max(delayMin, bounded(old.auto_add_delay_max, 120, 30, 600)),
      },
      source: { kind: 'recommendations' },
      ...(record(stats) && stats.isRunning === true || old.auto_add_friends === true ? { reason: 'interrupted' } : {}),
    };
    return next;
  },
};
