import {
  PROTECTION_SETTING_KEYS, PROTECTION_MAIN_ID, PROTECTION_RELAY_ID,
  PROTECTION_MATCHES, protectionSettings, protectionSettingFile,
} from '@/shared/constants/protection-startup.js';

// The build emits packaged boolean initializers. No generated/evaluated code or page storage is used.
export function protectionRegistration(data: Record<string, unknown>): chrome.scripting.RegisteredContentScript[] {
  const settings = protectionSettings(data);
  return [
    { id: PROTECTION_RELAY_ID, matches: PROTECTION_MATCHES, js: ['protection-relay.js'],
      world: 'ISOLATED', runAt: 'document_start', allFrames: true, persistAcrossSessions: true },
    { id: PROTECTION_MAIN_ID, matches: PROTECTION_MATCHES,
      js: ['injected/protection-settings.js',
        ...PROTECTION_SETTING_KEYS.filter(key => settings[key]).map(protectionSettingFile),
        'injected/protection-native.js'],
      world: 'MAIN', runAt: 'document_start', allFrames: true, persistAcrossSessions: true },
  ];
}
export class ProtectionRegistration {
  private pending: Promise<void> = Promise.resolve();

  start(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && PROTECTION_SETTING_KEYS.some(key => key in changes)) {
        void this.refresh().catch(error => console.error('[VKify] Early protection registration:', error));
      }
    });
    void this.refresh().catch(error => console.error('[VKify] Early protection registration:', error));
  }

  refresh(): Promise<void> {
    // Read inside the queue: an older storage snapshot must never overwrite a newer registration.
    this.pending = this.pending.catch(() => {}).then(() => this.sync());
    return this.pending;
  }

  private async sync(): Promise<void> {
    if (!chrome.scripting?.registerContentScripts || !chrome.scripting.getRegisteredContentScripts) return;
    const runtime = chrome.runtime as typeof chrome.runtime & { getBrowserInfo?: () => Promise<{ version: string }> };
    // Older Firefox accepts the descriptor but cannot run registered scripts in MAIN.
    // Keep its existing injection path rather than installing page hooks in the isolated world.
    if (runtime.getBrowserInfo && parseInt((await runtime.getBrowserInfo()).version, 10) < 128) return;
    const settings = await chrome.storage.local.get([...PROTECTION_SETTING_KEYS]);
    const desired = protectionRegistration(settings);
    const current = await chrome.scripting.getRegisteredContentScripts({ ids: [PROTECTION_MAIN_ID, PROTECTION_RELAY_ID] });
    const missing = desired.filter(script => !current.some(item => item.id === script.id));
    if (missing.length) await chrome.scripting.registerContentScripts(missing);
    const changed = desired.filter(script => current.some(item => item.id === script.id && (
      item.world !== script.world || item.runAt !== script.runAt || item.allFrames !== script.allFrames
      || item.persistAcrossSessions !== script.persistAcrossSessions
      || JSON.stringify(item.js) !== JSON.stringify(script.js) || JSON.stringify(item.matches) !== JSON.stringify(script.matches)
    )));
    // updateContentScripts replaces the declaration without an unregister/register protection gap.
    if (changed.length) await chrome.scripting.updateContentScripts(changed);
  }
}
