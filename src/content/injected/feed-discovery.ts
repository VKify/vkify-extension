const MAX_METHODS = 32;
const PROBES_PER_MINUTE = 8;
const MINUTE = 60_000;
export const FEED_PROBE_MAX_BYTES = 1024 * 1024;
const PROBE_TIMEOUT = 100;

/** Only inspect plausible feed endpoints, never every JSON response on VK. */
export function isFeedCandidate(method: string): boolean {
  return /^(?:newsfeed|feed|timeline)\./i.test(method) ||
    /^[a-z]\w*\.\w*(?:feed|timeline)\w*$/i.test(method) ||
    /^(?:wall|owners|search|catalog|internal)\.\w*(?:maintab|searchall)\w*$/i.test(method);
}

export function vkApiMethod(url: string, base: string): string | null {
  try {
    const parsed = new URL(url, base);
    if (!/^https?:$/.test(parsed.protocol) || !/(^|\.)vk\.(com|ru)$/.test(parsed.hostname)) return null;
    const method = /^\/method\/([a-z]\w*\.[a-z]\w*)$/i.exec(parsed.pathname)?.[1];
    return method && method.length <= 96 ? method : null;
  } catch { return null; }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Shallow, bounded recognition. Ad-like flags alone do not identify a feed. */
export function hasFeedShape(data: unknown, strongMetadata = false): boolean {
  const response = record(record(data)?.response);
  if (!response) return false;
  const post = (value: unknown, externalId = false) => {
    const item = record(value);
    return !!item && typeof item.type === 'string' &&
      ((item.type === 'post' && (externalId || 'post_id' in item || 'source_id' in item || 'owner_id' in item || 'id' in item)) ||
        /^(?:ads(?:_|$)|recommended_games?(?:_carousel)?$|videos_for_you$)/.test(item.type));
  };
  if (Array.isArray(response.newsfeed_items) && Array.isArray(record(response.catalog)?.sections))
    return !response.newsfeed_items.length || response.newsfeed_items.slice(0, 8).some(entry => post(record(entry)?.item, typeof record(entry)?.id === 'string'));
  if (!Array.isArray(response.items)) return false;
  if (!response.items.length) return typeof response.feed_type === 'string' || Array.isArray(response.feed_ids);
  const metadata = typeof response.feed_type === 'string' || Array.isArray(response.feed_ids) ||
    (!strongMetadata && typeof response.next_from === 'string' && (Array.isArray(response.groups) || Array.isArray(response.profiles)));
  return metadata && response.items.slice(0, 8).some(item => post(item));
}

export function createFeedDiscovery(onDiagnostic: (entry: {method: string; reason: string}) => void = () => {}) {
  const methods = new Map<string, { learned: boolean; retryAt: number }>();
  const diagnostics = new Set<string>();
  let windowStart = 0, probes = 0;
  const report = (method: string, reason: string) => {
    const key = `${method}:${reason}`;
    if (diagnostics.has(key) || diagnostics.size >= MAX_METHODS * 3) return;
    diagnostics.add(key);
    // Method names are validated by vkApiMethod; never log URLs, bodies or tokens.
    onDiagnostic({ method, reason });
  };
  const remember = (method: string, learned: boolean) => {
    if (!methods.has(method) && methods.size >= MAX_METHODS) methods.delete(methods.keys().next().value!);
    methods.set(method, { learned, retryAt: Date.now() + MINUTE });
  };
  return {
    report,
    consider(method: string): 'learned' | 'probe' | null {
      const state = methods.get(method);
      if (state?.learned) return 'learned';
      if (!isFeedCandidate(method)) return null;
      const now = Date.now();
      if (state && now < state.retryAt) return null;
      if (now - windowStart >= MINUTE) { windowStart = now; probes = 0; }
      if (probes >= PROBES_PER_MINUTE) return null;
      probes++;
      remember(method, false); // Reserve before awaiting a response, including concurrent calls.
      return 'probe';
    },
    inspect(method: string, data: unknown, rememberFailure = true): boolean {
      if (!hasFeedShape(data)) {
        report(method, !rememberFailure ? 'unsupported-prefetch-shape' : methods.get(method)?.learned ? 'schema-changed' : 'unsupported-shape');
        if (rememberFailure) remember(method, false);
        return false;
      }
      remember(method, true);
      report(method, 'feed-detected');
      return true;
    },
  };
}

/** Bound the initial discovery cost even when length headers are absent or wrong.
 * Cancel only the cloned branch, without awaiting tee cancellation (which can
 * otherwise wait for VK to consume the original response and deadlock fetch). */
export async function readFeedProbe(response: Response): Promise<unknown> {
  const length = Number(response.headers.get('content-length'));
  if (length > FEED_PROBE_MAX_BYTES) return undefined;
  const clone = response.clone();
  const reader = clone.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0, timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<undefined>(resolve => { timer = setTimeout(() => resolve(undefined), PROBE_TIMEOUT); });
    const read = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > FEED_PROBE_MAX_BYTES) return undefined;
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    };
    return await Promise.race([read(), timeout]);
  } catch { return undefined; }
  finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}
