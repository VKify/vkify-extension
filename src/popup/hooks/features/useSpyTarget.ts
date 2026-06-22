import { useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { useToast } from '../../context/ToastContext.js';
import type { TrackedUser } from '@/types/index.js';

/**
 * Управление списком отслеживаемых пользователей, хранящимся под произвольным
 * ключом настроек. Общая основа для трёх независимых режимов слежки
 * (онлайн / активность / профили) — раньше эта логика была скопирована в
 * OnlineSpyTab по разу на каждый.
 *
 * @param settingKey  ключ в настройках (массив TrackedUser)
 * @param addedSuffix хвост тоста при добавлении: «добавлен <suffix>»
 */
export function useSpyTarget(settingKey: string, addedSuffix: string) {
  const { settings, saveSetting } = useSettings();
  const { showToast } = useToast();

  const trackedUsers: TrackedUser[] = (settings[settingKey] as TrackedUser[] | undefined) ?? [];
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

    void saveSetting(settingKey, [...trackedUsers, newUser]);
    showToast(`${newUser.name} добавлен ${addedSuffix}`, 'success');
    return true;
  }, [settingKey, addedSuffix, trackedUsers, trackedIds, saveSetting, showToast]);

  const toggleUser = useCallback((id: string, name: string, photo?: string): void => {
    const stringId = String(id);

    if (trackedIds.has(stringId)) {
      void saveSetting(settingKey, trackedUsers.filter(u => String(u.id) !== stringId));
    } else {
      const newUser: TrackedUser = { id: stringId, name, photo, addedAt: Date.now() };
      void saveSetting(settingKey, [...trackedUsers, newUser]);
    }
  }, [settingKey, trackedUsers, trackedIds, saveSetting]);

  const removeUser = useCallback((userId: string): void => {
    void saveSetting(settingKey, trackedUsers.filter(u => String(u.id) !== String(userId)));
    showToast('Пользователь удалён', 'success');
  }, [settingKey, trackedUsers, saveSetting, showToast]);

  return { trackedUsers, trackedIds, addUser, toggleUser, removeUser };
}
