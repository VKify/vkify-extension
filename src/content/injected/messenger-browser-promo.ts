import { registerRequestHook, registerResponseHook } from '../../shared/utils/fetch-hooks.js';

type Data = Record<string, any>;
const record = (value: unknown): value is Data => !!value && typeof value === 'object' && !Array.isArray(value);
const methods = new Set(['account.getInfo', 'messages.getConfig']);

/** Observed IM config: remove only the Yandex offer, never other conversation bars. */
export function filterMessengerBrowserPromo(method: string, response: unknown): boolean {
  if (!methods.has(method) || !record(response)) return false;
  const container = method === 'messages.getConfig' ? response.config : response;
  if (!record(container)) return false;
  const key = method === 'messages.getConfig' ? 'conversation_bar' : 'conversations_bar';
  if (!record(container[key]) || container[key].name !== 'yandex_promo') return false;
  delete container[key];
  return true;
}

function apiMethod(value: string): string | undefined {
  try {
    const url = new URL(value, location.href);
    if (url.protocol !== 'https:' || !['api.vk.ru', 'web.api.vk.ru'].includes(url.hostname)) return;
    return /^\/method\/([^/]+)$/.exec(url.pathname)?.[1];
  } catch { return; }
}

export function installMessengerBrowserPromo(enabled: () => boolean, report: () => void): () => void {
  const bodies = new WeakMap<Request, string>();
  const stopRequest = registerRequestHook(async (url, input, init) => {
    if (apiMethod(url) === 'batch.call' && input instanceof Request && !init?.body)
      bodies.set(input, await input.clone().text());
    return undefined;
  });
  const stopResponse = registerResponseHook(async (url, response, input, init) => {
    const method = apiMethod(url);
    if (!enabled() || !response.ok || (!methods.has(method ?? '') && method !== 'batch.call')) return response;
    const data = await response.clone().json();
    if (!enabled()) return response;
    let changed = false;
    if (method === 'batch.call') {
      const body = init?.body ?? (input instanceof Request ? bodies.get(input) : undefined);
      if (typeof body !== 'string') return response;
      const requests = JSON.parse(body)?.requests;
      if (!Array.isArray(requests) || !Array.isArray(data?.responses)) return response;
      const map = new Map(requests.map(item => [String(item?.id), item?.method]));
      for (const item of data.responses) changed = filterMessengerBrowserPromo(map.get(String(item?.id)), item?.body?.response) || changed;
    } else changed = filterMessengerBrowserPromo(method!, data?.response);
    if (!changed) return response;
    report();
    const headers = new Headers(response.headers);
    headers.delete('content-length'); headers.delete('content-encoding');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  });
  return () => { stopRequest(); stopResponse(); };
}
