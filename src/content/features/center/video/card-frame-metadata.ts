import { collectVideoCards, videoSpriteFrame, videoFrameAllowed, type VideoFramePosition } from '@/shared/video-card-frame.js';
import { TtlCache } from '@/shared/utils/ttl-cache.js';

// Match the fields requested by VK's own preview-player API, not video.get.
export const VIDEO_FRAME_FIELDS = 'image,timeline_thumbs';
export const VIDEO_FRAME_METHOD = 'video.getByIds';
export type VideoFrameMetadataCall = (params: { videos: string; video_fields: string }, signal: AbortSignal) => Promise<unknown>;
type Metadata = Record<string, unknown> | null;
interface Job {
  request: string; id: string; started: boolean; valid: Set<() => boolean>;
  promise: Promise<Metadata>; resolve: (value: Metadata) => void;
}

/** Coalesce simultaneous catalog/feed responses into native VK metadata batches. */
export function createVideoFrameMetadata(call: VideoFrameMetadataCall) {
  const cache = new TtlCache<string, Metadata>(400, 5 * 60_000);
  const pending = new Map<string, Job>();
  let controller = new AbortController(), revision = 0, busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastStart = -Infinity, blockedUntil = 0;

  function fill(video: Record<string, unknown>, metadata: Metadata | undefined): void {
    if (!metadata) return;
    if (!video.duration && metadata.duration) video.duration = metadata.duration;
    // getByIds is authoritative: search can contain structurally valid but stale
    // sprite links. Reuse a previously refreshed canonical set on later pages.
    if (metadata.timeline_thumbs) video.timeline_thumbs = metadata.timeline_thumbs;
  }
  function finish(job: Job, value: Metadata): void {
    if (pending.get(job.request) === job) pending.delete(job.request);
    job.resolve(value);
  }
  function schedule(): void {
    if (timer || busy || !pending.size) return;
    timer = setTimeout(() => { timer = undefined; void pump(); }, Math.max(12, 350 - (Date.now() - lastStart)));
  }
  async function pump(): Promise<void> {
    const batch: Job[] = [];
    for (const job of pending.values()) {
      if (job.started) continue;
      if (![...job.valid].some(valid => valid())) { finish(job, null); continue; }
      job.started = true; batch.push(job);
      if (batch.length === 50) break;
    }
    if (!batch.length) return;
    const own = revision, signal = controller.signal;
    const request = new AbortController(), abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    busy = true; lastStart = Date.now();
    try {
      const result = await Promise.race([
        call({ videos: batch.map(job => job.request).join(','), video_fields: VIDEO_FRAME_FIELDS }, request.signal),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { request.abort(); reject(new Error('Frame metadata timeout')); }, 2000); }),
      ]) as { items?: Record<string, unknown>[] };
      if (own !== revision || signal.aborted) return;
      if (!Array.isArray(result?.items)) { batch.forEach(job => finish(job, null)); return; }
      const items = new Map<string, Metadata>();
      for (const item of result.items.slice(0, 50)) {
        if (item && videoFrameAllowed(item)) items.set(`${item.owner_id}_${item.id}`,
          { timeline_thumbs: item.timeline_thumbs, duration: item.duration });
      }
      for (const job of batch) { const value = items.get(job.id) ?? null; cache.set(job.request, value); finish(job, value); }
    } catch {
      if (own === revision) {
        blockedUntil = Date.now() + 60_000;
        for (const job of pending.values()) finish(job, null);
      }
    } finally {
      clearTimeout(timeout); signal.removeEventListener('abort', abort);
      if (own === revision) { busy = false; schedule(); }
    }
  }
  async function prepare(video: Record<string, unknown>, position: VideoFramePosition, valid: () => boolean, refresh = false): Promise<void> {
    if (!valid()) return;
    const id = `${video.owner_id}_${video.id}`;
    const key = typeof video.access_key === 'string' && /^[\w-]{1,256}$/.test(video.access_key) ? video.access_key : '';
    const request = key ? `${id}_${key}` : id;
    fill(video, cache.get(request));
    if ((!refresh && videoSpriteFrame(video, position)) || cache.has(request) || Date.now() < blockedUntil) return;
    let job = pending.get(request);
    if (!job) {
      if (pending.size >= 200) return;
      let resolve!: (value: Metadata) => void;
      const promise = new Promise<Metadata>(done => { resolve = done; });
      job = { request, id, promise, resolve, started: false, valid: new Set() };
      pending.set(request, job);
    }
    job.valid.add(valid); schedule();
    const own = revision, metadata = await job.promise;
    if (own === revision && valid()) fill(video, metadata);
  }
  return {
    prepare,
    enrich: async (data: unknown, position: VideoFramePosition, valid: () => boolean): Promise<void> => {
      await Promise.all(collectVideoCards(data).map(card => prepare(card, position, valid)));
    },
    clear(): void {
      revision++; controller.abort(); controller = new AbortController();
      clearTimeout(timer); timer = undefined;
      for (const job of pending.values()) job.resolve(null);
      pending.clear(); busy = false; cache.clear(); lastStart = -Infinity; blockedUntil = 0;
    },
  };
}
