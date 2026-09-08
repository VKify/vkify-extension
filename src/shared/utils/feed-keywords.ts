export interface FeedKeywords { block: string[]; allow: string[] }

export function normalizeFeedWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((word): word is string => typeof word === 'string')
    .map(word => word.trim().toLowerCase()).filter(Boolean))];
}

/** Case-insensitive substring matching; exceptions take priority over stop words. */
export function matchFeedWord(text: string, words: FeedKeywords): string | null {
  const lower = text.toLowerCase();
  if (words.allow.some(word => word && lower.includes(word))) return null;
  return words.block.find(word => word && lower.includes(word)) ?? null;
}

/** Read post/repost/attachment text, never URL, tracking or arbitrary metadata. */
export function feedItemText(item: unknown): string {
  const texts: string[] = [];
  const seen = new WeakSet<object>();
  const children = ['post', 'copy_history', 'attachments', 'ads', 'link', 'photo',
    'video', 'doc', 'audio', 'poll', 'article', 'event', 'market', 'market_album'];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'title', 'description', 'caption']) {
      if (typeof record[key] === 'string') texts.push(record[key]);
    }
    for (const key of children) visit(record[key]);
  }
  visit(item);
  return texts.join('\n');
}
