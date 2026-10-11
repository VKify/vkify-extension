/** Native VK card radius. At this value VK keeps control of component radii. */
export const DEFAULT_BLOCK_RADIUS = 12;

export function normalizeBlockRadius(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : DEFAULT_BLOCK_RADIUS;
}
