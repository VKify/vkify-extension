import type { Migration, RawSettings } from './types.js';

/** v8 → v9: перенос рекомендаций и музыки в рекламу с сохранением выбора. */
export const migrateV8ToV9: Migration = {
  to: 9,
  description: 'Split recommendations by section and move music ads to advertising',
  migrate(old: RawSettings): RawSettings {
    const next = { ...old };
    // Исторический список фиксирован: новые категории не меняют старую миграцию.
    const keys = [
      'block_recommendations_feed',
      'block_recommendations_games',
      'block_recommendations_market',
      'block_recommendations_calls',
      'block_recommendations_profile',
      'block_recommendations_messenger',
    ];
    for (const key of keys) {
      if (typeof next[key] !== 'boolean') {
        next[key] = typeof old.hide_recommendations === 'boolean' ? old.hide_recommendations : true;
      }
    }
    if (typeof next.block_music_ads !== 'boolean') {
      next.block_music_ads = typeof old.hide_audio_ads === 'boolean' ? old.hide_audio_ads : true;
    }
    delete next.hide_recommendations;
    delete next.hide_audio_ads;
    return next;
  },
};
