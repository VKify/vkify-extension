import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '../../store/index.js';
import { useSetting } from '../../store/selectors.js';
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
  const { t } = useTranslation('spy');
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const { showToast } = useToast();

  // Узкая подписка на динамический ключ списка (online/activity/profile).
  const trackedUsers: TrackedUser[] = useSetting<TrackedUser[] | undefined>(settingKey) ?? [];
  const trackedIds = new Set(trackedUsers.map(u => String(u.id)));

  const addUser = useCallback((userId: string, name?: string): boolean => {
    const cleanId = userId.trim().replace(/\D/g, '');

    if (!cleanId) {
      showToast(t('toast.invalid_id'), 'error');
      return false;
    }
    if (trackedIds.has(cleanId)) {
      showToast(t('toast.already_added'), 'error');
      return false;
    }

    const newUser: TrackedUser = {
      id: cleanId,
      name: name?.trim() || `ID ${cleanId}`,
      addedAt: Date.now(),
    };

    void saveSetting(settingKey, [...trackedUsers, newUser]);
    showToast(t('toast.added', { name: newUser.name, suffix: addedSuffix }), 'success');
    return true;
  }, [settingKey, addedSuffix, trackedUsers, trackedIds, saveSetting, showToast, t]);

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
    showToast(t('toast.removed'), 'success');
  }, [settingKey, trackedUsers, saveSetting, showToast, t]);

  return { trackedUsers, trackedIds, addUser, toggleUser, removeUser };
}
