type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;

/** newsfeed.getRightBlock returns one optional block. Keep layout and other data intact. */
export function removeFeedRightPromo(value: unknown): RecordValue | null {
  const response = object(object(value)?.response);
  const block = object(response?.block);
  if (!response || !block || (block.frb_type !== 'frb_featured_promo_game' && block.type !== 'recommended_app')) return null;
  delete response.block;
  return block;
}
