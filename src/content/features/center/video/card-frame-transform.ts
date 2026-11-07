import { collectVideoCards, videoSpriteFrame, type VideoFrameImage, type VideoFramePosition, type VideoSpriteFrame } from '@/shared/video-card-frame.js';
import { TtlCache } from '@/shared/utils/ttl-cache.js';

export type CropVideoSprite = (frame: VideoSpriteFrame, signal: AbortSignal) => Promise<VideoFrameImage | null>;
type PrepareVideoFrame = (video: Record<string, unknown>, position: VideoFramePosition, valid: () => boolean, refresh?: boolean) => Promise<void>;
interface PendingFrame {
  promise: Promise<VideoFrameImage[] | null>;
  valid: Set<() => boolean>;
}
interface FrameJob { run: () => Promise<void>; cancel: () => void }

/** Bounded parallel preparation of API objects; never observes or changes UI nodes. */
export function createVideoFrameTransformer(crop: CropVideoSprite, prepare?: PrepareVideoFrame) {
  const cache = new TtlCache<string, VideoFrameImage[]>(128, 10 * 60_000);
  const failed = new TtlCache<string, true>(128, 30_000);
  const pending = new Map<string, PendingFrame>();
  const queue: FrameJob[] = [];
  const originals = new WeakMap<object, unknown>();
  let generation = 0, controller = new AbortController(), activeCrops = 0;

  function drain(): void {
    while (activeCrops < 4 && queue.length) {
      const job = queue.shift()!;
      activeCrops++;
      void job.run().finally(() => { activeCrops--; drain(); });
    }
  }
  function frames(video: Record<string, unknown>, position: VideoFramePosition, valid: () => boolean, priority = false): Promise<VideoFrameImage[] | null> {
    const sprite = videoSpriteFrame(video, position);
    if (!sprite) return Promise.resolve(null);
    const key = `${sprite.url}:${sprite.x}:${sprite.y}:${sprite.width}:${sprite.height}`;
    // Signed CDN URLs rotate between search responses. A prepared frame still
    // belongs to the same video/time, so rotating a URL must not redownload it.
    const thumbs = video.timeline_thumbs as Record<string, unknown>;
    const cardKey = JSON.stringify([video.owner_id, video.id, video.access_key, position, video.duration,
      thumbs.count_total, thumbs.frequency, sprite.x, sprite.y, sprite.width, sprite.height]);
    const hit = cache.get(cardKey);
    if (hit) return Promise.resolve(hit);
    if (failed.has(key)) return Promise.resolve(null);
    const shared = pending.get(key);
    if (shared) {
      shared.valid.add(valid);
      const own = generation;
      return shared.promise.then(images => { if (images && own === generation) cache.set(cardKey, images); return images; });
    }
    if (pending.size >= 64) return Promise.resolve(null);
    let resolve!: (value: VideoFrameImage[] | null) => void;
    const entry: PendingFrame = { promise: new Promise(done => { resolve = done; }), valid: new Set([valid]) };
    pending.set(key, entry);
    const own = generation, signal = controller.signal;
    const finish = (images: VideoFrameImage[] | null) => {
      if (pending.get(key) === entry) pending.delete(key);
      resolve(images);
    };
    const job: FrameJob = {
      cancel: () => finish(null),
      async run() {
        if (own !== generation || signal.aborted || ![...entry.valid].some(check => check())) { finish(null); return; }
        let images: VideoFrameImage[] | null = null;
        try {
          const image = await crop(sprite, signal);
          if (image) images = [image];
          if (own === generation && !signal.aborted) {
            if (images) cache.set(cardKey, images);
            else failed.set(key, true);
          }
        } catch { if (own === generation && !signal.aborted) failed.set(key, true); }
        finally { finish(images); }
      },
    };
    if (priority) queue.unshift(job); else queue.push(job);
    drain();
    return entry.promise;
  }

  return {
    async transform(data: unknown, position: VideoFramePosition, valid: () => boolean = () => true): Promise<boolean> {
      const own = generation;
      let changed = false;
      await Promise.all(collectVideoCards(data).map(async video => {
        if (!valid() || own !== generation) return;
        await prepare?.(video, position, valid);
        if (!valid() || own !== generation) return;
        let images = await frames(video, position, valid);
        if (!images && prepare && valid() && own === generation) {
          // A valid-looking search URL may return 404. Refresh metadata once in
          // the shared native API batch, then try the canonical link first.
          await prepare(video, position, valid, true);
          if (valid() && own === generation) images = await frames(video, position, valid, true);
        }
        if (!valid() || own !== generation || !images?.length) return;
        if (!originals.has(video)) originals.set(video, video.image);
        // Static frames need size variants: a single image is interpreted by VK
        // as a server-resizable base image. Both variants reuse the same bytes.
        const image = images[0];
        video.image = images.length === 1 && !image.is_base ? [
          { ...image, width: Math.max(1, Math.floor(image.width / 2)), height: Math.max(1, Math.floor(image.height / 2)) }, image,
        ] : images;
        changed = true;
      }));
      return changed;
    },
    hasChanges(data: unknown): boolean {
      return collectVideoCards(data).some(video => originals.has(video) && video.image !== originals.get(video));
    },
    restore(data: unknown): void {
      for (const video of collectVideoCards(data)) if (originals.has(video)) video.image = originals.get(video);
    },
    clear(): void {
      generation++;
      controller.abort(); controller = new AbortController(); cache.clear(); failed.clear();
      for (const job of queue.splice(0)) job.cancel();
      // Running decodes release their own slots; never count them as idle early.
    },
  };
}

/** Native image APIs only: no HTML canvas, hidden player, or page layout work. */
export async function cropVideoSprite(frame: VideoSpriteFrame, signal: AbortSignal): Promise<VideoFrameImage | null> {
  const request = new AbortController();
  const abort = () => request.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 1200);
  let bitmap: ImageBitmap | undefined;
  try {
    if (signal.aborted) return null;
    const response = await fetch(frame.url, { credentials: 'omit', signal: request.signal, referrerPolicy: 'no-referrer' });
    if (!response.ok || !/^image\/(?:jpeg|png|webp|avif)/i.test(response.headers.get('content-type') ?? '') ||
      Number(response.headers.get('content-length')) > 4 * 1024 * 1024) return null;
    const blob = await response.blob();
    if (blob.size > 4 * 1024 * 1024 || signal.aborted) return null;
    bitmap = await createImageBitmap(blob);
    if (signal.aborted || bitmap.width * bitmap.height > 16_777_216 ||
      frame.x + frame.width > bitmap.width || frame.y + frame.height > bitmap.height) return null;
    const canvas = new OffscreenCanvas(frame.width, frame.height);
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(bitmap, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    if (signal.aborted) return null;
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { url: `data:image/jpeg;base64,${btoa(binary)}`, width: frame.width, height: frame.height };
  } catch { return null; }
  finally { bitmap?.close(); clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
