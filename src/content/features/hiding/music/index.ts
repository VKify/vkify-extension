import type { FeatureManager } from '@/content/core/feature-manager.js';
import { registerHideAudioAdsFeature } from './hide-audio-ads.js';

/** Элементы раздела «Музыка» — страница «Музыка» хаба «Скрытие». */
export function registerMusicHiding(manager: FeatureManager): void {
  registerHideAudioAdsFeature(manager);
}
