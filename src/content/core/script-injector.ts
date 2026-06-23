import type { InjectedScriptName } from './injected-scripts.js';
import { VKIFY_NONCE_ATTR } from '../../shared/utils/page-channel.js';

export class ScriptInjector {
  private readonly injected = new Set<string>();

  inject(name: InjectedScriptName, nonce?: string): void {
    if (this.injected.has(name)) return;

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(`injected/${name}.js`);
    script.charset = 'utf-8';
    // Hand the per-session channel nonce to the injected script. It reads this
    // synchronously via document.currentScript before onload removes the tag.
    if (nonce) script.setAttribute(VKIFY_NONCE_ATTR, nonce);
    script.onload = () => script.remove();
    // Surface a blocked page-world injection instead of failing silently. The
    // page CSP can refuse the extension-origin <script> (notably on Firefox,
    // which — unlike Chrome — applies the host page's script-src to injected
    // web_accessible_resources). Without this, the feature just never starts and
    // waitForInjectedScript() only times out, hiding the cause.
    script.onerror = () => {
      console.error(
        `[VKify] Injected script "${name}" failed to load (likely blocked by the ` +
        `page Content-Security-Policy). Affected feature will not work.`,
      );
      script.remove();
    };
    (document.head ?? document.documentElement).appendChild(script);

    this.injected.add(name);
  }

  has(name: InjectedScriptName): boolean {
    return this.injected.has(name);
  }

  /** Число инжектированных page-world скриптов — для телеметрии. */
  count(): number {
    return this.injected.size;
  }
}