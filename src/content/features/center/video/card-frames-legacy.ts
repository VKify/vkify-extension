import { safeVideoImageUrl } from '@/shared/video-card-frame.js';

type Transform = (data: unknown) => Promise<boolean>;
const MAX_TEXT = 4 * 1024 * 1024;
const originalHost = (host: string) => host === 'vkvideo.ru' || host === 'www.vkvideo.ru';

/** The legacy catalogue delivers HTML on entry, and positional video arrays on pagination. */
export async function transformLegacyVideoPayload(args: unknown[], transform: Transform, valid: () => boolean): Promise<unknown[]> {
  const cards: Record<string, unknown>[] = [];
  const edits: Array<() => void> = [];
  const result = args.slice();
  let size = 0;
  const card = (owner: unknown, id: unknown, cover: unknown, duration?: unknown) => {
    if (cards.length >= 200 || !Number.isSafeInteger(owner) || !owner || !Number.isSafeInteger(id) || Number(id) <= 0 || !safeVideoImageUrl(cover)) return;
    const video = { owner_id: owner, id, title: '', duration, image: [{ url: cover }] };
    cards.push(video); return video;
  };
  for (let part = 0; part < args.length; part++) {
    const text = args[part];
    if (typeof text !== 'string' || (size += text.length) > MAX_TEXT) continue;
    // Never inspect or rewrite executable scripts, titles, playlist covers or arbitrary markup.
    if (text.startsWith('{')) {
      let data: { videos?: unknown[] };
      try { data = JSON.parse(text); } catch { continue; }
      if (!data || !Array.isArray(data.videos)) continue;
      for (const row of data.videos.slice(0, 200)) {
        if (!Array.isArray(row)) continue;
        const video = card(row[0], row[1], row[2], row[19]);
        if (video) edits.push(() => { if (video.image[0].url !== row[2]) row[2] = video.image[0].url; });
      }
      edits.push(() => { result[part] = JSON.stringify(data); });
    } else if (/^\s*</.test(text) && text.includes('video_item_')) {
      const matches: RegExpMatchArray[] = [];
      for (const match of text.matchAll(/<div\b[^>]*\bid=["']video_item_(-?\d+)_(\d+)["'][^>]*>/g)) {
        matches.push(match); if (matches.length === 200) break;
      }
      const replacements: Array<{ start: number; end: number; value: () => string }> = [];
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i], start = match.index!, end = matches[i + 1]?.index ?? text.length;
        const cover = /\bdata-thumb=["']([^"']+)["']/.exec(match[0])?.[1];
        const video = card(Number(match[1]), Number(match[2]), cover);
        if (!video || !cover) continue;
        const segment = text.slice(start, end);
        replacements.push({ start, end, value: () => video.image[0].url === cover ? segment : segment.replace(
          /\b(data-thumb|src)=(['"])([^'"]*)\2/g,
          (attribute, name, quote, url) => url === cover ? `${name}=${quote}${video.image[0].url}${quote}` : attribute,
        ) });
      }
      edits.push(() => {
        const chunks: string[] = []; let offset = 0;
        for (const change of replacements) { chunks.push(text.slice(offset, change.start), change.value()); offset = change.end; }
        chunks.push(text.slice(offset)); result[part] = chunks.join('');
      });
    }
  }
  if (!cards.length || !valid() || !await transform({ videos: cards }) || !valid()) return args;
  for (const edit of edits) edit();
  return result;
}

/** Wrap VK's own AJAX delivery; no DOM scanning, XHR replacement or polling. */
export function interceptLegacyVideoCatalogue(transform: Transform): () => void {
  if (!originalHost(location.hostname)) return () => {};
  const target = window as unknown as Record<string, unknown>;
  const descriptor = Object.getOwnPropertyDescriptor(target, 'ajax');
  let active = true, value = Reflect.get(target, 'ajax');
  let detach = () => {};
  const valid = () => active && !document.hidden;
  const matches = (url: unknown, params: unknown) => {
    if (typeof url !== 'string' || !params || typeof params !== 'object') return false;
    try {
      const parsed = new URL(url, location.href), data = params as Record<string, unknown>;
      return parsed.protocol === 'https:' && originalHost(parsed.hostname) && !parsed.searchParams.has('act') && !data.act &&
        (typeof data.__query === 'string' || data.silent_loading === 1 || data.silent_loading === '1');
    } catch { return false; }
  };
  const attach = (next: unknown) => {
    detach(); value = next;
    if (!next || typeof next !== 'object') return;
    const ajax = next as Record<string, any>, restore: Array<() => void> = [];
    for (const name of ['promisifiedPost', 'post']) {
      const method = Object.getOwnPropertyDescriptor(ajax, name), original = ajax[name];
      if (typeof original !== 'function' || (method && (!('value' in method) || !method.writable))) continue;
      if (!method && !Object.isExtensible(ajax)) continue;
      const wrapper = function(this: unknown, url: unknown, params: unknown, options?: Record<string, any>) {
        if (!valid() || !matches(url, params)) return original.apply(this, arguments);
        if (name === 'promisifiedPost') return Promise.resolve(original.apply(this, arguments)).then(async (args: unknown) => {
          if (!valid() || !Array.isArray(args)) return args;
          try { return await transformLegacyVideoPayload(args, transform, valid); } catch { return args; }
        });
        if (typeof options?.onDone !== 'function') return original.apply(this, arguments);
        const done = options.onDone;
        return original.call(this, url, params, { ...options, onDone: function(this: unknown, ...args: unknown[]) {
          const receiver = this;
          void transformLegacyVideoPayload(args, transform, valid).catch(() => args).then(nextArgs => done.apply(receiver, nextArgs));
        } });
      };
      ajax[name] = wrapper;
      restore.push(() => { if (ajax[name] === wrapper) { if (method) Object.defineProperty(ajax, name, method); else delete ajax[name]; } });
    }
    detach = () => { for (const restoreMethod of restore) restoreMethod(); };
  };
  attach(value);
  const get = () => value;
  const watched = !descriptor || (descriptor.configurable && 'value' in descriptor && descriptor.writable);
  if (watched) Object.defineProperty(target, 'ajax', { configurable: true, enumerable: descriptor?.enumerable ?? true, get, set: attach });
  return () => {
    active = false; detach();
    if (watched && Object.getOwnPropertyDescriptor(target, 'ajax')?.get === get) {
      if (descriptor) Object.defineProperty(target, 'ajax', { ...descriptor, value });
      else { Reflect.deleteProperty(target, 'ajax'); if (value !== undefined) Reflect.set(target, 'ajax', value); }
    }
  };
}
