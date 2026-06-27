import type { FeatureManager } from '@/content/core/feature-manager.js';
import { hideAudioAdsFeature } from './hide-audio-ads.js';

/** Элементы раздела «Музыка» — страница «Музыка» хаба «Скрытие». */
export function registerMusicHiding(manager: FeatureManager): void {
  manager.registerDefinition(hideAudioAdsFeature);
}
