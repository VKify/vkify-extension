/** Расшифровка сообщений на лету (VKify E2E + COFFEE) для экспорта. */

import { coffeeTryDecrypt, vkifyTryDecrypt } from '@/content/features/privacy/crypto/message-crypto-core.js';
import type { VKMessage } from './types.js';

/**
 * Пробует обе схемы по очереди: VKify E2E v2 (AES-256-GCM), затем COFFEE
 * (AES-128-ECB). Не сработало — тихо возвращает оригинал.
 */
async function tryDecryptOne(text: string, key: string): Promise<string> {
  if (!text || !key) return text;
  const v = await vkifyTryDecrypt(text, key);
  if (v !== null) return v;
  const c = coffeeTryDecrypt(text, key);
  if (c !== null) return c;
  return text;
}

export async function decryptAllInPlace(messages: VKMessage[], key: string): Promise<void> {
  if (!key) return;

  async function walk(m: VKMessage): Promise<void> {
    m.text = await tryDecryptOne(m.text, key);
    if (m.reply_message) await walk(m.reply_message);
    for (const f of m.fwd_messages ?? []) await walk(f);
  }
  for (const m of messages) await walk(m);
}
