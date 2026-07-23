/** Постраничная загрузка истории сообщений через messages.getHistory. */

import { getService, SERVICES } from '@/content/core/services/index.js';
import { PAGE_SIZE, REQUEST_DELAY_MS } from './constants.js';
import type { ConversationContext } from './peer.js';
import type { HistoryResponse, PeerNames, VKMessage, VKProfile, VKGroup } from './types.js';

export function buildHistoryParams(
  context: ConversationContext,
  offset: number,
): Record<string, unknown> {
  return {
    peer_id: context.peerId,
    count: PAGE_SIZE,
    offset,
    extended: 1,
    // Без group_id VK читает личный inbox администратора. Для /gim нужен
    // inbox конкретного сообщества, даже если peer_id пользователя совпадает.
    ...(context.groupId !== null ? { group_id: context.groupId } : {}),
  };
}

export async function fetchAllHistory(
  context: ConversationContext,
  onProgress: (loaded: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<{ messages: VKMessage[]; names: PeerNames }> {
  const messages: VKMessage[] = [];
  const users  = new Map<number, VKProfile>();
  const groups = new Map<number, VKGroup>();

  let offset = 0;
  let total  = 0;

  while (true) {
    if (isCancelled()) throw new Error('cancelled');

    const resp = await getService(SERVICES.vkApi).call(
      'messages.getHistory',
      buildHistoryParams(context, offset),
    ) as HistoryResponse | null;

    if (!resp) break;

    if (offset === 0) total = resp.count;

    for (const p of resp.profiles ?? []) users.set(p.id, p);
    for (const g of resp.groups ?? [])   groups.set(g.id, g);

    if (!resp.items?.length) break;
    messages.push(...resp.items);

    onProgress(messages.length, total);

    if (messages.length >= total) break;
    if (resp.items.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
    await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
  }

  // VK отдаёт сообщения от свежих к старым — переворачиваем для хронологии.
  messages.reverse();
  return { messages, names: { users, groups } };
}
