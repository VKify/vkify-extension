import { useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext.js';

export interface FriendItem {
  id: number;
  name: string;
  photo?: string;
  online: boolean;
}

type VKFriendRaw = {
  id: number;
  first_name: string;
  last_name: string;
  photo_50?: string;
  online?: number;
};

export function useFriends(
  hasToken: boolean,
  call: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!hasToken || friends.length > 0) return;

    setLoading(true);
    try {
      const response = await call('friends.get', {
        count: 1000,
        fields: 'photo_50,online',
        order: 'hints',
      }) as { items?: VKFriendRaw[] } | null;

      if (response?.items) {
        setFriends(response.items.map(f => ({
          id: f.id,
          name: `${f.first_name} ${f.last_name}`,
          photo: f.photo_50,
          online: f.online === 1,
        })));
      }
    } catch {
      showToast('Не удалось загрузить друзей', 'error');
    } finally {
      setLoading(false);
    }
  }, [hasToken, friends.length, call, showToast]);

  const filtered = search.trim()
    ? friends.filter(f => {
        const q = search.toLowerCase();
        return f.name.toLowerCase().includes(q) || String(f.id).includes(q);
      })
    : friends;

  const reset = useCallback((): void => {
    setSearch('');
  }, []);

  return { friends, filtered, loading, search, setSearch, load, reset };
}