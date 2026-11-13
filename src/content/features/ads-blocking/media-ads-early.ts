import { ScriptInjector } from '@/content/core/script-injector.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';

/** Install campaign interception before VK boots its advertising SDK. */
export function startMediaAdsEarly(): void {
  const keys = ['block_music_ads', 'block_recommendations_video'];
  void chrome.storage.local.get(keys).then(async settings => {
    if (!keys.some(key => settings[key] !== false)) return;
    const scripts = [InjectedScript.TRACKER_BLOCKER, ...(settings.block_music_ads !== false ? [InjectedScript.MUSIC_CATALOG_BLOCKER] : [])];
    const injector = new ScriptInjector();
    await Promise.all(scripts.map(script => {
      const ready = waitForInjectedScript(script);
      injector.inject(script, undefined, Object.fromEntries(keys.map(key => [key, settings[key] !== false])));
      return ready;
    }));
    const latest = await chrome.storage.local.get(keys);
    dispatchPageEvent('vkify-update-settings', Object.fromEntries(keys.map(key => [key, latest[key] !== false])));
  }).catch(() => { /* Feature initialization retries if early injection failed. */ });
}
