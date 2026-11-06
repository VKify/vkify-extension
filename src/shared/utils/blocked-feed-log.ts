export interface BlockedFeedEntry {
  title?: string;
  owner?: { id?: number; name?: string };
  post?: { id?: number; owner_id?: number; text?: string; url?: string };
  attachments?: Array<{ type: string; title?: string }>;
  destination?: string;
}
export interface BlockedFeedLog {
  version: 1;
  type: string;
  api_method?: string;
  total: number;
  entries: BlockedFeedEntry[];
}
const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const id = (value: unknown): number | undefined => {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d{1,16}$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number !== 0 ? number : undefined;
};
const methodName = (value: unknown) => typeof value === 'string' && /^[a-z]\w*\.[a-z]\w*$/i.test(value) ? value.slice(0, 96) : undefined;

/** Allowlisted metadata only: no raw ad_data, tracking URLs, access keys or pixels.
 * Work is limited to blocked items, at most three creatives and two attachments. */
export function buildBlockedFeedLog(value: unknown, method: string | undefined, entities: { groups?: unknown; profiles?: unknown } = {}): BlockedFeedLog {
  const root = object(value) ?? {};
  const creatives = Array.isArray(root.ads) && root.ads.length ? root.ads : [root];
  const snapshot: BlockedFeedLog = { version:1, type:text(root.type ?? root.post_type, 60) ?? 'post', api_method:methodName(method), total:creatives.length, entries:[] };
  for (const raw of creatives.slice(0, 3)) {
    const creative = object(raw);
    if (!creative) continue;
    const nestedPost = object(creative.post), post = nestedPost ?? creative;
    const header = object(post.header) ?? object(root.header);
    const ownerId = id(post.owner_id) ?? id(post.from_id) ?? id(post.source_id) ?? id(object(header?.title)?.source_id);
    const postId = nestedPost || post.type === 'post' || post.post_type === 'post' || post.post_type === 'post_ads' || 'post_id' in post
      ? id(post.post_id) ?? id(post.id) : undefined;
    const group = ownerId && ownerId < 0 && Array.isArray(entities.groups)
      ? entities.groups.find(value => id(object(value)?.id) === -ownerId) : undefined;
    const profile = ownerId && ownerId > 0 && Array.isArray(entities.profiles)
      ? entities.profiles.find(value => id(object(value)?.id) === ownerId) : undefined;
    const ownerName = text(object(group)?.name, 100) ?? (profile
      ? text([text(object(profile)?.first_name, 50), text(object(profile)?.last_name, 50)].filter(Boolean).join(' '), 100) : undefined);
    const attachments: NonNullable<BlockedFeedEntry['attachments']> = [];
    if (Array.isArray(post.attachments)) for (const rawAttachment of post.attachments.slice(0, 2)) {
      const attachment = object(rawAttachment), type = text(attachment?.type, 30);
      if (!type) continue;
      attachments.push({ type, title:text(object(attachment?.[type])?.title, 120) });
    }
    const entry: BlockedFeedEntry = {
      title:text(creative.title, 160) ?? text(post.title, 160) ?? attachments.find(item => item.title)?.title ?? text(object(creative.ad_data)?.title, 160),
      ...(ownerId || ownerName ? {owner:{id:ownerId,name:ownerName}} : {}),
      ...(postId || text(post.text, 600) ? {post:{id:postId,owner_id:ownerId,text:text(post.text, 600),
        ...(postId && ownerId ? {url:`https://vk.ru/wall${ownerId}_${postId}`} : {})}} : {}),
      ...(attachments.length ? {attachments} : {}),
    };
    const target = text(creative.link_url ?? creative.url, 2048);
    if (target) try { const parsed=new URL(target); if(/^https?:$/.test(parsed.protocol)) entry.destination=parsed.hostname.slice(0,160); } catch { /* Ignore malformed URLs. */ }
    if (!Object.values(entry).some(Boolean)) continue;
    // Leave headroom below the existing 4096-character event/storage limit.
    if (JSON.stringify({...snapshot,entries:[...snapshot.entries,entry]}).length > 3900) {
      delete entry.attachments;
      if (entry.post?.text) entry.post.text=entry.post.text.slice(0,120);
    }
    if (JSON.stringify({...snapshot,entries:[...snapshot.entries,entry]}).length <= 3900) snapshot.entries.push(entry);
  }
  return snapshot;
}

export function blockedFeedDescription(snapshot: BlockedFeedLog): string {
  const entry = snapshot.entries[0];
  if (!entry) return snapshot.type;
  return [entry.title, entry.owner?.name ?? (entry.owner?.id ? `id${entry.owner.id}` : undefined),
    entry.post?.text?.replace(/\s+/g,' ').slice(0,220), entry.destination].filter(Boolean).join(' · ').slice(0,480) || snapshot.type;
}

/** Stored/page-originated JSON is untrusted. Reuse the allowlist for rendering. */
export function parseBlockedFeedLog(payload: string): BlockedFeedLog | null {
  try {
    const value=object(JSON.parse(payload));
    if(value?.version!==1 || !Array.isArray(value.entries)) return null;
    const entries: BlockedFeedEntry[]=[];
    for(const raw of value.entries.slice(0,3)) {
      const entry=object(raw); if(!entry) continue;
      const owner=object(entry.owner),post=object(entry.post),ownerId=id(post?.owner_id),postId=id(post?.id);
      entries.push({title:text(entry.title,160),owner:{id:id(owner?.id),name:text(owner?.name,100)},
        post:{id:postId,owner_id:ownerId,text:text(post?.text,600),url:ownerId&&postId?`https://vk.ru/wall${ownerId}_${postId}`:undefined},
        destination:text(entry.destination,160),
        attachments:Array.isArray(entry.attachments)?entry.attachments.slice(0,2).map(raw=>({type:text(object(raw)?.type,30)??'',title:text(object(raw)?.title,120)})):undefined});
    }
    return {version:1,type:text(value.type,60)??'post',api_method:methodName(value.api_method),
      total:typeof value.total==='number'&&Number.isSafeInteger(value.total)&&value.total>=entries.length?value.total:entries.length,entries};
  } catch {return null;}
}
