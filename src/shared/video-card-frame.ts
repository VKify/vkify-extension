export type VideoFramePosition = 'start' | 'middle' | 'end';
export interface VideoFrameImage { url: string; width: number; height: number; is_base?: boolean }
export interface VideoSpriteFrame {
  url: string; x: number; y: number; width: number; height: number;
}

export function videoFramePosition(value: unknown): VideoFramePosition {
  return value === 'middle' || value === 'end' ? value : 'start';
}

export function safeVideoImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value.replace(/&amp;/g, '&'));
    return url.protocol === 'https:' && !url.username && !url.password &&
      /(^|\.)(?:userapi\.com|vkuserphoto\.ru|vkuser\.net|vk-cdn\.net|vkvideo\.ru|vk\.(?:ru|com)|okcdn\.ru|mycdn\.me)$/.test(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

export function videoFrameAllowed(video: Record<string, unknown>): boolean {
  return !video.live && !video.upcoming && !video.processing && !video.content_restricted &&
    video.can_view !== 0 && video.can_view !== false && !video.restriction &&
    video.type !== 'short_video' && video.type !== 'clip' &&
    (!video.live_status || video.live_status === 'finished' || video.live_status === 'postlive');
}

export function firstVideoFrames(video: Record<string, unknown>): VideoFrameImage[] {
  if (!videoFrameAllowed(video) || !Array.isArray(video.first_frame)) return [];
  return video.first_frame.slice(0, 16).flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const frame = value as Record<string, unknown>, url = safeVideoImageUrl(frame.url);
    // VK also supplies a single server-resizable base frame with zero dimensions.
    // Preserve its native flag so VK adds its usual size parameters itself.
    if (url && frame.is_base === true) return [{ url, width: 320, height: 180, is_base: true }];
    return url && typeof frame.width === 'number' && frame.width > 0 && frame.width <= 8192 &&
      typeof frame.height === 'number' && frame.height > 0 && frame.height <= 8192
      ? [{ url, width: frame.width, height: frame.height }] : [];
  });
}

/** VK's timeline sheet layout, including UV frequency and compact final sheets. */
export function videoSpriteFrame(video: Record<string, unknown>, position: VideoFramePosition): VideoSpriteFrame | null {
  if (!videoFrameAllowed(video) || !video.timeline_thumbs || typeof video.timeline_thumbs !== 'object') return null;
  const thumbs = video.timeline_thumbs as Record<string, unknown>;
  const { count_total: total, count_per_image: perImage, count_per_row: perRow, frame_width: width, frame_height: height } = thumbs;
  const integer = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= max;
  if (!integer(total, 100_000) || !integer(perImage, 256) || !integer(perRow, 32) || perRow > perImage ||
    !integer(width, 1024) || !integer(height, 1024) || !Array.isArray(thumbs.links)) return null;
  const duration = typeof video.duration === 'number' && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
  // Long videos start at 3:30. Short ones use their first quarter, never the
  // opening frame or a timestamp past the end of the video.
  const progress = position === 'start' ? (duration ? (duration >= 240 ? 210 / duration : 0.25) : null) : position === 'middle' ? 0.5 : 1;
  if (progress === null) return null;
  let index = Math.floor(total * progress - 0.5);
  if (thumbs.is_uv) {
    if (!duration || typeof thumbs.frequency !== 'number' || !Number.isFinite(thumbs.frequency) || thumbs.frequency <= 0) return null;
    index = Math.floor(duration * progress / thumbs.frequency);
  }
  if (position === 'start' && total < 2) return null;
  index = Math.max(position === 'start' ? 1 : 0, Math.min(total - 1, index));
  const url = safeVideoImageUrl(thumbs.links[Math.floor(index / perImage)]);
  if (!url) return null;
  const local = index % perImage;
  return { url, width, height, x: local % perRow * width, y: Math.floor(local / perRow) * height };
}

/** Only VK API routes that can carry video cards; unrelated traffic is never parsed. */
export function videoFrameApiMethod(url: string, base: string): string | null {
  try {
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'https:' || !/(^|\.)(?:vk\.(?:ru|com)|vkvideo\.ru)$/.test(parsed.hostname)) return null;
    const method = /^\/method\/([a-z]\w*(?:\.[a-z]\w*)?)$/i.exec(parsed.pathname)?.[1];
    if (!method) return null;
    if (/^video\.get\w*$/.test(method) && !/(?:Ads|Stats|Token|Upload|Settings|Privacy|Progress)/i.test(method)) return method;
    return /^(?:video\.(?:search|feedVideosForYouBlockItems)|catalog\.(?:getVideo\w*|getSection|getBlockItems|getOwnerVideosSearch|getSearchAll|getSearchTop|replaceBlocks)|newsfeed\.(?:get|load)\w*|wall\.get\w*|owners\.getMainTab|search\.get(?:SearchAll|Video)\w*|fave\.get(?:Videos)?|batch\.call|execute)$/.test(method) ? method : null;
  } catch { return null; }
}

/** Bounded traversal of known API containers, not arbitrary object properties. */
export function collectVideoCards(data: unknown): Record<string, unknown>[] {
  const keys = ['response', 'responses', 'body', 'catalog_videos', 'items', 'videos', 'video', 'attachments', 'copy_history', 'newsfeed_items', 'item', 'catalog', 'sections', 'blocks', 'comments'];
  const result: Record<string, unknown>[] = [], seen = new WeakSet<object>();
  const stack: Array<[unknown, number]> = [[data, 0]];
  for (let visited = 0; stack.length && visited < 5000 && result.length < 200; visited++) {
    const [value, depth] = stack.pop()!;
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 12) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = Math.min(value.length, 500) - 1; i >= 0 && stack.length < 6000; i--) stack.push([value[i], depth + 1]);
      continue;
    }
    const record = value as Record<string, unknown>;
    if (Number.isSafeInteger(record.id) && Number.isSafeInteger(record.owner_id) && record.owner_id !== 0 &&
      Number(record.id) > 0 && Array.isArray(record.image) &&
      (typeof record.title === 'string' || typeof record.duration === 'number') &&
      record.type !== 'album' && record.type !== 'playlist' && !('first_video_id' in record) && videoFrameAllowed(record)) {
      result.push(record);
      continue;
    }
    // Search keeps displayed cards in catalog_videos and unrelated playlist
    // previews in videos. Those previews must not delay or compete with cards.
    const catalogCards = Array.isArray(record.catalog_videos) && record.catalog_videos.slice(0, 500).some(item =>
      item && typeof item === 'object' && item.video && Array.isArray(item.video.image));
    for (let i = keys.length - 1; i >= 0 && stack.length < 6000; i--)
      if (record[keys[i]] && !(catalogCards && keys[i] === 'videos')) stack.push([record[keys[i]], depth + 1]);
  }
  return result;
}
