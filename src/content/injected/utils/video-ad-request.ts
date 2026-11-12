/** Dedicated advertising endpoints observed in VK Video's VideoGetAdsFetchService. */
export function isVideoAdApiRequest(value: string): boolean {
  try {
    const url = new URL(value, location.href);
    return url.protocol === 'https:' && ['api.vk.ru', 'web.api.vk.ru', 'api.vkvideo.ru'].includes(url.hostname)
      && /^\/method\/video\.getAds(?:Data)?$/.test(url.pathname);
  } catch { return false; }
}

/** Missing optional campaigns are a successful API result, not a transport error. */
export function emptyVideoAdResponse(): Response {
  return new Response(JSON.stringify({ response: {} }), {
    status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** The upsell checks these fields; leave real subscription entitlement intact. */
export function filterVideoPremium(method: string, data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const value = data as Record<string, unknown>;
  if (method === 'video.getUserInfo') {
    const subscription = value.subscription;
    if (!subscription || typeof subscription !== 'object' || Array.isArray(subscription)) return false;
    const offer = subscription as Record<string, unknown>;
    if (offer.is_available !== true && offer.is_available !== 1) return false;
    offer.is_available = false;
    return true;
  }
  if (method === 'video.getSnackBarInfo' && (value.can_show === true || value.can_show === 1)) {
    value.can_show = false;
    return true;
  }
  return false;
}

export function videoApiMethod(value: string): string | undefined {
  try {
    const url = new URL(value, location.href);
    if (url.protocol !== 'https:' || !['api.vk.ru', 'web.api.vk.ru', 'api.vkvideo.ru'].includes(url.hostname)) return;
    return /^\/method\/([^/]+)$/.exec(url.pathname)?.[1];
  } catch { return; }
}
