/**
 * Криптографическое ядро шифрования сообщений VKify.
 *
 * Чистый модуль — без DOM/Chrome API, тестируется в Node.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ § 1  Кодирование          — hex, base64, base64url                        │
 * │ § 2  AES-128 block cipher — FIPS 197 (нужно для COFFEE-совместимости,     │
 * │                             т.к. Web Crypto не поддерживает ECB)          │
 * │ § 3  PKCS7 padding        — RFC 5652 §6.3                                 │
 * │ § 4  AES-128-ECB          — high-level (encrypt/decrypt с PKCS7)          │
 * │ § 5  COFFEE               — Kate Mobile / VK Coffee / Laney / Vika        │
 * │                             AES-128-ECB + base64 + hex, маркеры PP/II/... │
 * │ § 6  VKify E2E v2         — AES-256-GCM + PBKDF2-SHA-256 (Web Crypto)     │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

// ═════════════════════════════════════════════════════════════════════════════
// § 1  Кодирование
// ═════════════════════════════════════════════════════════════════════════════

const _te = new TextEncoder();
const _td = new TextDecoder();

/** Hex → bytes. Whitespace игнорируется. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out   = new Uint8Array(clean.length >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Bytes → "AA BB CC" (uppercase, разделитель — пробел). */
export function bytesToHex(data: Uint8Array): string {
  return Array.from(data, b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

/** Bytes → стандартный base64 (с padding '='). Internal. */
function _bytesToB64(data: Uint8Array): string {
  let s = '';
  for (let i = 0; i < data.length; i++) s += String.fromCharCode(data[i]);
  return btoa(s);
}

/** Стандартный base64 → bytes. null если строка невалидна. Internal. */
function _b64ToBytes(b64: string): Uint8Array | null {
  try { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
  catch { return null; }
}

/** Bytes → base64url без padding (RFC 4648 §5). */
export function toBase64url(buf: Uint8Array): string {
  return _bytesToB64(buf)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '');
}

/** Base64url → bytes. Принимает с padding и без. */
export function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  return Uint8Array.from(atob(b64 + '='.repeat(pad)), c => c.charCodeAt(0));
}

// ═════════════════════════════════════════════════════════════════════════════
// § 2  AES-128 (FIPS 197)
//
// Ручная реализация — потому что Web Crypto API не поддерживает ECB.
// Используется ТОЛЬКО для COFFEE (§5), которому ECB нужен для совместимости
// с существующими клиентами. VKify (§6) идёт через native AES-GCM.
// ═════════════════════════════════════════════════════════════════════════════

// S-box — FIPS 197 §5.1.1
export const AES_S = Uint8Array.from([
  0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
  0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
  0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
  0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
  0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
  0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
  0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
  0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
  0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
  0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
  0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
  0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
  0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
  0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
  0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
  0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]);

// Inverse S-box — FIPS 197 §5.3.2
export const AES_Si = Uint8Array.from([
  0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
  0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
  0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
  0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
  0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
  0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
  0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
  0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
  0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
  0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
  0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
  0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
  0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
  0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
  0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
  0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d,
]);

/** Round constants (FIPS 197 §5.2). Для AES-128 нужны первые 10. */
const _RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

/** GF(2^8) умножение на 2 (xtime). */
const _xt = (a: number): number => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;

/** GF(2^8) умножение произвольных байт: double-and-add. */
function _gmul(factor: number, b: number): number {
  let r = 0;
  let a = b;
  for (let f = factor; f > 0; f >>= 1) {
    if (f & 1) r ^= a;
    a = _xt(a);
  }
  return r;
}

/**
 * AES-128 key expansion (FIPS 197 §5.2).
 * 16 байт ключа → 176 байт (11 round keys × 16).
 * Финальный layout — column-major: rk[r*16 + row + col*4].
 */
export function aes128ExpandKey(key: Uint8Array): Uint8Array {
  // Стадия 1: генерируем 44 4-байтовых слова в линейном буфере.
  const w = new Uint8Array(176);
  w.set(key);
  for (let i = 4; i < 44; i++) {
    const p = (i - 1) * 4;
    let a = w[p], b = w[p+1], c = w[p+2], d = w[p+3];

    if (i % 4 === 0) {
      // RotWord + SubWord + XOR Rcon
      const t = a;
      a = AES_S[b] ^ _RCON[i / 4 - 1];
      b = AES_S[c];
      c = AES_S[d];
      d = AES_S[t];
    }

    const q = (i - 4) * 4;
    w[i*4    ] = w[q    ] ^ a;
    w[i*4 + 1] = w[q + 1] ^ b;
    w[i*4 + 2] = w[q + 2] ^ c;
    w[i*4 + 3] = w[q + 3] ^ d;
  }

  // Стадия 2: транспонируем в column-major (state-совместимый layout).
  const rk = new Uint8Array(176);
  for (let r = 0; r < 11; r++) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        rk[r*16 + row + col*4] = w[(r*4 + col) * 4 + row];
      }
    }
  }
  return rk;
}

