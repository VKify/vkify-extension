import type { FeatureContext } from '@/content/core/feature-context.js';
import type { HotkeyCombo } from '@/types/index.js';
import { DEFAULT_VIDEO_HOTKEYS, isHotkeyCombo, type VideoAction } from '@/shared/video-hotkeys.js';
import { getVideoPlayer } from '@/content/utils/video-player.js';

export function runVideoAction(action: VideoAction): boolean {
  const player = getVideoPlayer();
  if (!player) return false;
  const { region, media } = player;
  // Do not seek the paused main video while the separate ad is active.
  const ad = region.querySelector('[data-testid="ad-container"]')?.parentElement;
  if (ad && !ad.classList.contains('hidden') && ad.querySelector('video[src]')) return false;
  const click = (id: string): boolean => {
    const button = region.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!button || button.getAttribute('aria-disabled') === 'true'
      || (button instanceof HTMLButtonElement && button.disabled)) return false;
    button.click();
    return true;
  };
  switch (action) {
    case 'play_pause': return click('play-btn');
    case 'next': return click('btn-next');
    case 'prev': return click('btn-prev');
    case 'fullscreen': return click('fullscreen-btn');
    case 'mute': media.muted = !media.muted; break;
    case 'volume_up': media.volume = Math.min(1, media.volume + 0.05); break;
    case 'volume_down': media.volume = Math.max(0, media.volume - 0.05); break;
    case 'seek_forward':
    case 'seek_backward':
      if (!Number.isFinite(media.duration) || media.duration <= 0) return false;
      media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + (action === 'seek_forward' ? 10 : -10)));
      break;
    case 'rate_up': media.playbackRate = Math.min(3, Math.round((media.playbackRate + 0.25) * 100) / 100); break;
    case 'rate_down': media.playbackRate = Math.max(0.25, Math.round((media.playbackRate - 0.25) * 100) / 100); break;
    case 'rate_reset': media.playbackRate = 1; break;
  }
  return true;
}

export function createVideoHotkeysFeature(ctx: FeatureContext) {
  let active = false;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let hotkeys: Record<VideoAction, HotkeyCombo> = { ...DEFAULT_VIDEO_HOTKEYS };
  const handleKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.metaKey || event.isComposing) return;
    if (event.composedPath().some(el => el instanceof HTMLElement
      && (el.matches('input, textarea, select, [role="textbox"]') || el.isContentEditable))) return;
    for (const [action, c] of Object.entries(hotkeys) as [VideoAction, HotkeyCombo][]) {
      if (event.code !== c.code || event.ctrlKey !== c.ctrlKey || event.altKey !== c.altKey
        || event.shiftKey !== c.shiftKey) continue;
      if (event.repeat && ['play_pause', 'next', 'prev', 'mute', 'fullscreen'].includes(action)) return;
      if (!runVideoAction(action)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  };
  return {
    enable: async (): Promise<void> => {
      if (active) return;
      active = true;
      const token = ++generation;
      hotkeys = { ...DEFAULT_VIDEO_HOTKEYS };
      const changed = new Set<string>();
      const update = (key: string, value: unknown): void => {
        const action = key.replace(/^video_hotkey_/, '') as VideoAction;
        if (!key.startsWith('video_hotkey_') || !(action in DEFAULT_VIDEO_HOTKEYS)) return;
        changed.add(key);
        hotkeys[action] = isHotkeyCombo(value) ? value : DEFAULT_VIDEO_HOTKEYS[action];
      };
      unsubscribe = ctx.onStorageChange(update);
      await Promise.all(Object.keys(DEFAULT_VIDEO_HOTKEYS).map(async action => {
        const key = `video_hotkey_${action}`;
        const value = await ctx.getSetting<HotkeyCombo>(key);
        if (token === generation && !changed.has(key)) update(key, value);
      }));
      if (active && token === generation) document.addEventListener('keydown', handleKeydown, true);
    },
    disable: (): void => {
      active = false;
      generation++;
      document.removeEventListener('keydown', handleKeydown, true);
      unsubscribe?.();
      unsubscribe = undefined;
    },
  };
}
