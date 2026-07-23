/**
 * ONE window.fetch wrapper for all injected scripts.
 *
 * Before: anti-tracking, tracker-blocker, feed-ad-blocker and spy-agent each did
 * `window.fetch = async function(){…}` independently — a 4-deep wrapper chain
 * on every request the VK SPA makes, where load order also decided which
 * script's patched fetch another captured as "original" (so restore-on-destroy
 * could leave a wrapper installed).
 *
 * Now: the first injected script to register installs a single wrapper that
 * captures the real fetch once and lives as a singleton on `window`
 * (injected scripts share the page's MAIN world). Every script registers a
 * request hook (may short-circuit with a Response) and/or a response hook
 * (may transform the Response). Each bundle inlines this file, but they all
 * coordinate through the one `window[COORDINATOR_KEY]` registry.
 */

export type RequestHook = (
  url: string,
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | null | undefined;

export type ResponseHook = (
  url: string,
  response: Response,
  input: RequestInfo | URL,
  init?: RequestInit,
) => Response | Promise<Response>;

interface FetchCoordinator {
  original: typeof fetch;
  wrapper: typeof fetch;
  requestHooks: RequestHook[];
  responseHooks: ResponseHook[];
}

const COORDINATOR_KEY = '__vkifyFetchCoordinator';

export function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return '';
}

function ensureCoordinator(): FetchCoordinator {
  const w = window as unknown as Record<string, FetchCoordinator | undefined>;
  const existing = w[COORDINATOR_KEY];
  if (existing) return existing;

  const original = window.fetch;
  const coordinator: FetchCoordinator = {
    original,
    wrapper: original,
    requestHooks: [],
    responseHooks: [],
  };

  const wrapper: typeof fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = extractUrl(input);

    for (const hook of coordinator.requestHooks) {
      try {
        const short = hook(url, input, init);
        if (short) return short;
      } catch { /* a misbehaving hook must not break the request */ }
    }

    let response = await coordinator.original.call(window, input as RequestInfo, init);

    for (const hook of coordinator.responseHooks) {
      try {
        response = await hook(url, response, input, init);
      } catch { /* keep the last good response */ }
    }

    return response;
  };
  coordinator.wrapper = wrapper;
  w[COORDINATOR_KEY] = coordinator;
  window.fetch = wrapper;

  return coordinator;
}

function releaseCoordinatorIfUnused(c: FetchCoordinator): void {
  if (c.requestHooks.length > 0 || c.responseHooks.length > 0) return;
  const w = window as unknown as Record<string, FetchCoordinator | undefined>;
  if (window.fetch === c.wrapper) window.fetch = c.original;
  if (w[COORDINATOR_KEY] === c) delete w[COORDINATOR_KEY];
}

/** Register a request-phase hook. Return a Response to short-circuit. */
export function registerRequestHook(hook: RequestHook): () => void {
  const c = ensureCoordinator();
  c.requestHooks.push(hook);
  return () => {
    const i = c.requestHooks.indexOf(hook);
    if (i >= 0) c.requestHooks.splice(i, 1);
    releaseCoordinatorIfUnused(c);
  };
}

/** Register a response-phase hook. Return the (possibly transformed) Response. */
export function registerResponseHook(hook: ResponseHook): () => void {
  const c = ensureCoordinator();
  c.responseHooks.push(hook);
  return () => {
    const i = c.responseHooks.indexOf(hook);
    if (i >= 0) c.responseHooks.splice(i, 1);
    releaseCoordinatorIfUnused(c);
  };
}
