import { describe, expect, it } from 'vitest';
import { activityMetrics, normalizeConversations, lastMessageMetrics, emptyDialogStats, isFreshReport, DIALOG_STATS_TTL } from './dialog-stats.js';

describe('dialog report normalization', () => {
  it('resolves users, communities and chats without using global message IDs as counts', () => {
    const rows = normalizeConversations({ count: 3, items: [
      { conversation: { peer: { id: 1, type: 'user' } }, last_message: { date: 10, out: 0 } },
      { conversation: { peer: { id: -2, type: 'group' } }, last_message: { conversation_message_id: 55 } },
      { conversation: { peer: { id: 2000000003, type: 'chat' }, chat_settings: { title: 'Chat' } } },
    ], profiles: [{ id: 1, first_name: 'First', last_name: 'Last' }], groups: [{ id: 2, name: 'Group' }] });
    expect(rows.map(row => row.title)).toEqual(['First Last', 'Group', 'Chat']);
    expect(rows[0]).toMatchObject({ approxMessageCount: null, lastDirection: 'in' });
    expect(rows[1]).toMatchObject({ approxMessageCount: 55, countExact: false });
    expect(rows[2]).toMatchObject({ lastMessageAt: null, lastDirection: 'unknown' });
  });
  it('derives inactivity from current time, handles the threshold boundary and unknown dates', () => {
    const row = normalizeConversations({ count: 1, items: [{ conversation: { peer: { id: 1, type: 'user' } } }] })[0];
    const now = 180 * 86400000;
    expect(activityMetrics(row, 90, now)).toMatchObject({ daysSinceLast: null, isDead: false });
    expect(activityMetrics({ ...row, lastMessageAt: now - 90 * 86400000 }, 90, now)).toMatchObject({ daysSinceLast: 90, isDead: true });
    expect(activityMetrics({ ...row, lastMessageAt: now + 1000 }, 90, now).daysSinceLast).toBe(0);
    expect(lastMessageMetrics({ out: 1 }).lastDirection).toBe('out');
  });
  it('requires owner, completion and TTL for cache reuse', () => {
    const report = { ...emptyDialogStats('1'), status: 'completed' as const, collectedAt: 1000 };
    expect(isFreshReport(report, '1', 1001)).toBe(true);
    expect(isFreshReport(report, '2', 1001)).toBe(false);
    expect(isFreshReport(report, '1', 1000 + DIALOG_STATS_TTL)).toBe(false);
    expect(isFreshReport({ ...report, status: 'cancelled' }, '1', 1001)).toBe(false);
  });
});
