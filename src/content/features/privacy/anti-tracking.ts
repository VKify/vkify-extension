import type { FeatureManager } from '../../core/feature-manager.js';
import type { FeatureMap } from '@/types/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';

export function createAntiTrackingFeatures(manager: FeatureManager): FeatureMap {
  return {
    prevent_typing: {
      enable: () => {
        manager.injectScript(InjectedScript.ANTI_TRACKING);
        waitForInjectedScript(InjectedScript.ANTI_TRACKING).then(() => {
          manager.sendEvent('vkify-update-settings', { prevent_typing: true });
        });
      },
      disable: () => {
        manager.sendEvent('vkify-update-settings', { prevent_typing: false });
      },
    },

    prevent_read: {
      enable: () => {
        manager.injectScript(InjectedScript.ANTI_TRACKING);
        waitForInjectedScript(InjectedScript.ANTI_TRACKING).then(() => {
          manager.sendEvent('vkify-update-settings', { prevent_read: true });
        });
      },
      disable: () => {
        manager.sendEvent('vkify-update-settings', { prevent_read: false });
      },
    },
  };
}