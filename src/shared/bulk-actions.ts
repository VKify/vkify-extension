import type { CenterApi } from './center-tools.js';

export interface BulkJob {
  id: string;
  title: string;
  method: string;
  params: Record<string, unknown>;
}
export interface BulkResult { job: BulkJob; success: boolean; error?: string; code?: string }
export interface BulkReport { results: BulkResult[]; remaining: BulkJob[]; stopped: boolean }

/** Abort interrupts pacing immediately; an already dispatched mutation must settle. */
export function bulkDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

export function mutationSucceeded(method: string, value: unknown): boolean {
  if (method === 'friends.add') return value === 2; // Only an accepted request counts as a new friend.
  if (method === 'friends.delete') {
    const result = value as Record<string, unknown> | null;
    return !!result && result.success === 1 && ['friend_deleted', 'out_request_deleted', 'in_request_deleted', 'suggestion_deleted'].some(key => result[key] === 1);
  }
  return value === 1;
}

let active = false;
/** One mutation queue per UI context. Never retry an ambiguous write automatically. */
export async function runBulkActions(jobs: BulkJob[], call: CenterApi, signal: AbortSignal,
  delayMs: number, onResult: (result: BulkResult, done: number, total: number) => void): Promise<BulkReport> {
  if (active) throw new Error('QUEUE_BUSY');
  active = true;
  const targets = [...new Map(jobs.map(job => [job.id, job])).values()];
  const results: BulkResult[] = [];
  let cursor = 0;
  try {
    for (; cursor < targets.length; cursor++) {
      if (signal.aborted) break;
      const job = targets[cursor]!;
      let result: BulkResult;
      try {
        const value = await call(job.method, job.params);
        result = mutationSucceeded(job.method, value) ? { job, success: true }
          : { job, success: false, error: 'UNEXPECTED_RESULT', code: 'UNEXPECTED_RESULT' };
      } catch (error) {
        const err = error as { code?: unknown; message?: string };
        result = { job, success: false, code: String(err?.code ?? ''), error: err?.message ?? 'REQUEST_FAILED' };
      }
      results.push(result);
      onResult(result, results.length, targets.length);
      // Object-specific denial may be skipped. Auth, captcha, flood and uncertain
      // transport outcomes stop the queue so the user can inspect before resuming.
      if (!result.success && !['15', '18', '19', '100', '203', '204', '800', '801'].includes(result.code ?? '')) { cursor++; break; }
      if (cursor < targets.length - 1) await bulkDelay(Math.max(1000, Math.min(30000, Number.isFinite(delayMs) ? delayMs : 2000)), signal);
    }
    return { results, remaining: targets.slice(cursor), stopped: cursor < targets.length };
  } finally { active = false; }
}
