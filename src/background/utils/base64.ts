/** Кодирование двоичных данных в base64 (для передачи в content-скрипт). */

/** Uint8Array → base64 порциями (обходит лимит аргументов String.fromCharCode). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