/** Шифрует один 16-байтовый блок. Мутирует s. */
export function aes128EncBlock(s: Uint8Array, rk: Uint8Array): void {
  // AddRoundKey(0)
  for (let i = 0; i < 16; i++) s[i] ^= rk[i];

  let t: number;
  for (let round = 1; round <= 10; round++) {
    // SubBytes
    for (let i = 0; i < 16; i++) s[i] = AES_S[s[i]];

    // ShiftRows (row n сдвигается влево на n; state column-major)
    t = s[1];  s[1]  = s[5];  s[5]  = s[9];  s[9]  = s[13]; s[13] = t;
    t = s[2];  s[2]  = s[10]; s[10] = t;
    t = s[6];  s[6]  = s[14]; s[14] = t;
    t = s[15]; s[15] = s[11]; s[11] = s[7];  s[7]  = s[3];  s[3]  = t;

    // MixColumns (matrix [2,3,1,1; 1,2,3,1; 1,1,2,3; 3,1,1,2]) — кроме последнего раунда
    if (round < 10) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a = s[i], b = s[i+1], cc = s[i+2], d = s[i+3];
        s[i  ] = _xt(a)        ^ (_xt(b) ^ b)  ^ cc             ^ d;
        s[i+1] = a             ^ _xt(b)        ^ (_xt(cc) ^ cc) ^ d;
        s[i+2] = a             ^ b             ^ _xt(cc)        ^ (_xt(d) ^ d);
        s[i+3] = (_xt(a) ^ a)  ^ b             ^ cc             ^ _xt(d);
      }
    }

    // AddRoundKey
    for (let i = 0; i < 16; i++) s[i] ^= rk[round * 16 + i];
  }
}

