import { afterEach, expect, it, vi } from 'vitest';
import { createVideoFrameMetadata, VIDEO_FRAME_FIELDS } from './card-frame-metadata.js';
const card = (id = 2) => ({ id, owner_id: -1, title: 'TITLE', duration: 10, image: [{ url: 'https://sun9.userapi.com/original.jpg' }] });
const timeline = { count_total: 3, count_per_image: 3, count_per_row: 3, frame_width: 160, frame_height: 90, links: ['https://iv.okcdn.ru/videoPreview?uidx=0'] };
afterEach(() => vi.useRealTimers());

it('coalesces separate API responses and deduplicates IDs without copying titles', async () => {
  vi.useFakeTimers();
  const call = vi.fn(async (_params: { videos: string }) => ({ items: [2, 3].map(id => ({ ...card(id), title: 'DO NOT COPY', timeline_thumbs: timeline })) }));
  const engine = createVideoFrameMetadata(call), first = card(), second = card(3);
  const one = engine.enrich({ videos: [first, card()] }, 'start', () => true);
  const two = engine.enrich({ videos: [second] }, 'start', () => true);
  expect(call).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(12); await Promise.all([one, two]);
  expect(call).toHaveBeenCalledOnce(); expect(call.mock.calls[0][0]).toEqual({ videos: '-1_2,-1_3', video_fields: VIDEO_FRAME_FIELDS });
  expect(first.title).toBe('TITLE'); expect(Reflect.get(first, 'timeline_thumbs')).toEqual(timeline);
  const next = card(); await engine.enrich({ videos: [next] }, 'start', () => true);
  expect(call).toHaveBeenCalledOnce(); expect(Reflect.get(next, 'timeline_thumbs')).toEqual(timeline);
});
it('makes no API requests when the native response already has the requested frame', async () => {
  const call = vi.fn(), engine = createVideoFrameMetadata(call);
  await engine.enrich({ videos: [{ ...card(), timeline_thumbs: timeline }] }, 'start', () => true);
  expect(call).not.toHaveBeenCalled();
});
it('queues remaining IDs in paced batches instead of silently losing the next catalog response', async () => {
  vi.useFakeTimers(); const call = vi.fn(async (_params: { videos: string }) => ({ items: [] })), engine = createVideoFrameMetadata(call);
  const work = engine.enrich({ videos: Array.from({ length: 100 }, (_, i) => card(i + 1)) }, 'end', () => true);
  await vi.advanceTimersByTimeAsync(12); expect(call.mock.calls[0][0].videos.split(',')).toHaveLength(50);
  await vi.advanceTimersByTimeAsync(349); expect(call).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1); await work; expect(call).toHaveBeenCalledTimes(2);
  expect(call.mock.calls[1][0].videos.split(',')).toHaveLength(50);
});
it('ignores in-flight results after clear and retains the private access key only in the request', async () => {
  vi.useFakeTimers(); let resolve!: (value: unknown) => void;
  const call = vi.fn((_params: unknown, _signal: AbortSignal) => new Promise(r => { resolve = r; })), engine = createVideoFrameMetadata(call);
  const v = { ...card(), access_key: 'private_key' }, work = engine.enrich({ videos: [v] }, 'start', () => true);
  await vi.advanceTimersByTimeAsync(12); expect(call.mock.calls[0][0]).toMatchObject({ videos: '-1_2_private_key' });
  engine.clear(); expect(call.mock.calls[0][1].aborted).toBe(true); await work;
  resolve({ items: [{ ...card(), timeline_thumbs: timeline }] }); await vi.advanceTimersByTimeAsync(1);
  expect(Reflect.get(v, 'timeline_thumbs')).toBeUndefined();
});
it('replaces empty timeline placeholders and caches unavailable metadata without repeated requests', async () => {
  vi.useFakeTimers();
  const timeline = { count_total: 3, count_per_image: 3, count_per_row: 3, frame_width: 160, frame_height: 90, links: ['https://iv.okcdn.ru/videoPreview?uidx=0'] };
  const call = vi.fn(async () => ({ items: [{ ...card(), timeline_thumbs: timeline }] })), engine = createVideoFrameMetadata(call);
  const v = { ...card(), timeline_thumbs: {} }, first = engine.enrich({ videos: [v, card(3)] }, 'middle', () => true);
  await vi.advanceTimersByTimeAsync(12); await first; expect(v.timeline_thumbs).toEqual(timeline);
  await engine.enrich({ videos: [card(3)] }, 'middle', () => true); expect(call).toHaveBeenCalledOnce();
});
it('drops expired queued work and cools down on an API error', async () => {
  vi.useFakeTimers(); const call = vi.fn(async () => { throw new Error('denied'); }), engine = createVideoFrameMetadata(call);
  let valid = true; const abandoned = engine.enrich({ videos: [card()] }, 'end', () => valid); valid = false;
  await vi.advanceTimersByTimeAsync(12); await abandoned; expect(call).not.toHaveBeenCalled();
  const failed = engine.enrich({ videos: [card(3)] }, 'end', () => true);
  await vi.advanceTimersByTimeAsync(12); await failed; expect(call).toHaveBeenCalledOnce();
  await engine.enrich({ videos: [card(4)] }, 'end', () => true); expect(call).toHaveBeenCalledOnce();
});
it('refreshes stale search links on demand, then reuses the canonical metadata', async () => {
  vi.useFakeTimers();
  const fresh = { ...timeline, links: ['https://iv.okcdn.ru/videoPreview?fresh=1'] };
  const call = vi.fn(async () => ({ items: [{ ...card(), timeline_thumbs: fresh }] }));
  const engine = createVideoFrameMetadata(call), old = { ...card(), timeline_thumbs: timeline };
  await engine.prepare(old, 'start', () => true); expect(call).not.toHaveBeenCalled();
  const work = engine.prepare(old, 'start', () => true, true);
  await vi.advanceTimersByTimeAsync(12); await work; expect(old.timeline_thumbs).toEqual(fresh);
  const next = { ...card(), timeline_thumbs: timeline };
  await engine.prepare(next, 'start', () => true); expect(next.timeline_thumbs).toEqual(fresh); expect(call).toHaveBeenCalledOnce();
});
