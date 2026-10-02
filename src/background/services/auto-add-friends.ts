import { AUTO_ADD_ALARM, AUTO_ADD_CAPS, AUTO_ADD_LEDGER, AUTO_ADD_STATE, validAutoAddOptions, normalizeAutoAddSource, type AutoAddSource, type AutoAddOptions, type AutoAddState } from '../../shared/auto-add-friends.js';
import { fetchVKMethod } from '../../shared/utils/vk-fetch.js';
import type { VKTokenManager } from '../utils/vk-api.js';

interface Attempt { at: number; id: number }
type Ledger = Record<string, Attempt[]>;
const HOUR = 3600000, DAY = 24 * HOUR;
const coded = (code: string) => Object.assign(new Error(code), { code });
function page(value: unknown): { count: number; items: unknown[] } {
  const p = value as { count?: number; items?: unknown[] } | null;
  if (!p || !Number.isSafeInteger(p.count) || p.count! < 0 || !Array.isArray(p.items)) throw coded('INVALID_RESPONSE');
  return p as { count: number; items: unknown[] };
}

/** One mutation per persisted alarm. Reserve attempts before sending; never retry
 * mutations (including timeouts). A worker interrupted mid-request stops on wake. */
export class AutoAddFriendsService {
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private controller?: AbortController;
  constructor(private readonly tokens: VKTokenManager) {}

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private async state(): Promise<AutoAddState> {
    const raw = await chrome.storage.local.get(AUTO_ADD_STATE);
    return (raw[AUTO_ADD_STATE] as AutoAddState | undefined) ?? { isRunning: false, added: 0, attempted: 0 };
  }
  private async save(state: AutoAddState): Promise<void> {
    await chrome.storage.local.set({ [AUTO_ADD_STATE]: state });
  }
  private async finish(state: AutoAddState, reason: string, error?: unknown): Promise<void> {
    await chrome.alarms.clear(AUTO_ADD_ALARM);
    const e = error as { message?: string; code?: string } | undefined;
    await this.save({ ...state, isRunning: false, inFlight: false, nextAt: undefined, reason, error: e?.message, code: e?.code });
  }
  async restore(): Promise<void> {
    await this.serial(async () => {
      const state = await this.state();
      if (!state.isRunning) { await chrome.alarms.clear(AUTO_ADD_ALARM); return; }
      if (!state.options || !validAutoAddOptions(state.options) || !state.userId || state.inFlight) {
        await this.finish(state, 'interrupted'); return;
      }
      await chrome.alarms.create(AUTO_ADD_ALARM, { when: Math.max(Date.now() + 30000, state.nextAt ?? 0) });
    });
  }
  start(options: AutoAddOptions, acknowledged: boolean, source?: AutoAddSource): Promise<void> {
    return this.serial(async () => {
      if (acknowledged !== true || !validAutoAddOptions(options)) throw coded('INVALID_OPTIONS');
      if ((await this.state()).isRunning) throw coded('ALREADY_RUNNING');
      const state: AutoAddState = { isRunning: true, added: 0, attempted: 0, options, source: normalizeAutoAddSource(source), cursor: 0, nextAt: Date.now() + options.delayMin * 1000 };
      // Do not inherit the old DOM toggle, including after an extension upgrade.
      await chrome.storage.local.set({ auto_add_friends: false });
      const version = this.generation;
      try {
        let token = (await this.tokens.get()).token;
        if (!token) token = (await this.tokens.requestFresh()).token;
        if (!token) throw coded('NO_TOKEN');
        const users = await this.api('users.get', token, {}, version) as { id: number }[];
        if (!Array.isArray(users) || !Number.isSafeInteger(users[0]?.id) || users[0].id <= 0) throw coded('INVALID_RESPONSE');
        state.userId = String(users[0].id);
        if (state.source?.kind === 'list' && state.source.ownerId && state.source.ownerId !== state.userId) throw coded('ACCOUNT_CHANGED');
        await this.save(state);
        await chrome.alarms.create(AUTO_ADD_ALARM, { when: state.nextAt! });
      } catch (error) { await this.finish(state, 'error', error); throw error; }
    });
  }
  stop(): Promise<void> {
    this.generation++;
    this.controller?.abort();
    return this.serial(async () => this.finish(await this.state(), 'stopped'));
  }
  private async api(method: string, token: string, params: Record<string, unknown>, version: number): Promise<unknown> {
    if (version !== this.generation) throw coded('CANCELLED');
    const controller = new AbortController();
    this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await fetchVKMethod(method, token, params, { signal: controller.signal, strict: true });
      // Space read requests as well as mutations; no batch/execute or flood retry.
      await new Promise(resolve => setTimeout(resolve, 400));
      if (version !== this.generation) throw coded('CANCELLED');
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw coded(version === this.generation ? 'TIMEOUT' : 'CANCELLED');
      throw error;
    } finally { clearTimeout(timeout); if (this.controller === controller) this.controller = undefined; }
  }
  tick(): Promise<void> {
    return this.serial(async () => {
      const state = await this.state();
      if (!state.isRunning) return;
      if (state.inFlight) { await this.finish(state, 'interrupted'); return; }
      if (Date.now() < (state.nextAt ?? 0)) {
        await chrome.alarms.create(AUTO_ADD_ALARM, { when: state.nextAt! }); return;
      }
      const version = this.generation;
      try {
        const options = state.options;
        if (!validAutoAddOptions(options) || !state.userId) throw coded('INVALID_OPTIONS');
        const stored = await chrome.storage.local.get([AUTO_ADD_LEDGER, 'vk_user_id']);
        if (String(stored.vk_user_id) !== state.userId) throw coded('ACCOUNT_CHANGED');
        const ledger = (stored[AUTO_ADD_LEDGER] ?? {}) as Ledger;
        const attempts = (ledger[state.userId] ?? []).filter(a => a.at > Date.now() - DAY);
        state.hourUsed = attempts.filter(a => a.at > Date.now() - HOUR).length;
        state.dayUsed = attempts.length;
        if (state.attempted >= options.session) { await this.finish(state, 'session_limit'); return; }
        if (state.hourUsed >= options.hour) { await this.finish(state, 'hour_limit'); return; }
        if (state.dayUsed >= options.day) { await this.finish(state, 'day_limit'); return; }
        const { token } = await this.tokens.get();
        if (!token) throw coded('NO_TOKEN');
        const users = await this.api('users.get', token, {}, version) as { id: number }[];
        if (!Array.isArray(users) || String(users[0]?.id) !== state.userId) throw coded('ACCOUNT_CHANGED');
        const friends = page(await this.api('friends.get', token, { count: 1 }, version));
        if (friends.count >= AUTO_ADD_CAPS.friends) { await this.finish(state, 'friends_limit'); return; }
        const outgoing = page(await this.api('friends.getRequests', token, { out: 1, count: 1 }, version));
        if (outgoing.count >= AUTO_ADD_CAPS.outgoing) { await this.finish(state, 'outgoing_limit'); return; }
        const source = normalizeAutoAddSource(state.source);
        const cursor = state.cursor ?? 0;
        const batch = source.kind === 'list' ? source.ids.slice(cursor, cursor + 100) : [];
        if (source.kind === 'list' && !batch.length) { await this.finish(state, 'list_complete'); return; }
        const items = source.kind === 'list'
          ? await this.api('users.get', token, { user_ids: batch.join(','), fields: 'can_send_friend_request' }, version)
          : page(await this.api('friends.getSuggestions', token, { count: 100, fields: 'can_send_friend_request' }, version)).items;
        if (!Array.isArray(items) || source.kind === 'list' && items.some(u => !batch.includes(u?.id))) throw coded('INVALID_RESPONSE');
        const advance = async (): Promise<void> => {
          if (source.kind === 'recommendations') { await this.finish(state, 'no_candidates'); return; }
          state.cursor = cursor + batch.length;
          if (state.cursor >= source.ids.length) { await this.finish(state, 'list_complete'); return; }
          state.nextAt = Date.now() + options.delayMin * 1000;
          await this.save(state);
          await chrome.alarms.create(AUTO_ADD_ALARM, { when: state.nextAt });
        };
        const candidates = items.filter((item): item is { id: number } => {
          const u = item as { id?: number; deactivated?: string; can_send_friend_request?: number };
          return Number.isSafeInteger(u?.id) && u.id! > 0 && String(u.id) !== state.userId
            && !u.deactivated && u.can_send_friend_request !== 0 && !attempts.some(a => a.id === u.id);
        });
        if (!candidates.length) { await advance(); return; }
        const statuses = await this.api('friends.areFriends', token, { user_ids: candidates.map(u => u.id).join(',') }, version) as { user_id: number; friend_status: number }[];
        if (!Array.isArray(statuses) || statuses.length !== candidates.length
          || new Set(statuses.map(s => s.user_id)).size !== candidates.length
          || statuses.some(s => !candidates.some(u => u.id === s.user_id) || ![0, 1, 2, 3].includes(s.friend_status))) throw coded('INVALID_RESPONSE');
        const candidate = (source.kind === 'list' ? batch.map(id => candidates.find(u => u.id === id)).filter((u): u is { id: number } => !!u) : candidates)
          .find(u => statuses.some(s => s.user_id === u.id && s.friend_status === 0));
        if (!candidate) { await advance(); return; }
        // Recheck identity immediately before reserving and sending a mutation.
        const current = await this.tokens.get();
        if (current.token !== token || current.userId !== state.userId) throw coded('ACCOUNT_CHANGED');
        if (version !== this.generation) return;
        attempts.push({ at: Date.now(), id: candidate.id });
        ledger[state.userId] = attempts;
        state.attempted++;
        state.hourUsed++; state.dayUsed++;
        state.inFlight = true;
        if (source.kind === 'list') state.cursor = cursor + batch.indexOf(candidate.id) + 1;
        await chrome.storage.local.set({ [AUTO_ADD_LEDGER]: ledger, [AUTO_ADD_STATE]: state });
        const result = await this.api('friends.add', token, { user_id: candidate.id }, version);
        if (result !== 1) throw coded(result === 4 ? 'DUPLICATE_REQUEST' : result === 2 ? 'REQUEST_ACCEPTED' : 'INVALID_RESPONSE');
        state.added++;
        state.inFlight = false;
        if (state.attempted >= options.session) { await this.finish(state, 'session_limit'); return; }
        if (state.hourUsed >= options.hour) { await this.finish(state, 'hour_limit'); return; }
        if (state.dayUsed >= options.day) { await this.finish(state, 'day_limit'); return; }
        if (source.kind === 'list' && state.cursor! >= source.ids.length) { await this.finish(state, 'list_complete'); return; }
        state.nextAt = Date.now() + (options.delayMin + Math.floor(Math.random() * (options.delayMax - options.delayMin + 1))) * 1000;
        await this.save(state);
        await chrome.alarms.create(AUTO_ADD_ALARM, { when: state.nextAt });
      } catch (error) { await this.finish(state, 'error', error); }
    });
  }
}
