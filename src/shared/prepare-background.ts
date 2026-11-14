import { isBackgroundSource, shouldCacheBackground } from './background-source.js';
/** Resolve background images automatically while sharing only their original URLs. */
export async function prepareBackground(settings: Record<string, unknown>, fetchImage: (url: string) => Promise<{ success?: boolean; dataUrl?: string }> = url => chrome.runtime.sendMessage({ type: 'FETCH_BACKGROUND_IMAGE', url })): Promise<Record<string, unknown>> {
  if (!Object.prototype.hasOwnProperty.call(settings, 'custom_background')) return settings;
  const url = settings.custom_background;
  const source = isBackgroundSource(url) ? url : typeof url === 'string' && url.startsWith('data:image/') && isBackgroundSource(settings.background_source_url) ? settings.background_source_url : '';
  const result: Record<string, unknown> = { ...settings, background_source_url: source };
  if (settings.background_type !== 'image' || !isBackgroundSource(url) || !shouldCacheBackground(url)) return result;
  try {
    const response = await fetchImage(url);
    if (response.success && response.dataUrl?.startsWith('data:image/')) result.custom_background = response.dataUrl;
  } catch { /* Keep the original URL if the server disallows fetching. */ }
  return result;
}