/** Расшифровывает один 16-байтовый блок. Мутирует s. */
export function aes128DecBlock(s: Uint8Array, rk: Uint8Array): void {
  // AddRoundKey(10)
  for (let i = 0; i < 16; i++) s[i] ^= rk[160 + i];

  let t: number;
  for (let round = 9; round >= 0; round--) {
    // InvShiftRows
    t = s[13]; s[13] = s[9];  s[9]  = s[5];  s[5]  = s[1];  s[1]  = t;
    t = s[2];  s[2]  = s[10]; s[10] = t;
    t = s[6];  s[6]  = s[14]; s[14] = t;
    t = s[3];  s[3]  = s[7];  s[7]  = s[11]; s[11] = s[15]; s[15] = t;

    // InvSubBytes
    for (let i = 0; i < 16; i++) s[i] = AES_Si[s[i]];

    // AddRoundKey(round)
    for (let i = 0; i < 16; i++) s[i] ^= rk[round * 16 + i];

    // InvMixColumns (matrix [14,11,13,9; ...]) — кроме самого последнего шага
    if (round > 0) {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a = s[i], b = s[i+1], cc = s[i+2], d = s[i+3];
        s[i  ] = _gmul(14, a) ^ _gmul(11, b) ^ _gmul(13, cc) ^ _gmul(9,  d);
        s[i+1] = _gmul(9,  a) ^ _gmul(14, b) ^ _gmul(11, cc) ^ _gmul(13, d);
        s[i+2] = _gmul(13, a) ^ _gmul(9,  b) ^ _gmul(14, cc) ^ _gmul(11, d);
        s[i+3] = _gmul(11, a) ^ _gmul(13, b) ^ _gmul(9,  cc) ^ _gmul(14, d);
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// § 3  PKCS7 padding (RFC 5652 §6.3)
// ═════════════════════════════════════════════════════════════════════════════

export function pkcs7Pad(data: Uint8Array): Uint8Array {
  const pad = 16 - (data.length % 16);
  const out = new Uint8Array(data.length + pad);
  out.set(data);
  out.fill(pad, data.length);
  return out;
}

/** Возвращает unpadded slice или null если padding невалиден. */
export function pkcs7Unpad(data: Uint8Array): Uint8Array | null {
  if (!data.length || data.length % 16) return null;
  const pad = data[data.length - 1];
  if (pad < 1 || pad > 16) return null;
  for (let i = data.length - pad; i < data.length; i++) {
    if (data[i] !== pad) return null;
  }
  return data.slice(0, data.length - pad);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 4  AES-128-ECB high-level
// ═════════════════════════════════════════════════════════════════════════════

export function aes128EcbEncrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const rk     = aes128ExpandKey(key);
  const padded = pkcs7Pad(data);
  const out    = new Uint8Array(padded.length);
  for (let i = 0; i < padded.length; i += 16) {
    const blk = padded.slice(i, i + 16);
    aes128EncBlock(blk, rk);
    out.set(blk, i);
  }
  return out;
}

export function aes128EcbDecrypt(data: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (!data.length || data.length % 16) return null;
  const rk  = aes128ExpandKey(key);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 16) {
    const blk = data.slice(i, i + 16);
    aes128DecBlock(blk, rk);
    out.set(blk, i);
  }
  return pkcs7Unpad(out);
}

// ═════════════════════════════════════════════════════════════════════════════
// § 5  COFFEE — Kate Mobile / VK Coffee / Laney / Vika
//
// Формат, сложившийся в неофициальных клиентах ВК:
//   1. AES-128-ECB + PKCS7      шифруют plaintext
//   2. base64 (стандартный, с=) кодирует шифротекст
//   3. hex (UPPER, пробелы)     кодирует ASCII-байты base64-строки
//   4. Обрамление маркером:     PP (Kate Mobile) / VK COFFEE / AP IDOG (Laney) / II (Vika)
//
// Шаг 3 нужен, чтобы внутри сообщения остались только цифры и буквы A–F —
// иначе ВК ломает форматирование.
//
// Безопасность: ECB не скрывает повторяющиеся блоки и не имеет MAC.
// Формат сохранён ИСКЛЮЧИТЕЛЬНО для cross-client совместимости.
// ═════════════════════════════════════════════════════════════════════════════

/** Публичный ключ протокола (16 байт). Общеизвестная константа. */
export const COFFEE_KEY = _te.encode('stupidUsersMustD');

/** Регулярка детектирования COFFEE-сообщения. Group 1 — внутренний hex. */
export const COFFEE_RE =
  /^(?:PP|VK\s*C[O0]\s*FF\s*EE|AP\s*ID\s*OG|II)\s+([A-Fa-f0-9 \t]+?)\s+(?:PP|VK\s*C[O0]\s*FF\s*EE|AP\s*ID\s*OG|II)$/;

/** Поддерживаемые маркеры для исходящих COFFEE-сообщений (разные клиенты). */
export type CoffeeMarker = 'PP' | 'VK COFFEE' | 'II' | 'AP IDOG';

/**
 * Строка маркера, которой реально оборачивается шифротекст.
 *
 * Для 'VK COFFEE' используем обфусцированную форму `VK CO FF EE` — именно так
 * её эмитит реальный клиент VK Coffee, чтобы ВК не ломал форматирование.
 * Все четыре варианта детектируются [[COFFEE_RE]] на расшифровке.
 */
const COFFEE_MARKER_EMIT: Readonly<Record<CoffeeMarker, string>> = {
  'PP':        'PP',
  'VK COFFEE': 'VK CO FF EE',
  'II':        'II',
  'AP IDOG':   'AP IDOG',
};

/**
 * Деривация ключа из пользовательского пароля:
 *   AES-128-ECB(password + "mailRuMustDie", COFFEE_KEY) → base64 → ASCII[0..15]
 */
export function coffeeDeriveKey(userKey: string): Uint8Array {
  const ct  = aes128EcbEncrypt(_te.encode(userKey + 'mailRuMustDie'), COFFEE_KEY);
  const b64 = _bytesToB64(ct);
  return _te.encode(b64.slice(0, 16));
}

/**
 * Шифрует текст в COFFEE: `<MARKER> <HEX> <MARKER>`.
 * Маркер по умолчанию — `PP` (Kate Mobile), byte-exact совместим со всеми
 * остальными клиентами.
 */
export function coffeeEncrypt(text: string, userKey?: string, marker: CoffeeMarker = 'PP'): string {
  const key    = userKey ? coffeeDeriveKey(userKey) : COFFEE_KEY;
  const cipher = aes128EcbEncrypt(_te.encode(text), key);
  const b64    = _bytesToB64(cipher);
  const m      = COFFEE_MARKER_EMIT[marker];
  return `${m} ${bytesToHex(_te.encode(b64))} ${m}`;
}

/** Расшифровывает COFFEE или возвращает null. */
export function coffeeTryDecrypt(text: string, userKey?: string): string | null {
  const m = text.trim().match(COFFEE_RE);
  if (!m) return null;

  // hex → ASCII-байты base64-строки → байты шифротекста
  const ascii = hexToBytes(m[1]);
  if (!ascii.length) return null;

  let b64: string;
  try { b64 = _td.decode(ascii); } catch { return null; }

  const cipher = _b64ToBytes(b64);
  if (!cipher || !cipher.length || cipher.length % 16) return null;

  const key   = userKey ? coffeeDeriveKey(userKey) : COFFEE_KEY;
  const plain = aes128EcbDecrypt(cipher, key);
  if (!plain) return null;

  try { return _td.decode(plain); }
  catch { return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// § 6  VKify E2E v2 — AES-256-GCM + PBKDF2-SHA-256 (Web Crypto API)
//
// Современная схема:
//   • PBKDF2-SHA-256, 600 000 итераций (OWASP 2024)
//   • AES-256-GCM, 96-битный случайный nonce
//   • Формат:  🔐 base64url([ver:1][nonce:12][ct+tag:N+16]) 🔐
//
// Trade-off: фиксированный salt — у ВК нет канала для обмена per-user salt
// перед шифрованием. Безопасность каждого отдельного сообщения обеспечивает
// случайный nonce + 128-битный GCM-тег.
// ═════════════════════════════════════════════════════════════════════════════

export const VKIFY_MARKER     = '🔐';
export const VKIFY_MARKER_LEN = VKIFY_MARKER.length; // 2 (UTF-16 суррогатная пара)
export const VKIFY_VERSION    = 1;
export const VKIFY_PBKDF2_IT  = 600_000;

const _VKIFY_SALT = _te.encode('VKify-E2E-v2-salt');

/** Кэш производных ключей — PBKDF2 c 600k итерациями слишком дорог для каждого сообщения. */
const _keyCache = new Map<string, CryptoKey>();

async function _deriveKey(password: string): Promise<CryptoKey> {
  const cached = _keyCache.get(password);
  if (cached) return cached;

  const material = await crypto.subtle.importKey(
    'raw', _te.encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: _VKIFY_SALT, iterations: VKIFY_PBKDF2_IT, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

  _keyCache.set(password, key);
  return key;
}

/** Шифрует текст в формате VKify E2E v2. */
export async function vkifyEncrypt(plaintext: string, password: string): Promise<string> {
  const key    = await _deriveKey(password);
  const nonce  = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, _te.encode(plaintext)),
  );

  const packed = new Uint8Array(1 + 12 + cipher.length);
  packed[0] = VKIFY_VERSION;
  packed.set(nonce, 1);
  packed.set(cipher, 13);

  return VKIFY_MARKER + toBase64url(packed) + VKIFY_MARKER;
}

/** Расшифровывает VKify E2E v2 или возвращает null. */
export async function vkifyTryDecrypt(text: string, password: string): Promise<string | null> {
  if (!text.startsWith(VKIFY_MARKER) || !text.endsWith(VKIFY_MARKER)) return null;
  if (text.length <= VKIFY_MARKER_LEN * 2) return null;

  try {
    const packed = fromBase64url(text.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN));
    // 1 ver + 12 nonce + минимум 16 GCM tag = 29 байт
    if (packed.length < 29)             return null;
    if (packed[0]    !== VKIFY_VERSION) return null;

    const key   = await _deriveKey(password);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(1, 13) },
      key,
      packed.slice(13),
    );
    return _td.decode(plain);
  } catch {
    return null;
  }
}