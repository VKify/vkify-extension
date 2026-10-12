export const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024;
export const MAX_LOGO_RESOURCE_LENGTH = 3 * 1024 * 1024;
export const LOGO_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

/** Resources are only rendered as images, never inserted as markup or CSS. */
export function isSafeLogoResource(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_LOGO_RESOURCE_LENGTH) return false;
  if (value === '') return true;
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/]+={0,2}$/i.test(value)) return true;
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}
