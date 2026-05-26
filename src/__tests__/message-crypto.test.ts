/**
 * Тесты криптографического ядра message-crypto-core.ts
 *
 *   § 1  AES-128 block cipher       — NIST FIPS 197 / SP 800-38A test vectors
 *   § 2  PKCS7 padding              — корректность + edge cases
 *   § 3  AES-128-ECB                — roundtrip и невалидный ввод
 *   § 4  Кодирование                — hex, base64url
 *   § 5  COFFEE protocol            — формат, known-answer (Kate Mobile), маркеры
 *   § 6  VKify E2E v2               — формат, integrity, версия, параллелизм
 *   § 7  Cross-format compatibility — изоляция форматов
 */

import { describe, it, expect } from 'vitest';
import {
  // AES-128 internals
  aes128ExpandKey,
  aes128EncBlock,
  aes128DecBlock,
  aes128EcbEncrypt,
  aes128EcbDecrypt,
  // Padding
  pkcs7Pad,
  pkcs7Unpad,
  // Encoding
  hexToBytes,
  bytesToHex,
  toBase64url,
  fromBase64url,
  // COFFEE
  COFFEE_KEY,
  COFFEE_RE,
  coffeeDeriveKey,
  coffeeEncrypt,
  coffeeTryDecrypt,
  // VKify E2E v2
  VKIFY_MARKER,
  VKIFY_MARKER_LEN,
  VKIFY_VERSION,
  VKIFY_PBKDF2_IT,
  vkifyEncrypt,
  vkifyTryDecrypt,
} from '../content/features/privacy/message-crypto-core.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

/** hex без пробелов → bytes */
const h = (hex: string): Uint8Array => hexToBytes(hex.replace(/\s/g, ''));

// ═════════════════════════════════════════════════════════════════════════════
// § 1  AES-128 — NIST FIPS 197 / SP 800-38A
// ═════════════════════════════════════════════════════════════════════════════

