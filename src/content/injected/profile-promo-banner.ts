import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';
import { videoApiMethod } from './utils/video-ad-request.js';

const METHOD = 'owners.getBanner';
// pageProfile.3ea23a75.js: BusinessPremiumBanner requests type 26. Other owner
// banners are unrelated; never remove them based on their title or target app.
const isPromo = (method: unknown, params: unknown): boolean => method === METHOD
  && !!params && typeof params === 'object' && String(Reflect.get(params, 'banner_type')) === '26';

async function paramsFor(url: string, input: RequestInfo | URL, init?: RequestInit): Promise<Record<string, unknown>> {
  const params: Record<string, unknown> = Object.fromEntries(new URL(url, location.href).searchParams);
  const body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
  if (body instanceof URLSearchParams || body instanceof FormData) return { ...params, ...Object.fromEntries(body) };
  if (typeof body !== 'string') return params;
  try { return { ...params, ...JSON.parse(body) }; }
  catch { return { ...params, ...Object.fromEntries(new URLSearchParams(body)) }; }
}

export function installProfilePromoBanner(enabled: () => boolean, report: () => void): () => void {
  const batches = new WeakMap<Request, Record<string, unknown>>();
  const stopRequest = registerRequestHook(async (url, input, init) => {
    const method = videoApiMethod(url);
    if (!enabled() || (method !== METHOD && method !== 'batch.call')) return;
    const params = await paramsFor(url, input, init);
    if (!enabled()) return;
    if (method === 'batch.call' && input instanceof Request) batches.set(input, params);
    if (!isPromo(method, params)) return;
    report();
    return new Response(JSON.stringify({ response: {} }), { headers: { 'Content-Type': 'application/json' } });
  });
  const stopResponse = registerResponseHook(async (url, response, input, init) => {
    if (!enabled() || !response.ok || videoApiMethod(url) !== 'batch.call') return response;
    const params = (input instanceof Request && !init?.body ? batches.get(input) : undefined) ?? await paramsFor(url, input, init);
    const requests = params?.requests;
    if (!Array.isArray(requests)) return response;
    const ids = new Set(requests.filter(item => isPromo(item?.method, item?.params)).map(item => String(item.id)));
    if (!ids.size) return response;
    const data = await response.clone().json();
    if (!enabled() || !Array.isArray(data?.responses)) return response;
    let changed = false;
    for (const entry of data.responses) {
      if (ids.has(String(entry?.id)) && entry?.body?.response?.banner) {
        delete entry.body.response.banner; changed = true; report();
      }
    }
    if (!changed) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  });
  const stopPrefetch = interceptFeedPrefetch(window, entry => {
    if (!enabled() || !isPromo(entry.method, entry.request) || !entry.response || typeof entry.response !== 'object') return;
    if (Reflect.has(entry.response, 'banner')) { Reflect.deleteProperty(entry.response, 'banner'); report(); }
  });
  return () => { stopRequest(); stopResponse(); stopPrefetch(); };
}
