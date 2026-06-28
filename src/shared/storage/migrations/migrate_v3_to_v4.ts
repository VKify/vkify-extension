import type { Migration, RawSettings } from './types.js';

/**
 * v3 → v4: настройки эквалайзера (10-полосный Web Audio EQ над плеером VK).
 *
 * Добавляет дефолты новой фичи, не трогая остальное:
 *   - audio_equalizer            — мастер-тумблер (выкл по умолчанию)
 *   - audio_equalizer_preamp     — преамп, dB
 *   - audio_equalizer_bands      — 10 усилений полос, dB
 *   - audio_equalizer_preset     — выбранный пресет (по умолчанию 'flat')
 *   - audio_equalizer_custom_presets — пользовательские пресеты
 *
 * Каждый ключ выставляется ТОЛЬКО если ещё не задан → миграция идемпотентна и не
 * затирает значения, выставленные пользователем (тот же консервативный подход,
 * что и в migrate_v2_to_v3).
 */
export const migrateV3ToV4: Migration = {
  to: 4,
  description: 'Add equalizer settings (10-band gains, preamp, preset, custom presets)',
  migrate(old: RawSettings): RawSettings {
    const next: RawSettings = { ...old };

    if (next.audio_equalizer === undefined) next.audio_equalizer = false;
    if (next.audio_equalizer_preamp === undefined) next.audio_equalizer_preamp = 0;
    if (next.audio_equalizer_bands === undefined) {
      next.audio_equalizer_bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    if (next.audio_equalizer_preset === undefined) next.audio_equalizer_preset = 'flat';
    if (next.audio_equalizer_custom_presets === undefined) {
      next.audio_equalizer_custom_presets = [];
    }

    return next;
  },
};
