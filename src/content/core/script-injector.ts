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
    (document.head ?? document.documentElement).appendChild(script);

    this.injected.add(name);
  }

  has(name: InjectedScriptName): boolean {
    return this.injected.has(name);
  }
}