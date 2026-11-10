import { InjectedScript } from '@/content/core/injected-scripts.js';
import { ScriptInjector } from '@/content/core/script-injector.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';

/** Install before VK consumes the HTML-embedded friends API cache. */
export function startFriendsSuggestionsEarly(): void {
  if (location.pathname !== '/friends') return;
  const key = 'hide_friends_suggestions';
  void chrome.storage.local.get(key).then(async settings => {
    if (settings[key] !== true) return;
    const script = InjectedScript.FRIENDS_SUGGESTIONS_FILTER;
    const ready = waitForInjectedScript(script);
    new ScriptInjector().inject(script);
    await ready;
    const latest = await chrome.storage.local.get(key);
    dispatchPageEvent('vkify-update-settings', { [key]: latest[key] === true });
  }).catch(() => { /* Normal feature initialization can retry. */ });
}
