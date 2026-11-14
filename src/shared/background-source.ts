import { isSafeBackgroundResource } from './background-resource.js';
export function isBackgroundSource(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && isSafeBackgroundResource(value);
}
export function shouldCacheBackground(url: string): boolean {
  if (!isBackgroundSource(url)) return false;
  const host = new URL(url).hostname;
  return !/(^|\.)(vkify\.ru|vk\.ru|vk\.com|userapi\.com|vkuserphoto\.ru|vk-cdn\.net)$/.test(host);
}
