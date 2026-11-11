import { getLang } from './lang.js';
import { WELCOME_RU } from './welcome-ru.js';
import { WELCOME_EN } from './welcome-en.js';
export function t(key: string): string {
  const lookup = (dict: unknown): string | undefined => {
    let node = dict;
    for (const part of key.replace(/^welcome\./, '').split('.')) {
      if (!node || typeof node !== 'object') return;
      node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : undefined;
  };
  return lookup(getLang() === 'en' ? WELCOME_EN : WELCOME_RU) ?? lookup(WELCOME_RU) ?? key;
}
