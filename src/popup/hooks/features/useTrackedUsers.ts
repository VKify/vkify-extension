import { useTranslation } from 'react-i18next';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { useSpyTarget } from './useSpyTarget.js';

/** Онлайн-мониторинг: список отслеживаемых пользователей. */
export function useTrackedUsers() {
  const { t } = useTranslation('spy');
  return useSpyTarget(StorageKey.ONLINE_TRACKED_USERS, t('suffix.watch'));
}
