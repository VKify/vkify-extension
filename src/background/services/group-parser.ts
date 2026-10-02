import { GROUP_PARSER_ALARM, GROUP_PARSER_CAPS as CAPS, GROUP_PARSER_LEDGER, GROUP_PARSER_STATE, communityReference, type GroupParserState, type ParserGroup } from '../../shared/group-parser.js';
import { validUserId } from '../../shared/user-lists.js';
import { fetchVKMethod } from '../../shared/utils/vk-fetch.js';
import type { VKTokenManager } from '../utils/vk-api.js';

const fail = (code: string) => Object.assign(new Error(code), { code });
type Ledger = Record<string, number[]>;
function counted(value: unknown): { count: number; items: unknown[] } {
  const p = value as { count: number; items: unknown[] } | null;
  if (!p || !Number.isSafeInteger(p.count) || p.count < 0 || !Array.isArray(p.items)) throw fail('INVALID_RESPONSE');
  return p;
}
function group(value: unknown): ParserGroup {
  const g = value as ParserGroup;
  if (!g || !validUserId(g.id) || typeof g.name !== 'string' || g.deactivated) throw fail('INVALID_COMMUNITY');
  return { id: g.id, name: g.name, is_closed: g.is_closed, photo_100: typeof g.photo_100 === 'string' && /^https:\/\//.test(g.photo_100) ? g.photo_100 : undefined };
}
/** Read-only API parser: bounded pages, persistent progress/budget, no retries.
 * A failed or interrupted page retains prior pages and requires manual restart. */
export class GroupParserService {
  private queue: Promise<unknown> = Promise.resolve();
  private version = 0;
  private controller?: AbortController;
  constructor(private readonly tokens: VKTokenManager) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work); this.queue = task.catch(() => undefined); return task;
  }
  private async state(): Promise<GroupParserState> {
    return (await chrome.storage.local.get(GROUP_PARSER_STATE))[GROUP_PARSER_STATE] as GroupParserState ?? { status: 'idle', ids: [] };
  }
  private save(state: GroupParserState): Promise<void> { return chrome.storage.local.set({ [GROUP_PARSER_STATE]: state }); }
  private async finish(state: GroupParserState, status: GroupParserState['status'], error?: unknown): Promise<void> {
    await chrome.alarms.clear(GROUP_PARSER_ALARM);
    const e = error as { message?: string; code?: string } | undefined;
    await this.save({ ...state, status, phase: undefined, inFlight: false, nextAt: undefined, error: e?.message, code: e?.code });
  }
  private async context(refresh: boolean): Promise<{ token: string; userId: string }> {
    let info = await this.tokens.get();
    if (!info.token && refresh) { await this.tokens.requestFresh(); info = await this.tokens.get(); }
    if (!info.token) throw fail('NO_TOKEN');
    if (!info.userId || !/^[1-9]\d*$/.test(info.userId)) throw fail('ACCOUNT_CHANGED');
    return { token: info.token, userId: info.userId };
  }
  private async api(method: string, params: Record<string, unknown>, ctx: { token: string; userId: string }, version: number): Promise<unknown> {
    if (version !== this.version) throw fail('CANCELLED');
    const current = await this.tokens.get();
    if (current.token !== ctx.token || current.userId !== ctx.userId) throw fail('ACCOUNT_CHANGED');
    const raw = await chrome.storage.local.get(GROUP_PARSER_LEDGER);
    const ledger = (raw[GROUP_PARSER_LEDGER] ?? {}) as Ledger;
    const history = (ledger[ctx.userId] ?? []).filter(at => at > Date.now() - 86400000);
    if (history.filter(at => at > Date.now() - 3600000).length >= CAPS.hour) throw fail('PARSER_HOUR_LIMIT');
    if (history.length >= CAPS.day) throw fail('PARSER_DAY_LIMIT');
    const wait = Math.max(0, 1000 - (Date.now() - (history[history.length - 1] ?? 0)));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    if (version !== this.version) throw fail('CANCELLED');
    history.push(Date.now()); ledger[ctx.userId] = history;
    await chrome.storage.local.set({ [GROUP_PARSER_LEDGER]: ledger });
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const result = await fetchVKMethod(method, ctx.token, params, { strict: true, signal: controller.signal });
      if (version !== this.version) throw fail('CANCELLED');
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw fail(version === this.version ? 'TIMEOUT' : 'CANCELLED');
      throw error;
    } finally { clearTimeout(timeout); if (this.controller === controller) this.controller = undefined; }
  }
  private async identity(ctx: { token: string; userId: string }, version: number): Promise<void> {
    const users = await this.api('users.get', {}, ctx, version) as { id: number }[];
    if (!Array.isArray(users) || String(users[0]?.id) !== ctx.userId) throw fail('ACCOUNT_CHANGED');
  }
  listGroups(offset: number): Promise<{ groups: ParserGroup[]; total: number; userId: string }> {
    return this.serial(async () => {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= CAPS.users) throw fail('INVALID_OPTIONS');
      const ctx = await this.context(true), version = this.version;
      await this.identity(ctx, version);
      const response = counted(await this.api('groups.get', { extended: 1, count: 1000, offset }, ctx, version));
      if (response.items.length > 1000) throw fail('INVALID_RESPONSE');
      return { groups: response.items.filter(g => !(g as ParserGroup)?.deactivated).map(group), total: Math.min(response.count, CAPS.users), userId: ctx.userId };
    });
  }
  start(reference: string, limit: number, expectedUserId?: string): Promise<void> {
    return this.serial(async () => {
      const ref = communityReference(reference);
      if (!Number.isInteger(limit) || limit < 1 || limit > CAPS.users) throw fail('INVALID_OPTIONS');
      if ((await this.state()).status === 'running') throw fail('ALREADY_RUNNING');
      const state: GroupParserState = { status: 'running', phase: 'preparing', inFlight: true, ids: [], limit, offset: 0 };
      const version = this.version;
      await this.save(state);
      try {
        const ctx = await this.context(true); state.userId = ctx.userId;
        if (expectedUserId !== undefined && expectedUserId !== ctx.userId) throw fail('ACCOUNT_CHANGED');
        await this.identity(ctx, version);
        const result = await this.api('groups.getById', { group_ids: ref, fields: 'members_count' }, ctx, version) as { groups?: unknown[] } | unknown[];
        const groups = Array.isArray(result) ? result : result?.groups;
        if (!groups || groups.length !== 1) throw fail('INVALID_COMMUNITY');
        state.group = group(groups[0]);
        if (/^\d+$/.test(ref) && state.group.id !== Number(ref)) throw fail('INVALID_RESPONSE');
        state.phase = 'waiting'; state.inFlight = false;
        state.nextAt = Date.now() + CAPS.delay;
        await this.save(state);
        await chrome.alarms.create(GROUP_PARSER_ALARM, { when: state.nextAt });
      } catch (error) { await this.finish(state, 'error', error); throw error; }
    });
  }
  stop(): Promise<void> {
    this.version++; this.controller?.abort();
    return this.serial(async () => this.finish(await this.state(), 'stopped'));
  }
  restore(): Promise<void> {
    return this.serial(async () => {
      const state = await this.state();
      if (state.status !== 'running') { await chrome.alarms.clear(GROUP_PARSER_ALARM); return; }
      if (state.inFlight || !state.group || !validUserId(state.group.id) || !state.userId
        || !Number.isInteger(state.limit) || state.limit! < 1 || state.limit! > CAPS.users
        || !Array.isArray(state.ids) || state.ids.length > state.limit! || !state.ids.every(validUserId)
        || state.offset !== state.ids.length || state.ids.some((id, i) => i > 0 && id <= state.ids[i - 1])) {
        await this.finish(state, 'interrupted'); return;
      }
      state.nextAt = Math.max(Date.now() + CAPS.delay, state.nextAt ?? 0);
      state.phase = 'waiting';
      await this.save(state);
      await chrome.alarms.create(GROUP_PARSER_ALARM, { when: state.nextAt });
    });
  }
  tick(): Promise<void> {
    return this.serial(async () => {
      const state = await this.state();
      if (state.status !== 'running') return;
      if (state.inFlight) { await this.finish(state, 'interrupted'); return; }
      if (Date.now() < (state.nextAt ?? 0)) { await chrome.alarms.create(GROUP_PARSER_ALARM, { when: state.nextAt! }); return; }
      const version = this.version;
      try {
        if (!state.group || !state.limit || state.limit > CAPS.users || !Array.isArray(state.ids)) throw fail('INVALID_OPTIONS');
        const ctx = await this.context(false);
        if (ctx.userId !== state.userId) throw fail('ACCOUNT_CHANGED');
        state.inFlight = true; state.phase = 'loading'; await this.save(state);
        await this.identity(ctx, version);
        const count = Math.min(CAPS.page, state.limit - state.ids.length), offset = state.offset ?? 0;
        const response = counted(await this.api('groups.getMembers', { group_id: state.group.id, sort: 'id_asc', offset, count }, ctx, version));
        if (state.total !== undefined && state.total !== response.count) throw fail('MEMBERS_CHANGED');
        state.total = response.count;
        if (response.items.length !== Math.min(count, Math.max(0, response.count - offset))) throw fail('INCOMPLETE_PAGE');
        let last = state.ids[state.ids.length - 1] ?? 0;
        for (const id of response.items) {
          if (!validUserId(id) || id <= last) throw fail('INCOMPLETE_PAGE');
          last = id;
        }
        if (version !== this.version) return;
        state.ids = [...state.ids, ...response.items as number[]];
        state.offset = offset + response.items.length;
        state.inFlight = false;
        if (state.ids.length >= response.count) { await this.finish(state, 'completed'); return; }
        if (state.ids.length >= state.limit) { await this.finish(state, 'limit'); return; }
        state.phase = 'waiting';
        state.nextAt = Date.now() + CAPS.delay;
        await this.save(state);
        await chrome.alarms.create(GROUP_PARSER_ALARM, { when: state.nextAt });
      } catch (error) { await this.finish(state, 'error', error); }
    });
  }
}
