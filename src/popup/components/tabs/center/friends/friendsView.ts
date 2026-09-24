import type { FriendProfile } from '@/shared/friends-audit.js';

export const ACTIVITY_BUCKETS = ['recent', 'halfYear', 'year', 'older', 'unknown'] as const;
export type ActivityBucket = typeof ACTIVITY_BUCKETS[number];
export function activityBucket(user: FriendProfile, now = Date.now()): ActivityBucket {
  if (user.online) return 'recent';
  if (!user.lastSeen) return 'unknown';
  const days = (now - user.lastSeen * 1000) / 86400000;
  if (days < 90) return 'recent';
  if (days < 180) return 'halfYear';
  if (days < 365) return 'year';
  return 'older';
}
