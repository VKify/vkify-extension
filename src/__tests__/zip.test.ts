import { describe, it, expect } from 'vitest';
import { crc32, buildZip } from '../shared/utils/zip.js';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

async function bytesOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

describe('crc32', () => {
  it('matches the standard IEEE check value for "123456789"', () => {
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
  });

  it('is 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('buildZip', () => {
  it('produces a STORE archive with correct signatures and entry count', async () => {
    const blob = buildZip([
      { name: 'a.txt', data: 'hi' },
      { name: 'dir/b.bin', data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(blob.type).toBe('application/zip');

    const dv = await bytesOf(blob);

    // Первый локальный заголовок.
    expect(dv.getUint32(0, true)).toBe(0x04034b50);

    // End-of-central-directory — последние 22 байта (без комментария).
    const eocd = dv.byteLength - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 8, true)).toBe(2);  // записей на диске
    expect(dv.getUint16(eocd + 10, true)).toBe(2); // всего записей
  });

  it('stores the CRC of the data in the local header', async () => {
    const data = enc('hello world');
    const dv = await bytesOf(buildZip([{ name: 'x', data }]));
    // CRC находится по смещению 14 в локальном заголовке.
    expect(dv.getUint32(14, true)).toBe(crc32(data));
    // STORE: compressed == uncompressed size.
    expect(dv.getUint32(18, true)).toBe(data.length);
    expect(dv.getUint32(22, true)).toBe(data.length);
  });

  it('encodes UTF-8 names and sets the UTF-8 flag', async () => {
    const dv = await bytesOf(buildZip([{ name: 'файл.txt', data: 'x' }]));
    // GP-flag bit 0x0800 (UTF-8) по смещению 6.
    expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800);
    const nameLen = dv.getUint16(26, true);
    expect(nameLen).toBe(new TextEncoder().encode('файл.txt').length); // > 8 байт из-за кириллицы
  });
});
