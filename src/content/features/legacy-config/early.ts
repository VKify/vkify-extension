import { ScriptInjector } from '../../core/script-injector.js';
import { InjectedScript } from '../../core/injected-scripts.js';
import { waitForInjectedScript } from '../../utils/injected-ready.js';
import { dispatchPageEvent } from '../../utils/page-event.js';
import { LEGACY_CONFIG_KEYS, normalizeLegacyConfigSettings } from './settings.js';

/** Installs before DOMContentLoaded so VK cannot consume the legacy flags first. */
export function startLegacyConfigEarly(): void {
  // Remove data left by the retired experimental config editor.
  void chrome.storage.local.remove(['legacy_config_overrides', 'vk_legacy_config_snapshot']);

  // Install synchronously at document_start. Waiting for chrome.storage here
  // loses a race with VK's bootstrap request on fast/cached page loads.
  const ready = waitForInjectedScript(InjectedScript.LEGACY_CONFIG);
  new ScriptInjector().inject(InjectedScript.LEGACY_CONFIG);

  void chrome.storage.local.get([...LEGACY_CONFIG_KEYS]).then(async values => {
    await ready;
    const latest = await chrome.storage.local.get([...LEGACY_CONFIG_KEYS]);
    dispatchPageEvent('vkify-update-legacy-config', normalizeLegacyConfigSettings(latest));
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !LEGACY_CONFIG_KEYS.some(key => key in changes)) return;
    void chrome.storage.local.get([...LEGACY_CONFIG_KEYS]).then(values => {
      dispatchPageEvent('vkify-update-legacy-config', normalizeLegacyConfigSettings(values));
    });
  });
}
