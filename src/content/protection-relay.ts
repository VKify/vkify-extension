import { installExtApi } from '../shared/ext-api.js';
import { PROTECTION_SETTING_KEYS, protectionSettings } from '../shared/constants/protection-startup.js';
import { getAdsBlockingContext } from './features/ads-blocking/shared.js';
import { dispatchPageEvent } from './utils/page-event.js';

installExtApi();
// Also runs in matching VK subframes, which do not load the full extension UI.
getAdsBlockingContext();
const keys = [...PROTECTION_SETTING_KEYS, 'custom_block_words', 'custom_allow_words'];
let revision = 0;
async function sync(): Promise<void> {
  const current = ++revision;
  const settings = await chrome.storage.local.get(keys);
  if (current !== revision) return;
  dispatchPageEvent('vkify-update-settings', { ...protectionSettings(settings),
    custom_block_words: settings.custom_block_words ?? [], custom_allow_words: settings.custom_allow_words ?? [],
  });
}
window.addEventListener('vkify:protection:ready', () => { void sync().catch(() => {}); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && keys.some(key => key in changes)) void sync().catch(() => {});
});
void sync().catch(() => {});
