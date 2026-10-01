/** Center tool models and response normalization. Shapes follow VK API 5.199. */
export type CenterApi = (method: string, params: Record<string, unknown>) => Promise<unknown>;
export type MediaType = 'photo' | 'doc' | 'link' | 'video' | 'audio_message';
export const MEDIA_TYPES: MediaType[] = ['photo', 'doc', 'link', 'video', 'audio_message'];
type Raw = Record<string, unknown>;
export function object(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {};
}
function list(value: unknown): Raw[] { return Array.isArray(value) ? value.map(object) : []; }
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function peerUrl(peer: number, cmid?: number): string {
  return `https://vk.ru/im?sel=${peer >= 2000000000 ? 'c' + (peer - 2000000000) : peer}${cmid ? '&cmid=' + cmid : ''}`;
}
export interface ToolDialog { id: number; title: string; avatar: string | null }
export interface ToolFile {
  key: string; type: MediaType; title: string; url: string | null; preview: string | null;
  date: number; cmid: number; size: number | null;
}
export interface GlobalToolFile extends ToolFile { peerId: number; dialogTitle: string }
export interface ToolGroup {
  id: number; title: string; avatar: string | null; members: number | null;
  closed: boolean; deactivated: boolean;
  activity: 'unchecked' | 'active' | 'inactive' | 'empty' | 'unavailable' | 'error';
  lastPost: number | null;
}
export function dialogPage(raw: unknown): { rows: ToolDialog[]; count: number; consumed: number } {
  const data = object(raw);
  if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
  const profiles = list(data.profiles), groups = list(data.groups);
  const rows = list(data.items).flatMap(item => {
    const conversation = object(item.conversation), peer = object(conversation.peer);
    const id = Number(peer.id);
    if (!Number.isSafeInteger(id) || id === 0) return [];
    const info = id < 0 ? groups.find(g => Number(g.id) === -id) : profiles.find(p => Number(p.id) === id);
    const chat = object(conversation.chat_settings);
    const title = typeof chat.title === 'string' ? chat.title : id < 0 ? info?.name
      : [info?.first_name, info?.last_name].filter(Boolean).join(' ');
    return [{ id, title: String(title || `ID ${id}`), avatar: safeUrl(object(chat.photo).photo_100 ?? info?.photo_100 ?? info?.photo_50) }];
  });
  return { rows, count: Number(data.count) || rows.length, consumed: data.items.length };
}
function bestPhoto(value: unknown): string | null {
  const sizes = list(value).filter(s => safeUrl(s.url ?? s.src));
  sizes.sort((a, b) => Number(b.width || 0) - Number(a.width || 0));
  return safeUrl(sizes[0]?.url ?? sizes[0]?.src);
}
export function filePage(raw: unknown, type: MediaType): { rows: ToolFile[]; next: string | null } {
  const data = object(raw);
  if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
  const rows = list(data.items).flatMap(item => {
    const attachment = object(item.attachment), media = object(attachment[type]);
    if (attachment.type !== type || !Object.keys(media).length) return [];
    const cmid = Number(item.cmid) || 0;
    const id = `${media.owner_id ?? ''}_${media.id ?? ''}`;
    const preview = type === 'photo' ? bestPhoto(media.sizes) : type === 'video' ? bestPhoto(media.image) : null;
    const url = type === 'photo' ? preview : type === 'video'
      ? Number.isSafeInteger(media.id) && Number.isSafeInteger(media.owner_id) ? `https://vk.ru/video${id}` : null
      : safeUrl(type === 'audio_message' ? media.link_mp3 ?? media.link_ogg : media.url);
    return [{ key: `${cmid}:${item.message_id ?? ''}:${item.forward_level ?? 0}:${item.position ?? ''}:${type}:${id}:${type === 'link' ? url ?? '' : ''}`,
      type, title: typeof media.title === 'string' ? media.title : typeof media.text === 'string' ? media.text : '',
      url, preview, date: Number(item.date) || 0, cmid,
      size: typeof media.size === 'number' && media.size >= 0 ? media.size : null }];
  });
  return { rows, next: typeof data.next_from === 'string' && data.next_from ? data.next_from : null };
}
export function groupPage(raw: unknown): { rows: ToolGroup[]; count: number; consumed: number } {
  const data = object(raw);
  if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
  const rows = list(data.items).flatMap(g => {
    const id = Number(g.id);
    if (!Number.isSafeInteger(id) || id <= 0) return [];
    return [{ id, title: String(g.name || `ID ${id}`), avatar: safeUrl(g.photo_100 ?? g.photo_50),
      members: typeof g.members_count === 'number' ? g.members_count : null,
      closed: Number(g.is_closed) > 0, deactivated: !!g.deactivated,
      activity: g.deactivated ? 'unavailable' as const : 'unchecked' as const, lastPost: null }];
  });
  return { rows, count: Number(data.count) || rows.length, consumed: data.items.length };
}
export function wallActivity(raw: unknown, days: number, now = Date.now()): Pick<ToolGroup, 'activity' | 'lastPost'> {
  const data = object(raw);
  if (!Array.isArray(data.items)) throw new Error('INVALID_RESPONSE');
  // A pinned old post is not the latest publication. count=2 includes the next post.
  const dates = list(data.items).map(p => Number(p.date)).filter(d => Number.isFinite(d) && d > 0);
  if (!dates.length) return { activity: Number(data.count) === 0 ? 'empty' : 'error', lastPost: null };
  const lastPost = Math.max(...dates) * 1000;
  return { activity: now - lastPost > days * 86400000 ? 'inactive' : 'active', lastPost };
}
export function mergeRows<T>(old: T[], next: T[], key: (row: T) => string | number): T[] {
  const map = new Map(old.map(row => [key(row), row]));
  next.forEach(row => map.set(key(row), row));
  return [...map.values()];
}
