/** Only metadata is retained; message bodies never enter the report. */
export const DIALOG_STATS_KEY = 'dialog_stats_state';
export const DIALOG_STATS_TTL = 3 * 60 * 60 * 1000;
export const DIALOG_STATS_EXACT_LIMIT = 20;
export interface DialogStat {
  peerId: number;
  title: string;
  type: 'user' | 'chat' | 'group';
  avatar?: string;
  lastMessageAt: number | null;
  lastDirection: 'in' | 'out' | 'unknown';
  approxMessageCount: number | null;
  countExact: boolean;
  unread: number;
}
export interface DialogStatsState {
  version: 1;
  ownerId: string;
  status: 'idle' | 'running' | 'completed' | 'cancelled' | 'failed';
  mode: 'quick' | 'exact';
  rows: DialogStat[];
  collectedAt: number | null;
  completed: number;
  total: number;
  error?: string;
}
export const emptyDialogStats = (ownerId = ''): DialogStatsState => ({
  version: 1, ownerId, status: 'idle', mode: 'quick', rows: [],
  collectedAt: null, completed: 0, total: 0,
});
export interface StatsMessage {
  date?: number;
  out?: number;
  conversation_message_id?: number;
}
export interface ConversationsPage {
  count: number;
  items: Array<{
    conversation: {
      peer: { id: number; type: DialogStat['type'] };
      unread_count?: number;
      chat_settings?: { title?: string; photo?: { photo_100?: string } };
    };
    last_message?: StatsMessage;
  }>;
  profiles?: Array<{ id: number; first_name?: string; last_name?: string; photo_100?: string }>;
  groups?: Array<{ id: number; name?: string; photo_100?: string }>;
}
export function lastMessageMetrics(message?: StatsMessage): Pick<DialogStat, 'lastMessageAt' | 'lastDirection'> {
  return {
    lastMessageAt: message?.date && message.date > 0 ? message.date * 1000 : null,
    lastDirection: message?.out === 1 ? 'out' : message?.out === 0 ? 'in' : 'unknown',
  };
}
export function normalizeConversations(page: ConversationsPage): DialogStat[] {
  const users = new Map(page.profiles?.map(p => [p.id, p]));
  const groups = new Map(page.groups?.map(g => [g.id, g]));
  return page.items.map(({ conversation, last_message }) => {
    const { peer, chat_settings } = conversation;
    const user = users.get(peer.id);
    const group = groups.get(Math.abs(peer.id));
    const cmid = last_message?.conversation_message_id;
    return {
      peerId: peer.id, type: peer.type,
      title: (peer.type === 'chat' ? chat_settings?.title : peer.type === 'group' ? group?.name
        : [user?.first_name, user?.last_name].filter(Boolean).join(' ')) || String(peer.id),
      avatar: peer.type === 'chat' ? chat_settings?.photo?.photo_100
        : peer.type === 'group' ? group?.photo_100 : user?.photo_100,
      ...lastMessageMetrics(last_message),
      // A peer-local sequence number is an estimate, NOT a count of surviving messages.
      approxMessageCount: Number.isSafeInteger(cmid) && cmid! > 0 ? cmid! : null,
      countExact: false, unread: conversation.unread_count ?? 0,
    };
  });
}
export function activityMetrics(row: DialogStat, threshold: number, now = Date.now()) {
  const daysSinceLast = row.lastMessageAt === null ? null
    : Math.max(0, Math.floor((now - row.lastMessageAt) / 86_400_000));
  return { ...row, daysSinceLast, isDead: daysSinceLast !== null && daysSinceLast >= threshold };
}
export function isFreshReport(state: DialogStatsState, ownerId: string, now = Date.now()): boolean {
  return state.version === 1 && state.ownerId === ownerId && state.status === 'completed'
    && state.collectedAt !== null && now >= state.collectedAt && now - state.collectedAt < DIALOG_STATS_TTL;
}
