import { activityMetrics, type DialogStat } from '@/shared/dialog-stats.js';

export type StatsRow = ReturnType<typeof activityMetrics>;
export type StatsFilter = 'all' | 'dead' | 'user' | 'group' | 'in' | 'out' | 'unread' | 'exact';
export const AGE_BUCKETS = ['week', 'month', 'quarter', 'older', 'unknown'] as const;
export type AgeBucket = typeof AGE_BUCKETS[number];
export function ageBucket(row: StatsRow): AgeBucket {
  const days = row.daysSinceLast;
  return days === null ? 'unknown' : days < 7 ? 'week' : days < 30 ? 'month' : days < 90 ? 'quarter' : 'older';
}
export function filterStats(rows: StatsRow[], filter: StatsFilter, search: string, age: AgeBucket | null, sort: string): StatsRow[] {
  const query = search.trim().toLocaleLowerCase();
  return rows.filter(row => {
    const matches = filter === 'all' || filter === 'dead' && row.isDead
      || filter === 'user' && row.type === 'user'
      || filter === 'group' && (row.type === 'group' || row.type === 'chat')
      || (filter === 'in' || filter === 'out') && row.type === 'user' && row.lastDirection === filter
      || filter === 'unread' && row.unread > 0 || filter === 'exact' && row.countExact;
    return matches && (!age || ageBucket(row) === age)
      && (row.title.toLocaleLowerCase().includes(query) || String(row.peerId).includes(query));
  }).sort((a, b) => {
    const value = sort === 'count' ? (b.approxMessageCount ?? -1) - (a.approxMessageCount ?? -1)
      : sort === 'days' ? (b.daysSinceLast ?? -1) - (a.daysSinceLast ?? -1)
        : sort === 'unread' ? b.unread - a.unread : (b.lastMessageAt ?? -1) - (a.lastMessageAt ?? -1);
    return value || a.peerId - b.peerId;
  });
}
export function dialogUrl(row: DialogStat): string {
  return `https://vk.ru/im?sel=${row.type === 'chat' ? `c${row.peerId - 2000000000}` : row.peerId}`;
}
/** Machine-readable metadata only. Guard spreadsheet formulas in user-controlled titles. */
export function statsCsv(rows: StatsRow[]): string {
  const cell = (value: string | number | boolean | null): string => {
    let text = value === null ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const headers = ['peerId', 'title', 'type', 'messageCount', 'countExact', 'lastMessageAt', 'daysSinceLast', 'lastDirection', 'unread', 'isDead', 'url'];
  return '\uFEFF' + [headers.join(','), ...rows.map(row => [
    row.peerId, row.title, row.type, row.approxMessageCount, row.countExact,
    row.lastMessageAt === null ? null : new Date(row.lastMessageAt).toISOString(),
    row.daysSinceLast, row.lastDirection, row.unread, row.isDead, dialogUrl(row),
  ].map(cell).join(','))].join('\r\n');
}
