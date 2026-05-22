import { useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext.js';

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
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!hasToken || conversations.length > 0) return;

    setLoading(true);
    try {
      const response = await call('messages.getConversations', {
        count: 200,
        extended: 1,
        fields: 'photo_50',
      }) as VKConversationsResponse | null;

      if (!response?.items) return;

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

      setConversations(items);
    } catch {
      showToast('Не удалось загрузить диалоги', 'error');
    } finally {
      setLoading(false);
    }
  }, [hasToken, conversations.length, call, showToast]);

  const filtered = search.trim()
    ? conversations.filter(c => {
        const q = search.toLowerCase();
        return c.name.toLowerCase().includes(q) || String(c.id).includes(q);
      })
    : conversations;

  return { conversations, filtered, loading, search, setSearch, load };
}