describe('AES-128 block cipher (FIPS 197)', () => {
  /**
   * FIPS 197 Appendix C.1 — Known Answer Test.
   * Key:        000102030405060708090a0b0c0d0e0f
   * Plaintext:  00112233445566778899aabbccddeeff
   * Ciphertext: 69c4e0d86a7b0430d8cdb78070b4c55a
   */
  it('FIPS 197 C.1 — enc(KAT)', () => {
    const rk = aes128ExpandKey(h('000102030405060708090a0b0c0d0e0f'));
    const s  = h('00112233445566778899aabbccddeeff');
    aes128EncBlock(s, rk);
    expect(Array.from(s)).toEqual(Array.from(h('69c4e0d86a7b0430d8cdb78070b4c55a')));
  });

  it('FIPS 197 C.1 — dec(KAT)', () => {
    const rk = aes128ExpandKey(h('000102030405060708090a0b0c0d0e0f'));
    const s  = h('69c4e0d86a7b0430d8cdb78070b4c55a');
    aes128DecBlock(s, rk);
    expect(Array.from(s)).toEqual(Array.from(h('00112233445566778899aabbccddeeff')));
  });

  /**
   * FIPS 197 Appendix B — round-by-round example.
   * Key:  2b7e151628aed2a6abf7158809cf4f3c
   * PT:   3243f6a8885a308d313198a2e0370734
   * CT:   3925841d02dc09fbdc118597196a0b32
   */
  it('FIPS 197 B — enc', () => {
    const rk = aes128ExpandKey(h('2b7e151628aed2a6abf7158809cf4f3c'));
    const s  = h('3243f6a8885a308d313198a2e0370734');
    aes128EncBlock(s, rk);
    expect(Array.from(s)).toEqual(Array.from(h('3925841d02dc09fbdc118597196a0b32')));
  });

  it('FIPS 197 B — dec', () => {
    const rk = aes128ExpandKey(h('2b7e151628aed2a6abf7158809cf4f3c'));
    const s  = h('3925841d02dc09fbdc118597196a0b32');
    aes128DecBlock(s, rk);
    expect(Array.from(s)).toEqual(Array.from(h('3243f6a8885a308d313198a2e0370734')));
  });

  /**
   * NIST SP 800-38A F.1.1 — AES-128-ECB.
   * PT:  6bc1bee22e409f96e93d7e117393172a
   * CT:  3ad77bb40d7a3660a89ecaf32466ef97
   */
  it('NIST SP 800-38A F.1.1 — enc', () => {
    const rk = aes128ExpandKey(h('2b7e151628aed2a6abf7158809cf4f3c'));
    const s  = h('6bc1bee22e409f96e93d7e117393172a');
    aes128EncBlock(s, rk);
    expect(Array.from(s)).toEqual(Array.from(h('3ad77bb40d7a3660a89ecaf32466ef97')));
  });

  it('нулевой блок: dec(enc(0)) === 0', () => {
    const rk  = aes128ExpandKey(h('000102030405060708090a0b0c0d0e0f'));
    const pt  = new Uint8Array(16);
    const e   = pt.slice(); aes128EncBlock(e, rk);
    const d   = e.slice();  aes128DecBlock(d, rk);
    expect(Array.from(d)).toEqual(Array.from(pt));
  });

  it('enc(x) ≠ x', () => {
    const rk  = aes128ExpandKey(h('000102030405060708090a0b0c0d0e0f'));
    const s   = h('00112233445566778899aabbccddeeff');
    const cp  = s.slice(); aes128EncBlock(cp, rk);
    expect(Array.from(cp)).not.toEqual(Array.from(s));
  });

  it('разные ключи → разный шифротекст', () => {
    const pt  = h('00112233445566778899aabbccddeeff');
    const rk1 = aes128ExpandKey(h('000102030405060708090a0b0c0d0e0f'));
    const rk2 = aes128ExpandKey(h('101112131415161718191a1b1c1d1e1f'));
    const b1  = pt.slice(); aes128EncBlock(b1, rk1);
    const b2  = pt.slice(); aes128EncBlock(b2, rk2);
    expect(Array.from(b1)).not.toEqual(Array.from(b2));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 2  PKCS7 padding
// ═════════════════════════════════════════════════════════════════════════════

describe('PKCS7 padding', () => {
  it('добавляет N байт до кратности 16', () => {
    const padded = pkcs7Pad(enc.encode('hello')); // 5 → +11
    expect(padded.length).toBe(16);
    expect(padded[5]).toBe(11);
    expect(padded[15]).toBe(11);
  });

  it('добавляет полный блок когда длина уже кратна 16', () => {
    const padded = pkcs7Pad(new Uint8Array(16));
    expect(padded.length).toBe(32);
    expect(padded[16]).toBe(16);
    expect(padded[31]).toBe(16);
  });

  it('добавляет 1 байт когда длина ≡ 15 (mod 16)', () => {
    const padded = pkcs7Pad(new Uint8Array(15));
    expect(padded.length).toBe(16);
    expect(padded[15]).toBe(1);
  });

  it('roundtrip: unpad(pad(x)) === x', () => {
    for (const len of [0, 1, 7, 15, 16, 17, 31, 32, 100]) {
      const data = crypto.getRandomValues(new Uint8Array(len));
      expect(Array.from(pkcs7Unpad(pkcs7Pad(data))!)).toEqual(Array.from(data));
    }
  });

  it('unpad: null для пустого массива', () => {
    expect(pkcs7Unpad(new Uint8Array(0))).toBeNull();
  });

  it('unpad: null если длина не кратна 16', () => {
    expect(pkcs7Unpad(new Uint8Array(15))).toBeNull();
    expect(pkcs7Unpad(new Uint8Array(17))).toBeNull();
  });

  it('unpad: null при pad=0', () => {
    expect(pkcs7Unpad(new Uint8Array(16))).toBeNull();
  });

  it('unpad: null при pad>16', () => {
    expect(pkcs7Unpad(new Uint8Array(16).fill(17))).toBeNull();
  });

  it('unpad: null при несоответствующих pad-байтах', () => {
    const data = new Uint8Array(16);
    data[15] = 3; data[14] = 3; data[13] = 2; // последний должен быть 3
    expect(pkcs7Unpad(data)).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 3  AES-128-ECB (high-level)
// ═════════════════════════════════════════════════════════════════════════════

describe('AES-128-ECB', () => {
  const KEY = h('000102030405060708090a0b0c0d0e0f');

  const cases: ReadonlyArray<readonly [string, string]> = [
    ['короткий текст (5 байт)',  'hello'],
    ['ровно 16 байт',            '0123456789abcdef'],
    ['17 байт (два блока)',      '0123456789abcdefg'],
    ['256 байт',                 'A'.repeat(256)],
    ['пустая строка',            ''],
    ['кириллица + emoji',        'Привет мир 🌍'],
  ];

  for (const [name, text] of cases) {
    it(`roundtrip: ${name}`, () => {
      const ct = aes128EcbEncrypt(enc.encode(text), KEY);
      expect(dec.decode(aes128EcbDecrypt(ct, KEY)!)).toBe(text);
    });
  }

  it('выход всегда кратен 16', () => {
    for (const len of [1, 5, 16, 17, 32]) {
      expect(aes128EcbEncrypt(enc.encode('x'.repeat(len)), KEY).length % 16).toBe(0);
    }
  });

  it('decrypt: null для пустого ввода', () => {
    expect(aes128EcbDecrypt(new Uint8Array(0), KEY)).toBeNull();
  });

  it('decrypt: null если длина не кратна 16', () => {
    expect(aes128EcbDecrypt(new Uint8Array(15), KEY)).toBeNull();
  });

  it('decrypt с неверным ключом не даёт исходного текста', () => {
    const ct       = aes128EcbEncrypt(enc.encode('test'), KEY);
    const wrongKey = h('ffffffffffffffffffffffffffffffff');
    const result   = aes128EcbDecrypt(ct, wrongKey);
    if (result !== null) {
      expect(dec.decode(result)).not.toBe('test');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 4  Кодирование
// ═════════════════════════════════════════════════════════════════════════════

describe('hexToBytes / bytesToHex', () => {
  it('bytesToHex: uppercase, разделитель — пробел', () => {
    expect(bytesToHex(Uint8Array.from([0x00, 0xff, 0xab]))).toBe('00 FF AB');
  });

  it('hexToBytes принимает строку с пробелами', () => {
    expect(Array.from(hexToBytes('00 FF AB'))).toEqual([0x00, 0xff, 0xab]);
  });

  it('hexToBytes принимает строку без пробелов', () => {
    expect(Array.from(hexToBytes('00FFAB'))).toEqual([0x00, 0xff, 0xab]);
  });

  it('roundtrip hex → bytes → hex', () => {
    const orig = '3A D7 7B B4 0D 7A 36 60 A8 9E CA F3 24 66 EF 97';
    expect(bytesToHex(hexToBytes(orig))).toBe(orig);
  });

  it('roundtrip bytes → hex → bytes', () => {
    const data = crypto.getRandomValues(new Uint8Array(32));
    expect(Array.from(hexToBytes(bytesToHex(data)))).toEqual(Array.from(data));
  });
});

describe('toBase64url / fromBase64url', () => {
  it('не содержит символов +, /, =', () => {
    const b64 = toBase64url(crypto.getRandomValues(new Uint8Array(64)));
    expect(b64).not.toMatch(/[+/=]/);
  });

  it('заменяет + на - и / на _', () => {
    const known = toBase64url(Uint8Array.from([0xfb, 0xff, 0xff]));
    expect(known).toMatch(/[-_]/);
    expect(known).not.toMatch(/[+/]/);
  });

  it('roundtrip bytes ↔ base64url', () => {
    for (const len of [0, 1, 2, 3, 16, 64, 127]) {
      const buf = crypto.getRandomValues(new Uint8Array(len));
      expect(Array.from(fromBase64url(toBase64url(buf)))).toEqual(Array.from(buf));
    }
  });

  it('fromBase64url принимает строку с padding "="', () => {
    // 1 байт → "AQ==" — реально с двойным padding.
    const std = btoa(String.fromCharCode(0x01));
    expect(std).toContain('=');
    expect(Array.from(fromBase64url(std))).toEqual([0x01]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 5  COFFEE — Kate Mobile / Laney / Vika
// ═════════════════════════════════════════════════════════════════════════════

describe('COFFEE — константы и маркеры', () => {
  it('COFFEE_KEY = "stupidUsersMustD" (16 байт)', () => {
    expect(COFFEE_KEY.length).toBe(16);
    expect(dec.decode(COFFEE_KEY)).toBe('stupidUsersMustD');
  });

  const markers = [
    ['PP',        'PP AB CD EF PP'],
    ['II',        'II AB CD EF II'],
    ['VK COFFEE', 'VK COFFEE AB CD EF VK COFFEE'],
    ['VK C0FF EE (обфусцированный)', 'VK C0FF EE AB CD EF VK C0FF EE'],
    ['AP IDOG',   'AP IDOG AB CD EF AP IDOG'],
  ] as const;

  for (const [name, sample] of markers) {
    it(`COFFEE_RE детектирует маркер ${name}`, () => {
      expect(COFFEE_RE.test(sample)).toBe(true);
    });
  }

  it('COFFEE_RE отвергает обычный текст / пустоту', () => {
    expect(COFFEE_RE.test('Hello world')).toBe(false);
    expect(COFFEE_RE.test('PP')).toBe(false);
    expect(COFFEE_RE.test('')).toBe(false);
  });
});

describe('COFFEE — known-answer векторы (cross-client compat)', () => {
  /**
   * Реальное сообщение из ВКонтакте, зашифрованное клиентом Kate Mobile.
   * Доказывает совместимость с настоящим протоколом, а не только roundtrip.
   *
   *   Plaintext:  "К чему?"
   *   Ciphertext (base64): bO8oBJZr1zAtbMJCbe26XA==
   */
  const PLAIN = 'К чему?';
  const HEX   = '62 4F 38 6F 42 4A 5A 72 31 7A 41 74 62 4D 4A 43 62 65 32 36 58 41 3D 3D';

  it('decrypt с маркером VK COFFEE', () => {
    expect(coffeeTryDecrypt(`VK COFFEE ${HEX} VK COFFEE`)).toBe(PLAIN);
  });

  it('decrypt с маркером PP', () => {
    expect(coffeeTryDecrypt(`PP ${HEX} PP`)).toBe(PLAIN);
  });

  it('decrypt с маркером II', () => {
    expect(coffeeTryDecrypt(`II ${HEX} II`)).toBe(PLAIN);
  });

  it('decrypt с маркером AP IDOG', () => {
    expect(coffeeTryDecrypt(`AP IDOG ${HEX} AP IDOG`)).toBe(PLAIN);
  });

  it('byte-exact: coffeeEncrypt совпадает с шифротекстом Kate Mobile', () => {
    expect(coffeeEncrypt(PLAIN)).toBe(`PP ${HEX} PP`);
  });
});

describe('COFFEE — формат вывода', () => {
  it('coffeeEncrypt → "PP <HEX> PP"', () => {
    expect(coffeeEncrypt('hello')).toMatch(/^PP [A-F0-9 ]+ PP$/);
  });

  it('hex выводится в верхнем регистре', () => {
    const inner = coffeeEncrypt('test').slice(3, -3);
    expect(inner).toMatch(/^[A-F0-9 ]+$/);
  });

  it('внутренний hex декодируется как ASCII base64', () => {
    const inner = coffeeEncrypt('test').slice(3, -3).trim();
    const ascii = dec.decode(hexToBytes(inner));
    expect(ascii).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe('COFFEE — настраиваемый маркер исходящих', () => {
  /** Шифротекст между маркерами одинаков для любого выбора маркера. */
  it('шифротекст идентичен независимо от маркера', () => {
    const strip = (msg: string, markerLen: number): string =>
      msg.slice(markerLen, msg.length - markerLen).trim();

    const pp       = coffeeEncrypt('hello', undefined, 'PP');
    const vkCoffee = coffeeEncrypt('hello', undefined, 'VK COFFEE');
    const ii       = coffeeEncrypt('hello', undefined, 'II');
    const apIdog   = coffeeEncrypt('hello', undefined, 'AP IDOG');

    expect(strip(pp, 2)).toBe(strip(ii,        2));
    expect(strip(pp, 2)).toBe(strip(vkCoffee, 11));
    expect(strip(pp, 2)).toBe(strip(apIdog,    7));
  });

  it('маркер PP по умолчанию', () => {
    expect(coffeeEncrypt('test')).toMatch(/^PP [A-F0-9 ]+ PP$/);
  });

  it('маркер VK CO FF EE (обфусцированный VK COFFEE)', () => {
    expect(coffeeEncrypt('test', undefined, 'VK COFFEE')).toMatch(/^VK CO FF EE [A-F0-9 ]+ VK CO FF EE$/);
  });

  it('маркер II', () => {
    expect(coffeeEncrypt('test', undefined, 'II')).toMatch(/^II [A-F0-9 ]+ II$/);
  });

  it('маркер AP IDOG', () => {
    expect(coffeeEncrypt('test', undefined, 'AP IDOG')).toMatch(/^AP IDOG [A-F0-9 ]+ AP IDOG$/);
  });

  it('все четыре маркера расшифровываются', () => {
    for (const marker of ['PP', 'VK COFFEE', 'II', 'AP IDOG'] as const) {
      expect(coffeeTryDecrypt(coffeeEncrypt('roundtrip', undefined, marker))).toBe('roundtrip');
    }
  });

  it('маркер VK COFFEE даёт известный шифротекст Kate Mobile (byte-exact)', () => {
    // То же самое сообщение "К чему?" из known-answer теста, но в обёртке VK Coffee.
    const HEX = '62 4F 38 6F 42 4A 5A 72 31 7A 41 74 62 4D 4A 43 62 65 32 36 58 41 3D 3D';
    expect(coffeeEncrypt('К чему?', undefined, 'VK COFFEE')).toBe(`VK CO FF EE ${HEX} VK CO FF EE`);
  });
});

describe('COFFEE — roundtrip и edge cases', () => {
  it('дефолтный ключ — разные виды текста', () => {
    for (const text of ['hello', 'Привет мир!', '🔐🔑', 'a'.repeat(100), '']) {
      expect(coffeeTryDecrypt(coffeeEncrypt(text))).toBe(text);
    }
  });

  it('пользовательский ключ', () => {
    const key  = 'mySecretKey123';
    const text = 'Секретное сообщение';
    expect(coffeeTryDecrypt(coffeeEncrypt(text, key), key)).toBe(text);
  });

  it('пользовательский ключ ≠ дефолтный (decrypt без ключа не работает)', () => {
    const cipher = coffeeEncrypt('secret', 'userKey');
    expect(coffeeTryDecrypt(cipher)).not.toBe('secret');
  });

  it('маркер при encrypt — PP, при decrypt — любой из четырёх', () => {
    const cipher = coffeeEncrypt('test');
    const withII = cipher.replace(/^PP/, 'II').replace(/PP$/, 'II');
    expect(coffeeTryDecrypt(withII)).toBe('test');
  });

  it('многострочный текст', () => {
    const text = 'Строка 1\nСтрока 2\nСтрока 3';
    expect(coffeeTryDecrypt(coffeeEncrypt(text))).toBe(text);
  });

  it('null: пустая строка', () => {
    expect(coffeeTryDecrypt('')).toBeNull();
  });

  it('null: обычный текст', () => {
    expect(coffeeTryDecrypt('Hello, world!')).toBeNull();
  });

  it('null: невалидное содержимое внутри маркеров (не base64)', () => {
    expect(coffeeTryDecrypt('PP AB CD PP')).toBeNull();
  });

  it('null: неизвестный маркер', () => {
    const inner = coffeeEncrypt('test').slice(3, -3);
    expect(coffeeTryDecrypt(`XX ${inner} XX`)).toBeNull();
  });

  it('пробелы по краям не ломают детектирование (trim)', () => {
    expect(coffeeTryDecrypt(`  ${coffeeEncrypt('test')}  `)).toBe('test');
  });
});

describe('COFFEE — деривация пользовательского ключа', () => {
  it('возвращает 16 байт', () => {
    expect(coffeeDeriveKey('password').length).toBe(16);
  });

  it('детерминирована', () => {
    expect(Array.from(coffeeDeriveKey('myPass')))
      .toEqual(Array.from(coffeeDeriveKey('myPass')));
  });

  it('разные пароли → разные ключи', () => {
    expect(Array.from(coffeeDeriveKey('pass1')))
      .not.toEqual(Array.from(coffeeDeriveKey('pass2')));
  });

  it('отличается от дефолтного COFFEE_KEY', () => {
    expect(Array.from(coffeeDeriveKey('any')))
      .not.toEqual(Array.from(COFFEE_KEY));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 6  VKify E2E v2 — AES-256-GCM + PBKDF2-SHA-256
// ═════════════════════════════════════════════════════════════════════════════

describe('VKify E2E v2 — константы', () => {
  it('VKIFY_MARKER = 🔐', () => {
    expect(VKIFY_MARKER).toBe('🔐');
  });

  it('VKIFY_MARKER_LEN = 2 (UTF-16 суррогатная пара)', () => {
    expect(VKIFY_MARKER_LEN).toBe(2);
    expect(VKIFY_MARKER.length).toBe(2);
  });

  it('VKIFY_VERSION = 1', () => {
    expect(VKIFY_VERSION).toBe(1);
  });

  it('PBKDF2 итераций ≥ 600 000 (OWASP 2024)', () => {
    expect(VKIFY_PBKDF2_IT).toBeGreaterThanOrEqual(600_000);
  });
});

describe('VKify E2E v2 — формат шифротекста', () => {
  it('начинается и заканчивается маркером 🔐', async () => {
    const ct = await vkifyEncrypt('test', 'password');
    expect(ct.startsWith(VKIFY_MARKER)).toBe(true);
    expect(ct.endsWith(VKIFY_MARKER)).toBe(true);
  });

  it('между маркерами — base64url без +/=', async () => {
    const ct  = await vkifyEncrypt('test', 'password');
    const b64 = ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN);
    expect(b64).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('первый байт payload = version (1)', async () => {
    const ct     = await vkifyEncrypt('test', 'password');
    const packed = fromBase64url(ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN));
    expect(packed[0]).toBe(VKIFY_VERSION);
  });

  it('payload минимум 29 байт (1 ver + 12 nonce + 16 tag)', async () => {
    const ct     = await vkifyEncrypt('x', 'password');
    const packed = fromBase64url(ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN));
    expect(packed.length).toBeGreaterThanOrEqual(30); // 1 байт payload + 16 tag для 'x'
  });
});

describe('VKify E2E v2 — шифрование и расшифровка', () => {
  it('roundtrip: базовый', async () => {
    const text = 'Привет, мир!';
    expect(await vkifyTryDecrypt(await vkifyEncrypt(text, 'secret'), 'secret')).toBe(text);
  });

  it('roundtrip: пустая строка', async () => {
    expect(await vkifyTryDecrypt(await vkifyEncrypt('', 'p'), 'p')).toBe('');
  });

  it('roundtrip: emoji, спецсимволы, HTML', async () => {
    const text = '🔐🌍⚡ <script>alert(1)</script> "кавычки"';
    expect(await vkifyTryDecrypt(await vkifyEncrypt(text, 'p'), 'p')).toBe(text);
  });

  it('roundtrip: многострочный', async () => {
    const text = 'Строка 1\nСтрока 2\nСтрока 3';
    expect(await vkifyTryDecrypt(await vkifyEncrypt(text, 'p'), 'p')).toBe(text);
  });

  it('roundtrip: 1000 символов', async () => {
    const text = 'A'.repeat(500) + 'Я'.repeat(250);
    expect(await vkifyTryDecrypt(await vkifyEncrypt(text, 'longpass'), 'longpass')).toBe(text);
  });

  it('null: неверный пароль', async () => {
    const ct = await vkifyEncrypt('secret', 'correct');
    expect(await vkifyTryDecrypt(ct, 'wrong')).toBeNull();
  });

  it('null: пустой пароль ≠ настоящий', async () => {
    const ct = await vkifyEncrypt('secret', 'password');
    expect(await vkifyTryDecrypt(ct, '')).toBeNull();
  });

  it('null: обычный текст без маркера', async () => {
    expect(await vkifyTryDecrypt('Hello, world!', 'pass')).toBeNull();
  });

  it('null: только маркеры без payload', async () => {
    expect(await vkifyTryDecrypt('🔐🔐', 'pass')).toBeNull();
  });

  it('null: обрезанный base64', async () => {
    const ct  = await vkifyEncrypt('test', 'pass');
    const bad = VKIFY_MARKER + ct.slice(VKIFY_MARKER_LEN, VKIFY_MARKER_LEN + 4) + VKIFY_MARKER;
    expect(await vkifyTryDecrypt(bad, 'pass')).toBeNull();
  });

  it('null: модифицированный шифротекст (GCM integrity)', async () => {
    const ct       = await vkifyEncrypt('test', 'pass');
    const packed   = fromBase64url(ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN));
    packed[20]    ^= 0xff; // бит-флип в шифротексте
    const tampered = VKIFY_MARKER + toBase64url(packed) + VKIFY_MARKER;
    expect(await vkifyTryDecrypt(tampered, 'pass')).toBeNull();
  });

  it('null: неизвестный version byte', async () => {
    const ct      = await vkifyEncrypt('test', 'pass');
    const packed  = fromBase64url(ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN));
    packed[0]     = 0xff;
    const bad     = VKIFY_MARKER + toBase64url(packed) + VKIFY_MARKER;
    expect(await vkifyTryDecrypt(bad, 'pass')).toBeNull();
  });

  it('null: COFFEE-сообщение не распознаётся как VKify', async () => {
    expect(await vkifyTryDecrypt(coffeeEncrypt('test'), 'pass')).toBeNull();
  });
});

describe('VKify E2E v2 — уникальность и параллелизм', () => {
  it('каждое шифрование уникально (случайный nonce)', async () => {
    const [a, b] = await Promise.all([
      vkifyEncrypt('same', 'pass'),
      vkifyEncrypt('same', 'pass'),
    ]);
    expect(a).not.toBe(b);
  });

  it('10 шифрований → 10 уникальных nonce', async () => {
    const extractNonce = (ct: string): string =>
      Array.from(fromBase64url(ct.slice(VKIFY_MARKER_LEN, -VKIFY_MARKER_LEN)).slice(1, 13)).join(',');

    const nonces = await Promise.all(
      Array.from({ length: 10 }, () => vkifyEncrypt('x', 'p').then(extractNonce)),
    );
    expect(new Set(nonces).size).toBe(10);
  });

  it('20 параллельных шифрований — все расшифровываются', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => `Сообщение ${i}`);
    const ciphers  = await Promise.all(messages.map(m => vkifyEncrypt(m, 'parallel')));
    const plains   = await Promise.all(ciphers.map(ct => vkifyTryDecrypt(ct, 'parallel')));
    expect(plains).toEqual(messages);
  });

  it('кэш ключей: разные пароли — независимые CryptoKey', async () => {
    const a = await vkifyEncrypt('test', 'p1');
    const b = await vkifyEncrypt('test', 'p2');
    expect(await vkifyTryDecrypt(a, 'p2')).toBeNull();
    expect(await vkifyTryDecrypt(b, 'p1')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// § 7  Cross-format compatibility
// ═════════════════════════════════════════════════════════════════════════════

describe('Cross-format isolation', () => {
  it('VKify-маркер не распознаётся как COFFEE', () => {
    expect(coffeeTryDecrypt('🔐somedata🔐')).toBeNull();
  });

  it('COFFEE-маркер не распознаётся как VKify', async () => {
    expect(await vkifyTryDecrypt(coffeeEncrypt('hello'), 'pass')).toBeNull();
  });

  it('обычный текст не распознаётся ни как COFFEE, ни как VKify', async () => {
    const text = 'Обычное сообщение без шифрования';
    expect(coffeeTryDecrypt(text)).toBeNull();
    expect(await vkifyTryDecrypt(text, 'pass')).toBeNull();
  });
});