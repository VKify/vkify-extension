import type { Migration, RawSettings } from './types.js';

/**
 * v3 → v4: дефолты недавно добавленных фич.
 *
 * Эквалайзер (10-полосный Web Audio EQ над плеером VK):
 *   - audio_equalizer            — мастер-тумблер (выкл по умолчанию)
 *   - audio_equalizer_preamp     — преамп, dB
 *   - audio_equalizer_bands      — 10 усилений полос, dB
 *   - audio_equalizer_preset     — выбранный пресет (по умолчанию 'flat')
 *   - audio_equalizer_custom_presets — пользовательские пресеты
 *
 * Тумблеры новых фич хаба «Центр» / «Скрытие» (по умолчанию выкл — поведение не
 * меняется, фича включается только при settings[id] === true):
 *   - communities_my_groups_redirect — «Сообщества» → /groups/my_all_groups
 *   - communities_swap_columns       — колонки местами на странице сообщества
 *   - profile_swap_columns           — колонки местами на странице профиля
 *   - hide_feed_right_column         — скрыть правую колонку ленты
 *   - hide_profile_right_column      — скрыть правую колонку профиля
 *
 * Каждый ключ выставляется ТОЛЬКО если ещё не задан → миграция идемпотентна и не
 * затирает значения, выставленные пользователем (тот же консервативный подход,
 * что и в migrate_v2_to_v3).
 */
export const migrateV3ToV4: Migration = {
  to: 4,
  description: 'Add equalizer settings + new center/hiding feature toggles',
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

    if (next.communities_my_groups_redirect === undefined) next.communities_my_groups_redirect = false;
    if (next.communities_swap_columns === undefined) next.communities_swap_columns = false;
    if (next.profile_swap_columns === undefined) next.profile_swap_columns = false;
    if (next.hide_feed_right_column === undefined) next.hide_feed_right_column = false;
    if (next.hide_profile_right_column === undefined) next.hide_profile_right_column = false;

    return next;
  },
};
