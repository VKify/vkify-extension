import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureHandler } from '@/types/index.js';
import { sendMessage } from '@/shared/messaging.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';

const POSITION = 'video_card_frame_position';
const update = (enabled: boolean, position?: unknown) => dispatchPageEvent('vkify:video-frames:settings', { enabled, position });

/** Start before VK reads its HTML cache, rather than waiting for DOM features. */
export function startVideoCardFramesEarly(): void {
  void chrome.storage.local.get(['video_card_frames']).then(async saved => {
    if (saved.video_card_frames !== true) return;
    const result = await sendMessage({ type: 'INJECT_VIDEO_CARD_FRAMES' });
    if (!result?.ok) return;
    const latest = await chrome.storage.local.get(['video_card_frames', POSITION]);
    update(latest.video_card_frames === true, latest[POSITION]);
  }).catch(() => { /* The normal feature lifecycle can retry. */ });
}

/** Only a tiny settings bridge stays in content.js; processing runs in MAIN. */
export function createVideoCardFramesFeature(ctx: FeatureContext): FeatureHandler {
  let revision = 0, off: (() => void) | undefined;
  return {
    async enable() {
      const own = ++revision;
      const result = await sendMessage({ type: 'INJECT_VIDEO_CARD_FRAMES' });
      if (own !== revision) return;
      if (!result?.ok) throw new Error('Video card frames module failed to load');
      const position = await ctx.getSetting(POSITION);
      if (own !== revision) return;
      off?.();
      off = ctx.onSettingChange(POSITION, value => update(true, value));
      update(true, position);
    },
    disable() { revision++; off?.(); off = undefined; update(false); },
  };
}
