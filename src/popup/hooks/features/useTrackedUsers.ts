import { StorageKey } from '../../../shared/constants/storage-keys.js';
import { useSpyTarget } from './useSpyTarget.js';

/** Онлайн-мониторинг: список отслеживаемых пользователей. */
export function useTrackedUsers() {
  return useSpyTarget(StorageKey.ONLINE_TRACKED_USERS, 'в слежку');
}
