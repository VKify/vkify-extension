import { registerResponseHook } from '@/shared/utils/fetch-hooks.js';
import { videoFrameApiMethod, videoFramePosition } from '@/shared/video-card-frame.js';
import { interceptFeedPrefetch } from '@/content/injected/feed-prefetch.js';
import { createVideoFrameTransformer, cropVideoSprite, type CropVideoSprite } from './card-frame-transform.js';
import { createVideoFrameMetadata, VIDEO_FRAME_FIELDS, VIDEO_FRAME_METHOD, type VideoFrameMetadataCall } from './card-frame-metadata.js';
import { interceptLegacyVideoCatalogue } from './card-frames-legacy.js';

const SETTINGS_EVENT = 'vkify:video-frames:settings';
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const RESPONSE_BUDGET_MS = 1000;

/** MAIN-world, on demand. VK renders the changed image data itself. */
export function installVideoCardFrameInterceptor(crop: CropVideoSprite = cropVideoSprite, metadataCall?: VideoFrameMetadataCall): () => void {
  const target = window as Window & { __vkifyVideoFrameInterceptor?: boolean; apiPrefetchReadyPromise?: Promise<unknown> };
  if (target.__vkifyVideoFrameInterceptor) return () => {};
  target.__vkifyVideoFrameInterceptor = true;
  const metadata = createVideoFrameMetadata(metadataCall ?? (async (params, signal) => {
    const api = (window as Window & { vkApi?: { api?: (...args: unknown[]) => Promise<unknown> } }).vkApi;
    if (!api?.api) return undefined;
    return api.api(VIDEO_FRAME_METHOD, params, { grouping: false, domain: 'api.vkvideo.ru' }, { signal });
  }));
  const transformer = createVideoFrameTransformer(crop, metadata.prepare);
  let enabled = false, position = videoFramePosition(null), revision = 0;
  let stopFetch: (() => void) | undefined, stopPrefetch: (() => void) | undefined;
  let stopLegacy: (() => void) | undefined;
  let prefetched = new WeakSet<object>();

  async function transform(data: unknown): Promise<boolean> {
    const own = revision;
    let expired = false;
    // Race bounds catalogue latency. Late work may populate the bounded cache,
    // but may never alter a response already delivered or a disabled feature.
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        transformer.transform(data, position, () => enabled && !expired && own === revision),
        new Promise<boolean>(resolve => { deadline = setTimeout(() => {
          expired = true;
          // Keep already prepared API images; one slow sheet must not discard
          // every other frame. Outstanding tasks cannot mutate delivered data.
          resolve(enabled && own === revision && transformer.hasChanges(data));
        }, RESPONSE_BUDGET_MS); }),
      ]);
    } finally { clearTimeout(deadline); expired = true; }
  }

  function processPrefetch(entry: { method: string; response?: unknown }): void {
    if (!enabled || document.hidden || !videoFrameApiMethod(`/method/${entry.method}`, 'https://vk.ru') ||
      !entry.response || typeof entry.response !== 'object' || prefetched.has(entry.response)) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, 'apiPrefetchReadyPromise');
    if (descriptor && (!('value' in descriptor) || !descriptor.writable)) return;
    prefetched.add(entry.response);
    const data = entry.response;
    const job = transform(data).catch(() => false);
    // apiWithPrefetch awaits this existing VK barrier before decoding its cache.
    // Compose with it; never discard VK's pending initialization or reject it.
    const previous = target.apiPrefetchReadyPromise;
    target.apiPrefetchReadyPromise = Promise.all([previous, job]).then(() => undefined);
  }

  function stop(): void {
    revision++; enabled = false;
    stopFetch?.(); stopFetch = undefined;
    stopLegacy?.(); stopLegacy = undefined;
    // Restore unconsumed prefetched covers before removing the shared observer.
    const cur = Reflect.get(window, 'cur');
    if (Array.isArray(cur?.apiPrefetchCache)) for (const entry of cur.apiPrefetchCache) transformer.restore(entry?.response);
    stopPrefetch?.(); stopPrefetch = undefined;
    transformer.clear(); metadata.clear(); prefetched = new WeakSet();
  }

  const settings = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail || typeof detail !== 'object') return;
    const next = videoFramePosition(detail.position);
    if (detail.enabled !== true) { stop(); return; }
    if (enabled && next === position) return;
    if (enabled) stop();
    enabled = true; position = next; revision++;
    stopLegacy = interceptLegacyVideoCatalogue(transform);
    stopFetch = registerResponseHook(async (url, response, input, init) => {
      const method = videoFrameApiMethod(url, location.href);
      if (!enabled || document.hidden || !response.ok || !method ||
        !/^application\/(?:[\w.+-]+\+)?json\b/i.test(response.headers.get('content-type') ?? '') ||
        Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) return response;
      const own = revision;
      try {
        // Native APIs sometimes return default card fields even when only frame
        // metadata was requested. Never recursively enrich/crop our own batch.
        if (method === VIDEO_FRAME_METHOD) {
          const body = init?.body ?? (input instanceof Request ? await input.clone().text() : null);
          if ((typeof body === 'string' || body instanceof URLSearchParams) &&
            new URLSearchParams(body).get('video_fields') === VIDEO_FRAME_FIELDS) return response;
        }
        // Stream cap also protects chunked responses with no Content-Length.
        const clone = response.clone(), reader = clone.body?.getReader();
        if (!reader) return response;
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (!enabled || own !== revision || size > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); return response; }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (!enabled || own !== revision || !await transform(data) || !enabled || own !== revision) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length'); headers.delete('content-encoding');
        return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
      } catch { return response; }
    });
    stopPrefetch = interceptFeedPrefetch(window, processPrefetch);
  };
  window.addEventListener(SETTINGS_EVENT, settings);
  const cleanup = () => {
    stop(); window.removeEventListener(SETTINGS_EVENT, settings);
    window.removeEventListener('vkify-destroy', cleanup);
    window.removeEventListener('message', destroy);
    delete target.__vkifyVideoFrameInterceptor;
  };
  const destroy = (event: MessageEvent) => {
    if (event.source === window && event.data?.type === 'VKIFY_DESTROY') cleanup();
  };
  window.addEventListener('vkify-destroy', cleanup);
  window.addEventListener('message', destroy);
  return cleanup;
}
