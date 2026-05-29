import type { useFriends } from '../../../hooks/features/useFriends.js';
import type { useConversations } from '../../../hooks/features/useConversations.js';
import type { useSpyTarget } from '../../../hooks/features/useSpyTarget.js';

/** Общий API управления списком отслеживаемых (online/activity/profile). */
export type SpyTargetApi = ReturnType<typeof useSpyTarget>;

/** Разделяемые между секциями данные друзей/диалогов (грузятся один раз). */
export interface SpyLists {
  hasToken: boolean;
  friends: ReturnType<typeof useFriends>;
  conversations: ReturnType<typeof useConversations>;
}
