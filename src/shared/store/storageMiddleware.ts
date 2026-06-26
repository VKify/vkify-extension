/**
 * storageSync — Zustand-middleware двусторонней синхронизации `settings` с
 * chrome.storage.local.
 *
 *   • init     — runMigrations() → readAll() → гидрация state (loading=false);
 *   • out      — любой `set`, изменивший `settings`, write-through пишется в storage
 *                (кроме внутренних гидрации/реконсиляции — они помечены suppress);
 *   • in       — внешние chrome.storage.onChanged реконсилятся обратно в state;
 *   • teardown — на "Extension context invalidated" слушатели снимаются, store
 *                «замораживается» (дальнейшие записи — no-op).
 *
 * Защита от эхо-петли: собственные записи перед уходом в storage уже лежат в
 * state, поэтому пришедший назад onChanged видит равные значения и пропускает их.
 * Внутренние set'ы (hydrate/reconcile) дополнительно обёрнуты suppress-флагом,
 * чтобы данные, ПРИШЕДШИЕ из storage, не писались в storage обратно.
 *
 * Контексты (popup/content/background) — разные JS-realm; общий объект store
 * между ними НЕ делится. Реальная межконтекстная шина — chrome.storage.onChanged,
 * и инкапсулирована она здесь.
 */
import type { StateCreator, StoreMutatorIdentifier } from 'zustand';
import { isNonUiStateKey } from '@/popup/store/keys.js';
import type { Settings, PartialSettings, SettingsState } from './types.js';

/** Контракт окружения, от которого зависит middleware (подменяется в тестах). */
export interface StorageMiddlewareOptions {
  /** Прогнать миграции перед первой гидрацией (делит inFlight-промис между контекстами). */
  runMigrations: () => Promise<unknown>;
  /** Прочитать весь срез (эквивалент chrome.storage.local.get(null)). */
  readAll: () => Promise<Record<string, unknown>>;
  /** Записать пачку ключей. */
  writeMultiple: (items: Record<string, unknown>) => Promise<void>;
  /** Подписаться на изменения. Возвращает отписку. */
  subscribeChanges: (
    cb: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void,
  ) => () => void;
  /** Коэрция/валидация сырых данных перед попаданием в state. */
  validate: (raw: Record<string, unknown>) => Settings;
  /** Логировать ли (по умолчанию — только в dev). */
  verbose?: boolean;
}

/** «Расширение перезагружено, текущий content-контекст мёртв». */
export function isContextInvalidated(err: unknown): boolean {
  return (
    err instanceof Error &&
    /Extension context invalidated|message port closed|context invalidated/i.test(err.message)
  );
}

/**
 * Higher-order middleware. Не добавляет и не убирает мутаторов, поэтому
 * прозрачно проходит сквозь devtools/subscribeWithSelector (generic Mps/Mcs).
 */
export const storageSync =
  (options: StorageMiddlewareOptions) =>
  <
    T extends SettingsState,
    Mps extends [StoreMutatorIdentifier, unknown][] = [],
    Mcs extends [StoreMutatorIdentifier, unknown][] = [],
  >(
    config: StateCreator<T, Mps, Mcs>,
  ): StateCreator<T, Mps, Mcs> =>
  (set, get, api) => {
    const log = (m: string): void => {
      if (options.verbose) console.log(`[VKify][store] ${m}`);
    };

    let alive = true;
    let suppress = false; // true пока применяем данные, ПРИШЕДШИЕ из storage
    let unsubscribeChanges: (() => void) | null = null;

    const teardown = (reason: string): void => {
      if (!alive) return;
      alive = false;
      unsubscribeChanges?.();
      unsubscribeChanges = null;
      log(`teardown: ${reason}`);
    };

    /** Записать изменённые UI-ключи в storage, проглатывая «context invalidated». */
    const persist = async (prev: Settings, next: Settings): Promise<void> => {
      if (!alive) return;
      const changed: Record<string, unknown> = {};
      for (const key of Object.keys(next)) {
        if (isNonUiStateKey(key)) continue;
        if (next[key] !== prev[key]) changed[key] = next[key];
      }
      if (Object.keys(changed).length === 0) return;
      try {
        await options.writeMultiple(changed);
      } catch (err) {
        if (isContextInvalidated(err)) return teardown('write after invalidation');
        console.error('[VKify][store] persist failed:', err);
      }
    };

    /** Внешние изменения storage → state (без эха собственных записей). */
    const reconcile = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void => {
      if (!alive || area !== 'local') return;
      const cur = get().settings;
      let next: Settings | null = null;
      for (const [key, { newValue }] of Object.entries(changes)) {
        if (isNonUiStateKey(key)) continue;
        if (cur[key] === newValue) continue; // наша же запись (эхо) или no-op
        if (newValue === undefined) {
          (next ??= { ...cur });
          delete next[key];
        } else {
          (next ??= { ...cur })[key] = newValue;
        }
      }
      if (next) applyFromStorage({ settings: next } as Partial<T>);
    };

    /** set() для данных ИЗ storage — помечен suppress, чтобы не писать их обратно. */
    const applyFromStorage = (partial: Partial<T>): void => {
      suppress = true;
      try {
        set(partial, false);
      } finally {
        suppress = false;
      }
    };

    /**
     * Обёртка над set: после применения сравнивает settings и write-through'ит
     * изменения. Сеты, помеченные suppress (гидрация/реконсиляция), пропускаются.
     */
    const trackedSet: typeof set = ((partial, replace, action) => {
      const prev = get().settings;
      (set as (p: unknown, r?: unknown, a?: unknown) => void)(partial, replace, action);
      if (suppress || !alive) return;
      const next = get().settings;
      if (prev !== next) void persist(prev, next);
    }) as typeof set;

    // ── init: миграции → гидрация → подписка ────────────────────────────────
    void options
      .runMigrations()
      .catch((e) => console.error('[VKify][store] migrations failed:', e))
      .then(() => (alive ? options.readAll() : {}))
      .then((raw) => {
        if (!alive) return;
        const validated = options.validate(raw);
        const uiOnly: Settings = {};
        for (const [k, v] of Object.entries(validated)) {
          if (!isNonUiStateKey(k)) uiOnly[k] = v;
        }
        applyFromStorage({ settings: uiOnly, loading: false } as Partial<T>);
        log(`hydrated ${Object.keys(uiOnly).length} keys`);
      })
      .catch((err) => {
        if (isContextInvalidated(err)) return teardown('hydrate after invalidation');
        console.error('[VKify][store] hydrate failed:', err);
        applyFromStorage({ loading: false } as Partial<T>);
      });

    unsubscribeChanges = options.subscribeChanges(reconcile);

    // Доступ к teardown снаружи (например, при ручной остановке фичи).
    (api as unknown as { teardown: (reason: string) => void }).teardown = teardown;

    return config(trackedSet, get, api);
  };

/**
 * Опциональный sync-mirror: УЗКИЙ allowlist скалярных prefs дублируется в
 * chrome.storage.sync (лимит 8 КБ/item, ~120 записей/мин!). По умолчанию пуст.
 * НИКОГДА не клади сюда custom_background / custom_css / *_log — выбьешь квоту.
 */
export const SYNC_MIRROR_KEYS: readonly string[] = [];

/** Выбрать из патча только sync-mirror-ключи. */
export function pickSyncKeys(items: PartialSettings): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SYNC_MIRROR_KEYS) {
    if (k in items) out[k] = items[k];
  }
  return out;
}
