export type FriendFilter = 'all' | 'inactive' | 'noAvatar' | 'deactivated' | 'hiddenLastSeen';
export type AuditSection = 'friends' | 'incoming' | 'outgoing';
export type OnlineStatus = 'recently' | 'last_week' | 'last_month' | 'long_ago' | 'not_show';
export interface FriendProfile {
  id: number;
  name: string;
  photo?: string;
  online: boolean;
  lastSeen?: number;
  activityHidden?: boolean;
  approximateStatus?: OnlineStatus;
  deactivated?: 'deleted' | 'banned';
  noAvatar: boolean;
}
export interface FriendAuditItem extends FriendProfile {
  inactive: boolean;
  hiddenLastSeen: boolean;
}
export interface FriendRequestItem extends FriendProfile { requestDate?: number }
export interface FriendsAuditSnapshot {
  version: 2;
  userId: string;
  fetchedAt: number;
  friends: FriendProfile[];
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
  enrichmentFailed?: boolean;
  requestErrors?: Partial<Record<'incoming' | 'outgoing', string>>;
}
export interface FriendAuditSummary {
  total: number; inactive: number; hiddenLastSeen: number; noAvatar: number; deactivated: number;
  incoming: number | null; outgoing: number | null;
}
export interface AuditUserRaw {
  id: number; first_name?: string; last_name?: string;
  photo_100?: string; photo_200?: string; has_photo?: number;
  online?: number; last_seen?: { time?: number }; deactivated?: string;
  online_info?: { visible: boolean; is_online?: boolean; last_seen?: number; status?: OnlineStatus };
}
export const AUDIT_TTL = 3 * 60 * 60 * 1000;
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
export function normalizeFriend(raw: AuditUserRaw): FriendProfile {
  const photo = raw.photo_200 || raw.photo_100;
  // online_info is the privacy-aware API representation. Explicitly hidden
  // activity must not be replaced by a legacy timestamp or a stale online bit.
  // https://github.com/VKCOM/vk-api-schema/blob/master/users/objects.json
  const info = raw.online_info;
  const hidden = info?.visible === false;
  const deactivated = raw.deactivated === 'deleted' || raw.deactivated === 'banned' ? raw.deactivated : undefined;
  const timestamp = validTime(info?.last_seen) ? info.last_seen : raw.last_seen?.time;
  const status = info?.status;
  return {
    id: raw.id, name: `${raw.first_name ?? ''} ${raw.last_name ?? ''}`.trim() || `id${raw.id}`,
    photo: photo?.startsWith('https://') ? photo : undefined,
    online: !hidden && !deactivated && (info?.is_online ?? raw.online === 1),
    lastSeen: !hidden && validTime(timestamp) ? timestamp : undefined,
    activityHidden: hidden,
    approximateStatus: hidden && status && ['recently', 'last_week', 'last_month', 'long_ago', 'not_show'].includes(status) ? status : undefined,
    deactivated,
    noAvatar: raw.has_photo === 0 || !photo || /(?:camera(?:_[^/?]*)?|deactivated)\.(?:png|gif|jpe?g)(?:[?]|$)/i.test(photo),
  };
}
export function auditFriend(profile: FriendProfile, days: number, now = Date.now()): FriendAuditItem {
  // Every offline profile without an exact timestamp belongs to this group,
  // including deactivated profiles. Missing data never proves inactivity.
  const hiddenLastSeen = !profile.lastSeen && !profile.online;
  return { ...profile, hiddenLastSeen,
    inactive: !profile.online && !profile.deactivated && profile.lastSeen !== undefined
      && now - profile.lastSeen * 1000 > days * 86400000,
  };
}
export function summarizeFriends(items: FriendAuditItem[], snapshot: FriendsAuditSnapshot): FriendAuditSummary {
  return { total: items.length, inactive: items.filter(x => x.inactive).length,
    hiddenLastSeen: items.filter(x => x.hiddenLastSeen).length,
    noAvatar: items.filter(x => x.noAvatar).length, deactivated: items.filter(x => x.deactivated).length,
    incoming: snapshot.requestErrors?.incoming ? null : snapshot.incoming.length,
    outgoing: snapshot.requestErrors?.outgoing ? null : snapshot.outgoing.length };
}
