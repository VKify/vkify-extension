type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;

/** newsfeed.getRightBlock returns one optional block. Keep layout and other data intact. */
export function removeFeaturedGamePromo(value: unknown): RecordValue | null {
  const response = object(object(value)?.response);
  const block = object(response?.block);
  if (!response || block?.frb_type !== 'frb_featured_promo_game') return null;
  delete response.block;
  return block;
}
