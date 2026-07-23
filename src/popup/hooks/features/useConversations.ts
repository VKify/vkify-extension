import { useCallback } from 'react';
import { useVKList } from '../core/useVKList.js';
import i18n from '@/popup/i18n.js';

export interface ConversationItem {
  id: number;
  name: string;
  photo?: string;
}

type VKProfile = {
  id: number;
  first_name: string;
  last_name: string;
  photo_50?: string;
};

type VKConversationsResponse = {
  items?: Array<{
    conversation: { peer: { id: number; type: string } };
  }>;
  profiles?: VKProfile[];
};

export function useConversations(
  hasToken: boolean,
  call: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
) {
  const fetcher = useCallback(async (): Promise<ConversationItem[]> => {
    const response = await call('messages.getConversations', {
      count: 200,
      extended: 1,
      fields: 'photo_50',
    }) as VKConversationsResponse | null;

    if (!response?.items) return [];

    const profileMap = new Map<number, VKProfile>(
      (response.profiles ?? []).map(p => [p.id, p]),
    );

    const items: ConversationItem[] = [];
    for (const item of response.items) {
      const { peer } = item.conversation;
      if (peer.type !== 'user') continue;
      const profile = profileMap.get(peer.id);
      if (!profile) continue;
      items.push({
        id: peer.id,
        name: `${profile.first_name} ${profile.last_name}`,
        photo: profile.photo_50,
      });
    }
    return items;
  }, [call]);

  const { items, filtered, loading, search, setSearch, load } =
    useVKList<ConversationItem>(hasToken, fetcher, i18n.t('privacy:hidden.load_conversations_failed'));

  return { conversations: items, filtered, loading, search, setSearch, load };
}
