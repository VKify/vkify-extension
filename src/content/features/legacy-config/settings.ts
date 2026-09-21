export const LEGACY_CONFIG_KEYS = [
  'block_ads_feature_flags',
  'block_music_ads',
] as const;

export interface LegacyConfigSettings extends Record<string, unknown> {
  block_ads_feature_flags: boolean;
  block_music_ads: boolean;
}

export function normalizeLegacyConfigSettings(values: Record<string, unknown>): LegacyConfigSettings {
  return {
    block_ads_feature_flags: values.block_ads_feature_flags !== false,
    block_music_ads: values.block_music_ads !== false,
  };
}
