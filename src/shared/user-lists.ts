export const USER_LIST_MAX = 10000;
export const USER_LIST_FILE_MAX = 1024 * 1024;
export const validUserId = (id: unknown): id is number => Number.isSafeInteger(id) && (id as number) > 0;
export function normalizeUserIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > USER_LIST_MAX || !value.every(validUserId)) throw new Error('INVALID_USER_LIST');
  return [...new Set(value)];
}
function userId(value: unknown): number {
  if (typeof value === 'number' && validUserId(value)) return value;
  if (typeof value !== 'string') throw new Error('INVALID_USER_LIST');
  const text = value.trim();
  const match = /^(?:id)?([1-9]\d*)$/.exec(text)
    ?? /^(?:https?:\/\/)?(?:m\.)?vk\.(?:ru|com)\/id([1-9]\d*)\/?(?:[?#].*)?$/.exec(text);
  if (!match || !validUserId(Number(match[1]))) throw new Error('INVALID_USER_LIST');
  return Number(match[1]);
}
/** TXT IDs/links, CSV with an id column, and JSON arrays or {ids: []}.
 * Reject the whole file on malformed entries: never silently target other IDs. */
export function parseUserList(text: string): number[] {
  if (text.length > USER_LIST_FILE_MAX) throw new Error('USER_LIST_TOO_LARGE');
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('INVALID_USER_LIST');
  let values: unknown[];
  if (/^[\[{]/.test(clean)) {
    const json = JSON.parse(clean) as unknown;
    const items = Array.isArray(json) ? json : (json as { ids?: unknown }).ids;
    if (!Array.isArray(items)) throw new Error('INVALID_USER_LIST');
    values = items.map(item => item && typeof item === 'object' ? (item as { id?: unknown }).id : item);
  } else {
    const lines = clean.split(/\r?\n/).filter(line => line.trim());
    const first = lines[0].split(/[,;\t]/).map(cell => cell.trim().replace(/^"|"$/g, ''));
    const column = first.findIndex(cell => /^(?:id|user_id)$/i.test(cell));
    if (column >= 0) {
      values = lines.slice(1).map(line => {
        const cells = line.match(/(?:"(?:[^"]|"")*"|[^,;\t]*)(?:[,;\t]|$)/g)?.filter(Boolean)
          .map(cell => cell.replace(/[,;\t]$/, '').trim().replace(/^"|"$/g, '')) ?? [];
        return cells[column];
      });
    } else values = clean.split(/[\s,;]+/).filter(Boolean);
  }
  if (values.length > USER_LIST_MAX) throw new Error('USER_LIST_TOO_LARGE');
  return normalizeUserIds(values.map(userId));
}
