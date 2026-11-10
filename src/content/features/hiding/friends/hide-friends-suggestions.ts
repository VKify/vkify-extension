import type { FeatureDefinition } from '@/content/core/features/index.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';

let enabled = false;

/** Filter recommendations before VK renders the block, without touching its DOM. */
export const hideFriendsSuggestionsFeature: FeatureDefinition = {
  id: 'hide_friends_suggestions',
  name: 'Скрыть «возможные друзья»',
  category: 'hiding',
  init(ctx) {
    enabled = true;
    const script = InjectedScript.FRIENDS_SUGGESTIONS_FILTER;
    const update = () => ctx.sendEvent('vkify-update-settings', { hide_friends_suggestions: enabled });
    update();
    const ready = waitForInjectedScript(script);
    ctx.injectScript(script);
    void ready.then(update);
  },
  destroy(ctx) {
    enabled = false;
    ctx.sendEvent('vkify-update-settings', { hide_friends_suggestions: false });
  },
};
