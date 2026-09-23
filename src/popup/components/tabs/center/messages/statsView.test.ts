import { describe, expect, it } from 'vitest';
import { activityMetrics, type DialogStat } from '@/shared/dialog-stats.js';
import { ageBucket, filterStats, statsCsv } from './statsView.js';
const row: DialogStat = { peerId: 1, title: 'Alice', type: 'user', lastMessageAt: 1,
  lastDirection: 'in', approxMessageCount: 200, countExact: false, unread: 3 };
const aged = (days: number | null) => activityMetrics({ ...row, lastMessageAt: days === null ? null : 1_000_000_000_000 - days * 86400000 }, 90, 1_000_000_000_000);
describe('statistics views', () => {
  it('uses non-overlapping date buckets, including unknown dates', () => {
    expect([0, 6, 7, 29, 30, 89, 90, 300, null].map(days => ageBucket(aged(days))))
      .toEqual(['week', 'week', 'month', 'month', 'quarter', 'quarter', 'older', 'older', 'unknown']);
  });
  it('combines filters and supports search by peer ID, unread sorting and exact counts', () => {
    const rows = [aged(2), { ...aged(100), peerId: 42, title: 'Bob', countExact: true, unread: 5 }];
    expect(filterStats(rows, 'unread', '', null, 'unread').map(row => row.peerId)).toEqual([42, 1]);
    expect(filterStats(rows, 'exact', '42', 'older', 'count')).toHaveLength(1);
    expect(filterStats(rows, 'exact', '42', 'week', 'count')).toHaveLength(0);
    expect(filterStats(rows, 'all', ' ALICE ', null, 'count')).toHaveLength(1);
  });
  it('exports metadata with escaped quotes, formula protection and explicit count accuracy', () => {
    const csv = statsCsv([{ ...aged(2), title: '=HYPERLINK("bad")\nnext', peerId: -1 }]);
    expect(csv.startsWith('\uFEFFpeerId,title,')).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")\nnext"');
    expect(csv).toContain('"-1"');
    expect(csv).toContain('"200","false"');
    expect(csv).not.toContain('avatar');
  });
});
