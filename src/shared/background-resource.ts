/** Background resource validation shared by storage boundaries and rendering. */
export function isSafeBackgroundResource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const input = value.trim();
  if (!input) return true;
  if (/^data:/i.test(input)) {
    return /^data:(?:image\/(?:png|jpeg|jpg|gif|webp|avif|bmp)|video\/(?:mp4|webm|ogg))(?:;[a-z0-9!#$&^_.+-]+=[^;,]*)*(?:;base64)?,/i.test(input);
  }
  try {
    const url = new URL(input);
    if (url.username || url.password) return false;
    return ['http:', 'https:', 'chrome-extension:', 'moz-extension:'].includes(url.protocol);
  } catch { return false; }
}
