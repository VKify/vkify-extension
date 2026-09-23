import { callVKApi, type VKTokenManager } from '../utils/vk-api.js';
import {
  DIALOG_STATS_KEY, DIALOG_STATS_EXACT_LIMIT, emptyDialogStats, isFreshReport,
  normalizeConversations, lastMessageMetrics,
  type ConversationsPage, type DialogStatsState, type StatsMessage,
} from '../../shared/dialog-stats.js';

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** One serial job per extension. Closing the popup does not stop collection. */
export class DialogStatsService {
  private job: Promise<void> | null = null;
  private cancelled = false;
  private state: DialogStatsState | null = null;

  constructor(private readonly tokens: VKTokenManager) {}

  private async owner(): Promise<string> {
    const { userId } = await this.tokens.get();
    if (!userId) throw new Error('AUTH_REQUIRED');
    return String(userId);
  }

  async getState(): Promise<DialogStatsState> {
    const ownerId = await this.owner();
    if (this.state?.ownerId === ownerId) return this.state;
    const stored = (await chrome.storage.local.get(DIALOG_STATS_KEY))[DIALOG_STATS_KEY] as DialogStatsState | undefined;
    if (!stored || stored.version !== 1 || stored.ownerId !== ownerId || !Array.isArray(stored.rows)) {
      return emptyDialogStats(ownerId);
    }
    // MV3 may terminate a worker. Never leave a persisted job looking active forever.
    return stored.status === 'running' && !this.job
      ? { ...stored, status: 'cancelled', error: 'INTERRUPTED' } : stored;
  }

  async start(refresh = false, peerIds?: number[]): Promise<void> {
    if (this.job) return;
    // Reserve synchronously before any storage/API awaits (multiple popup instances).
    this.cancelled = false;
    this.job = this.run(refresh, peerIds).finally(() => { this.job = null; });
    // run handles failures and persists them; start returns immediately to the UI.
    void this.job.catch(() => { /* Storage failure is surfaced by subsequent polling. */ });
  }

  cancel(): void { this.cancelled = true; }

  private check(): void {
    if (this.cancelled) throw new Error('CANCELLED');
  }

  private async pause(ms: number): Promise<void> {
    for (let elapsed = 0; elapsed < ms; elapsed += 100) {
      this.check();
      await delay(Math.min(100, ms - elapsed));
    }
    this.check();
  }

  private async request<T>(ownerId: string, method: string, params: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.pause(attempt ? 1000 * 2 ** (attempt - 1) : 400);
      if (await this.owner() !== ownerId) throw new Error('ACCOUNT_CHANGED');
      try {
        const result = await this.awaitResponse(callVKApi(this.tokens, method, params));
        this.check();
        if (await this.owner() !== ownerId) throw new Error('ACCOUNT_CHANGED');
        if (!result) throw new Error('INVALID_RESPONSE');
        return result as T;
      } catch (error) {
        const code = (error as { code?: number | string }).code;
        if (attempt >= 3 || !(String(code) === '6' || String(code) === '9'
          || /too many requests|flood/i.test((error as Error).message))) throw error;
      }
    }
  }

  /** Stop waiting promptly on cancel; a late transport response is discarded. */
  private async awaitResponse(request: Promise<unknown>): Promise<unknown> {
    let timer: ReturnType<typeof setInterval> | undefined;
    const started = Date.now();
    try {
      return await Promise.race([request, new Promise<never>((_, reject) => {
        timer = setInterval(() => {
          if (this.cancelled) reject(new Error('CANCELLED'));
          else if (Date.now() - started >= 25_000) reject(new Error('TIMEOUT'));
        }, 100);
      })]);
    } finally {
      clearInterval(timer);
    }
  }

  private async save(state: DialogStatsState): Promise<void> {
    this.state = { ...state, rows: [...state.rows] };
    await chrome.storage.local.set({ [DIALOG_STATS_KEY]: this.state });
  }

  private async run(refresh: boolean, peerIds?: number[]): Promise<void> {
    let state = emptyDialogStats();
    try {
      const ownerId = await this.owner();
      state = await this.getState();
      if (!peerIds && !refresh && isFreshReport(state, ownerId)) return;
      if (peerIds) {
        if (!state.collectedAt || state.ownerId !== ownerId) throw new Error('REPORT_REQUIRED');
        const ids = [...new Set(peerIds)].slice(0, DIALOG_STATS_EXACT_LIMIT);
        const rows = state.rows.filter(row => ids.includes(row.peerId));
        state = { ...state, status: 'running', mode: 'exact', completed: 0, total: rows.length, error: undefined };
        await this.save(state);
        for (const row of rows) {
          const response = await this.request<{ count: number; items: StatsMessage[] }>(ownerId,
            'messages.getHistory', { peer_id: row.peerId, count: 1 });
          if (!Number.isSafeInteger(response.count) || response.count < 0 || !Array.isArray(response.items)) {
            throw new Error('INVALID_RESPONSE');
          }
          state.rows = state.rows.map(current => current.peerId === row.peerId ? {
            ...current, approxMessageCount: response.count, countExact: true,
            ...(response.items[0] || response.count === 0 ? lastMessageMetrics(response.items[0]) : {}),
          } : current);
          state.completed++;
          await this.save(state);
        }
      } else {
        state = { ...emptyDialogStats(ownerId), status: 'running' };
        // Replaces the old cache immediately; partial runs are never considered fresh.
        await this.save(state);
        const seen = new Set<number>();
        for (let offset = 0; ; offset += 200) {
          const page = await this.request<ConversationsPage>(ownerId, 'messages.getConversations', {
            offset, count: 200, extended: 1, fields: 'photo_100', filter: 'all',
          });
          if (!Array.isArray(page.items) || !Number.isSafeInteger(page.count) || page.count < 0) {
            throw new Error('INVALID_RESPONSE');
          }
          const rows = normalizeConversations(page).filter(row => {
            if (seen.has(row.peerId)) return false;
            seen.add(row.peerId);
            return true;
          });
          state.rows.push(...rows);
          state.total = page.count;
          state.completed = state.rows.length;
          await this.save(state);
          if (offset + page.items.length >= page.count || page.items.length < 200) break;
          if (!rows.length) throw new Error('PAGINATION_STALLED');
        }
        state.collectedAt = Date.now();
      }
      this.check();
      await this.save({ ...state, status: 'completed' });
    } catch (error) {
      await this.save({ ...state, status: this.cancelled ? 'cancelled' : 'failed', error: (error as Error).message });
    }
  }
}
