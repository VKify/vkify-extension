import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { createMediaPlayerFeature } from './player-control.js';
import { createAudioAutoplayFeature } from './autoplay.js';
import { createAudioEqualizerFeature } from './equalizer/index.js';

export function registerPlayerFeatures(manager: FeatureManager): void {
  // Stateful-ядра (page-world мосты, Web Audio DSP) не переписываются —
  // оборачиваются handlerFeature с метадатой на месте.
  const player = createMediaPlayerFeature(manager);
  const autoplay = createAudioAutoplayFeature(manager);
  const equalizer = createAudioEqualizerFeature(manager);

  manager.registerDefinitions([
    handlerFeature({
      id: 'media_player_hotkeys',
      name: 'Горячие клавиши плеера', category: 'media', impact: 'light', tags: ['hotkeys', 'audio'],
      handler: player.media_player_hotkeys,
    }),
    handlerFeature({
      id: 'audio_autoplay',
      name: 'Автозапуск музыки', category: 'media', impact: 'light', tags: ['audio', 'autoplay'],
      handler: autoplay.audio_autoplay,
    }),
    handlerFeature({
      id: 'audio_equalizer',
      name: 'Эквалайзер', category: 'player', impact: 'medium', tags: ['audio', 'equalizer'],
      handler: equalizer.audio_equalizer,
    }),
  ]);
}
