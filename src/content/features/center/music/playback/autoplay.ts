import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap } from '@/types/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';

// Флаг «играла ли музыка перед перезагрузкой» пишется инжектированным
// player-control.ts на pagehide. Читаем его на document_start (раньше любого
// page-script) и передаём в инжект-скрипт через событие. Ключ — наш,
// неймспейснутый, чтобы не пересекаться с собственными ключами VK.
const WAS_PLAYING_KEY = 'vkify:audio_was_playing';

const wasPlayingAtLoad = ((): boolean => {
  try {
    const val = localStorage.getItem(WAS_PLAYING_KEY);
    console.log('[VKify] autoplay:', WAS_PLAYING_KEY, 'at start =', JSON.stringify(val));
    return val === 'true';
  } catch { return false; }
})();

export function createAudioAutoplayFeature(ctx: FeatureContext): FeatureMap {
  return {
    audio_autoplay: {
      enable: () => {
        ctx.injectScript(InjectedScript.PLAYER_CONTROL);
        waitForInjectedScript(InjectedScript.PLAYER_CONTROL).then(() => {
          ctx.sendEvent('vkify:player:autoplay', { enabled: true, wasPlaying: wasPlayingAtLoad });
        });
      },
      disable: () => {
        ctx.sendEvent('vkify:player:autoplay', { enabled: false, wasPlaying: false });
      },
    },
  };
}
