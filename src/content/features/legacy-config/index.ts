import type { FeatureManager } from '../../core/feature-manager.js';
import { handlerFeature } from '../../core/features/index.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { LEGACY_CONFIG_KEYS, normalizeLegacyConfigSettings } from './settings.js';

export function registerLegacyConfigFeatures(manager: FeatureManager): void {
  const sync = async (): Promise<void> => {
    const values = await chrome.storage.local.get([...LEGACY_CONFIG_KEYS]);
    const settings = normalizeLegacyConfigSettings(values);
    const ready = waitForInjectedScript(InjectedScript.LEGACY_CONFIG);
    manager.injectScript(InjectedScript.LEGACY_CONFIG);
    // If the early bootstrap already injected it, this applies immediately.
    manager.sendEvent('vkify-update-legacy-config', settings);
    await ready;
    // If it was not loaded yet, repeat after the ready signal.
    manager.sendEvent('vkify-update-legacy-config', settings);
  };

  manager.registerDefinition(handlerFeature({
    id: 'block_ads_feature_flags',
    name: 'Рекламные флаги VK',
    category: 'ads',
    initOrder: 45,
    tags: ['network', 'injected-script', 'vk-config'],
    handler: { enable: sync, disable: sync },
  }));
}
