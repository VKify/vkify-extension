export const GROUP_PARSER_STATE = 'group_parser_state';
export const GROUP_PARSER_LEDGER = 'group_parser_ledger';
export const GROUP_PARSER_ALARM = 'groupMembersParser';
export const GROUP_PARSER_CAPS = { users: 10000, page: 1000, delay: 30000, hour: 120, day: 500 };
export interface ParserGroup { id: number; name: string; photo_100?: string; is_closed?: number; deactivated?: string }
export interface GroupParserState {
  status: 'idle' | 'running' | 'completed' | 'limit' | 'stopped' | 'error' | 'interrupted';
  userId?: string;
  group?: ParserGroup;
  ids: number[];
  limit?: number;
  total?: number;
  offset?: number;
  nextAt?: number;
  inFlight?: boolean;
  phase?: 'preparing' | 'waiting' | 'loading';
  error?: string;
  code?: string;
}
export function communityReference(value: unknown): string {
  if (typeof value !== 'string' || value.length > 250) throw new Error('INVALID_COMMUNITY');
  let text = value.trim();
  if (/^(?:https?:\/\/|(?:m\.)?vk\.(?:ru|com)\/)/i.test(text)) {
    let url: URL;
    try { url = new URL(text.includes('://') ? text : 'https://' + text); } catch { throw new Error('INVALID_COMMUNITY'); }
    if (!['https:', 'http:'].includes(url.protocol) || !/^(?:m\.)?vk\.(?:ru|com)$/.test(url.hostname) || url.username || url.password || url.port) throw new Error('INVALID_COMMUNITY');
    text = url.pathname.replace(/^\/|\/$/g, '');
  }
  const numeric = /^(?:club|public|event)?([1-9]\d*)$/.exec(text);
  if (numeric) {
    if (!Number.isSafeInteger(Number(numeric[1]))) throw new Error('INVALID_COMMUNITY');
    return numeric[1];
  }
  if (/^[a-zA-Z][\w.]{1,99}$/.test(text)) return text;
  throw new Error('INVALID_COMMUNITY');
}
