import { registerRequestHook } from '../../shared/utils/fetch-hooks.js';
import { interceptFeedPrefetch } from './feed-prefetch.js';

const key = '__vkifyFriendsSuggestionsFilter';
const methodUrl = 'https://web.api.vk.ru/method/friends.getRecommendations';
const refs = new Set(['friends_main_recommended_friends_right_block', 'friends_main_recommended_block']);

function isSuggestions(ref: unknown): boolean {
  return typeof ref === 'string' && refs.has(ref);
}

function clearSuggestions(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const data = response as { count?: unknown; items?: unknown; next_from?: unknown };
  if (!Array.isArray(data.items) || (!data.items.length && data.count === 0 && !data.next_from)) return false;
  data.items = [];
  data.count = 0;
  delete data.next_from;
  return true;
}

async function requestRef(url: URL, input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const queryRef = url.searchParams.get('ref');
  if (queryRef) return queryRef;
  const body = init?.body;
  if (body instanceof URLSearchParams || body instanceof FormData) return body.get('ref');
  if (typeof body === 'string') return new URLSearchParams(body).get('ref');
  if (!body && input instanceof Request) return new URLSearchParams(await input.clone().text()).get('ref');
  return null;
}

if (!Reflect.get(window, key)) {
  Reflect.set(window, key, true);
  let stop: (() => void) | undefined;
  const update = (event: Event): void => {
    const enabled = (event as CustomEvent).detail?.hide_friends_suggestions;
    if (enabled === false) {
      stop?.(); stop = undefined;
    } else if (enabled === true && !stop) {
      const stopFetch = registerRequestHook(async (url, input, init) => {
        if (!stop || !url.startsWith(methodUrl)) return;
        const parsed = new URL(url);
        if (parsed.pathname !== '/method/friends.getRecommendations') return;
        const registration = stop;
        if (!isSuggestions(await requestRef(parsed, input, init)) || stop !== registration) return;
        // VK's component returns null for an empty items array, including its frame.
        return new Response(JSON.stringify({ response: { count: 0, items: [] } }), {
          headers: { 'content-type': 'application/json' },
        });
      });
      const stopPrefetch = interceptFeedPrefetch(window, entry => {
        if (entry.method !== 'friends.getRecommendations' || !entry.request || typeof entry.request !== 'object') return;
        if (isSuggestions(Reflect.get(entry.request, 'ref'))) clearSuggestions(entry.response);
      });
      stop = () => { stopFetch(); stopPrefetch(); };
    }
  };
  const destroy = (event: MessageEvent): void => {
    if (event.source !== window || event.data?.type !== 'VKIFY_DESTROY') return;
    stop?.(); stop = undefined;
    window.removeEventListener('vkify-update-settings', update);
    window.removeEventListener('message', destroy);
    Reflect.deleteProperty(window, key);
  };
  window.addEventListener('vkify-update-settings', update);
  window.addEventListener('message', destroy);
  window.dispatchEvent(new CustomEvent('vkify-script-ready', { detail: { name: 'friends-suggestions-filter' } }));
}
