import type { FeatureContext } from '@/content/core/feature-context.js';
import { apiArtwork } from '@/shared/music-artwork.js';
import { TtlCache } from '@/shared/utils/ttl-cache.js';

const cache = new TtlCache<string, Promise<string>>(100, 5 * 60 * 1000);

/** Uses VKify's existing authenticated/native API bridge; missing audio access is optional. */
export function fetchTrackArtwork(ctx: FeatureContext, trackId: string): Promise<string> {
  if (!/^-?\d+_\d+$/.test(trackId) || !ctx.vkApi) return Promise.resolve('');
  const hit = cache.get(trackId); if (hit) return hit;
  const pending = ctx.vkApi.call('audio.getById', { audios: trackId })
    .then(response => apiArtwork(response, trackId), () => '');
  cache.set(trackId, pending);
  return pending;
}
