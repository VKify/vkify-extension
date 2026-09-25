/** Music floating widgets are intended for VK's music UI, not vkvideo.ru. */
export function isVkVideoHost(hostname = window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === 'vkvideo.ru' || host.endsWith('.vkvideo.ru');
}
