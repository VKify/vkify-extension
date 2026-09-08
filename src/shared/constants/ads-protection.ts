import { ADS_CONTENT_SETTINGS } from './ads-content.js';

/** DOM keywords are optional and do not contribute to the protection level. */
export const ADS_PROTECTION_SETTINGS = ['block_left_ads', 'block_feed_ads_api', 'block_trackers', ...ADS_CONTENT_SETTINGS] as const;
