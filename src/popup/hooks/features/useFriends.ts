import { useCallback } from 'react';
import { useVKList } from '../core/useVKList.js';

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
  const fetcher = useCallback(async (): Promise<FriendItem[]> => {
    const response = await call('friends.get', {
      count: 1000,
      fields: 'photo_50,online',
      order: 'hints',
    }) as { items?: VKFriendRaw[] } | null;

    return (response?.items ?? []).map(f => ({
      id: f.id,
      name: `${f.first_name} ${f.last_name}`,
      photo: f.photo_50,
      online: f.online === 1,
    }));
  }, [call]);

  const { items, filtered, loading, search, setSearch, load, reset } =
    useVKList<FriendItem>(hasToken, fetcher, 'Не удалось загрузить друзей');

  return { friends: items, filtered, loading, search, setSearch, load, reset };
}
