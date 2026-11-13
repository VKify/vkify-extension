import { InjectedScript } from '../../core/injected-scripts.js';
import { ScriptInjector } from '../../core/script-injector.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { dispatchPageEvent } from '../../utils/page-event.js';

export function startCommunityCatalogEarly(): void {
  if (location.pathname !== '/groups') return;
  const key = 'block_recommendations_communities';
  void chrome.storage.local.get(key).then(async settings => {
    if (settings[key] === false) return;
    const script = InjectedScript.COMMUNITY_CATALOG_BLOCKER;
    const ready = waitForInjectedScript(script);
    new ScriptInjector().inject(script, undefined, { [key]: true });
    await ready;
    const latest = await chrome.storage.local.get(key);
    dispatchPageEvent('vkify-update-settings', { [key]: latest[key] !== false });
  }).catch(() => { /* Normal feature initialization can retry. */ });
}
