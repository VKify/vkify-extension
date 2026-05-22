import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import { StorageKey } from '../../../shared/constants/storage-keys.js';
import type { TrackedUser } from '../../../types/index.js';

const ONLINE_KEY = StorageKey.ONLINE_TRACKED_USERS;

export function useTrackedUsers() {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const trackedUsers: TrackedUser[] = (settings[ONLINE_KEY] as TrackedUser[] | undefined) ?? [];
  const trackedIds = new Set(trackedUsers.map(u => String(u.id)));

  const addUser = useCallback((userId: string, name?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');

    if (!cleanId) {
      showToast('Некорректный ID', 'error');
      return false;
    }
    if (trackedIds.has(cleanId)) {
      showToast('Пользователь уже добавлен', 'error');
      return false;
    }

    const newUser: TrackedUser = {
      id: cleanId,
      name: name?.trim() || `ID ${cleanId}`,
      addedAt: Date.now(),
    };

    void saveSetting(ONLINE_KEY, [...trackedUsers, newUser]);
    showToast(`${newUser.name} добавлен в слежку`, 'success');
    return true;
  }, [trackedUsers, trackedIds, saveSetting, showToast]);

  const toggleUser = useCallback((
    id: string,
    name: string,
    photo?: string,
  ): void => {
    const stringId = String(id);

    if (trackedIds.has(stringId)) {
      void saveSetting(
        ONLINE_KEY,
        trackedUsers.filter(u => String(u.id) !== stringId),
      );
    } else {
      const newUser: TrackedUser = { id: stringId, name, photo, addedAt: Date.now() };
      void saveSetting(ONLINE_KEY, [...trackedUsers, newUser]);
    }
  }, [trackedUsers, trackedIds, saveSetting]);

  const removeUser = useCallback((userId: string): void => {
    void saveSetting(
      ONLINE_KEY,
      trackedUsers.filter(u => String(u.id) !== String(userId)),
    );
    showToast('Пользователь удалён', 'success');
  }, [trackedUsers, saveSetting, showToast]);

  return { trackedUsers, trackedIds, addUser, toggleUser, removeUser };
}