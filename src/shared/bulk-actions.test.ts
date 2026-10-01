import { afterEach, expect, it, vi } from 'vitest';
import { mutationSucceeded, runBulkActions, type BulkJob } from './bulk-actions.js';

const jobs: BulkJob[] = [1, 2, 3].map(id => ({ id: String(id), title: `Group ${id}`, method: 'groups.leave', params: { group_id: id } }));
afterEach(() => vi.useRealTimers());

it('paces writes, deduplicates targets and reports only acknowledged successes', async () => {
  vi.useFakeTimers();
  const call = vi.fn().mockResolvedValue(1), progress = vi.fn();
  const pending = runBulkActions([jobs[0]!, jobs[0]!, jobs[1]!], call, new AbortController().signal, 2000, progress);
  await vi.advanceTimersByTimeAsync(1999);
  expect(call).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  const report = await pending;
  expect(call).toHaveBeenCalledTimes(2);
  expect(report.remaining).toEqual([]);
  expect(report.results.every(result => result.success)).toBe(true);
  expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ success: true }), 2, 2);
});

it('stops immediately during pacing and retains untouched jobs', async () => {
  vi.useFakeTimers();
  const controller = new AbortController(), call = vi.fn().mockResolvedValue(1);
  const pending = runBulkActions(jobs, call, controller.signal, 30000, () => {});
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  const report = await pending;
  expect(call).toHaveBeenCalledTimes(1);
  expect(report.remaining).toEqual(jobs.slice(1));
});

it('settles the in-flight write on stop and prevents concurrent queues', async () => {
  const controller = new AbortController();
  let resolve!: (value: unknown) => void;
  const call = vi.fn(() => new Promise(r => { resolve = r; }));
  const pending = runBulkActions(jobs, call, controller.signal, 2000, () => {});
  await expect(runBulkActions(jobs, call, new AbortController().signal, 2000, () => {})).rejects.toThrow('QUEUE_BUSY');
  controller.abort(); resolve(1);
  const report = await pending;
  expect(report.results).toHaveLength(1);
  expect(report.results[0]?.success).toBe(true);
  expect(report.remaining).toEqual(jobs.slice(1));
});

it.each(['5', '6', '7', '9', '14', '29', 'ACCOUNT_CHANGED', ''])('stops on fatal or uncertain error %s without retries', async code => {
  const call = vi.fn().mockRejectedValue(Object.assign(new Error('Denied'), { code }));
  const report = await runBulkActions(jobs, call, new AbortController().signal, 1000, () => {});
  expect(call).toHaveBeenCalledTimes(1);
  expect(report.results[0]).toMatchObject({ success: false, code });
  expect(report.remaining).toEqual(jobs.slice(1));
});

it('skips only item-specific failures and does not treat false as success', async () => {
  vi.useFakeTimers();
  const call = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Private'), { code: 15 })).mockResolvedValueOnce(0);
  const pending = runBulkActions(jobs, call, new AbortController().signal, 1000, () => {});
  await vi.runAllTimersAsync();
  const report = await pending;
  expect(call).toHaveBeenCalledTimes(2);
  expect(report.results.map(r => r.success)).toEqual([false, false]);
  expect(report.remaining).toEqual(jobs.slice(2));
});

it('requires method-specific confirmation from VK', () => {
  expect(mutationSucceeded('friends.add', 1)).toBe(false);
  expect(mutationSucceeded('friends.add', 2)).toBe(true);
  expect(mutationSucceeded('friends.delete', { success: 1, out_request_deleted: 1 })).toBe(true);
  expect(mutationSucceeded('friends.delete', { success: 1 })).toBe(false);
});

it('never dispatches a pre-cancelled queue', async () => {
  const controller = new AbortController(); controller.abort();
  const call = vi.fn();
  const report = await runBulkActions(jobs, call, controller.signal, 1000, () => {});
  expect(call).not.toHaveBeenCalled();
  expect(report.remaining).toEqual(jobs);
});
