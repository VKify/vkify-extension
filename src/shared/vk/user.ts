/**
 * Канонический маппинг сырого VK-юзера (snake_case из users.get) в доменный
 * VKUser (camelCase). Единый источник — используется и content VKApiService,
 * и popup-хуком, чтобы форма VKUser не расходилась между контекстами.
 */

import type { VKUser, VKUserRaw } from '@/types/index.js';

export function formatUser(user: VKUserRaw): VKUser {
  return {
    id: user.id,
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
    photo50: user.photo_50 ?? null,
    photo100: user.photo_100 ?? null,
    photo200: user.photo_200 ?? null,
    online: !!user.online,
    lastSeen: user.last_seen ?? null,
    city: user.city?.title ?? null,
    status: user.status ?? null,
    followersCount: user.followers_count ?? null,
    bdate: user.bdate ?? null,
  };
}
