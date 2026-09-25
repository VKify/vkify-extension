export { createAudioDownloadFeature } from './download/index.js';
export { createAudioMultiUploadFeature } from './upload/multi-upload.js';
export { createMusicVisualizerFeature, createMusicLyricsFeature } from './visualizer/index.js';

import type { FeatureManager } from '@/content/core/feature-manager.js';
import { handlerFeature } from '@/content/core/features/index.js';
import { createAudioDownloadFeature } from './download/index.js';
import { createAudioMultiUploadFeature } from './upload/multi-upload.js';
import { createMusicVisualizerFeature, createMusicLyricsFeature } from './visualizer/index.js';
import { createMediaPlayerFeature } from './playback/player-control.js';
import { createAudioAutoplayFeature } from './playback/autoplay.js';
import { createAudioEqualizerFeature } from './playback/equalizer/index.js';

/** Registers every music feature, including playback controls and audio processing. */
export function registerMusicFeatures(manager: FeatureManager): void {
  const audio = createAudioDownloadFeature(manager);
  const multiUpload = createAudioMultiUploadFeature(manager);
  const visualizer = createMusicVisualizerFeature(manager);
  const lyrics = createMusicLyricsFeature(manager);
  const playback = createMediaPlayerFeature(manager);
  const autoplay = createAudioAutoplayFeature(manager);
  const equalizer = createAudioEqualizerFeature(manager);

  manager.registerDefinitions([
    handlerFeature({ id: 'audio_download', name: 'Скачивание музыки', category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['download', 'audio', 'hls'], handler: audio.audio_download }),
    handlerFeature({ id: 'audio_multi_upload', name: 'Мульти-загрузка аудио', category: 'media', impact: 'medium', tags: ['upload', 'audio'], handler: multiUpload.audio_multi_upload }),
    handlerFeature({ id: 'music_lyrics', initOrder: 20, name: 'Текст на фоне', category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['music', 'lyrics', 'wallpaper'], handler: lyrics.music_lyrics }),
    handlerFeature({ id: 'music_visualizer', initOrder: 21, name: 'Визуализатор музыки', category: 'media', impact: 'medium', requiresDomLayer: true, tags: ['music', 'visualizer', 'wallpaper'], handler: visualizer.music_visualizer }),
    handlerFeature({ id: 'media_player_hotkeys', name: 'Горячие клавиши плеера', category: 'media', impact: 'light', tags: ['hotkeys', 'audio'], handler: playback.media_player_hotkeys }),
    handlerFeature({ id: 'audio_autoplay', name: 'Автозапуск музыки', category: 'media', impact: 'light', tags: ['audio', 'autoplay'], handler: autoplay.audio_autoplay }),
    handlerFeature({ id: 'audio_equalizer', name: 'Эквалайзер', category: 'media', impact: 'medium', tags: ['audio', 'equalizer'], handler: equalizer.audio_equalizer }),
  ]);
}
