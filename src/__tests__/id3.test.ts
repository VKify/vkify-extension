import { describe, it, expect } from 'vitest';
import { buildId3Tag } from '../content/features/media/id3.js';

const latin1 = (bytes: Uint8Array, start: number, len: number): string =>
  String.fromCharCode(...bytes.subarray(start, start + len));

/** Декодирует synchsafe-размер заголовка ID3v2 (4×7 бит). */
function synchsafe(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 21) | (bytes[at + 1] << 14) | (bytes[at + 2] << 7) | bytes[at + 3];
}

/** Разбирает фреймы ID3v2.3 начиная с offset 10. */
function readFrames(bytes: Uint8Array): Map<string, { size: number; bodyStart: number }> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = new Map<string, { size: number; bodyStart: number }>();
  let i = 10;
  while (i + 10 <= bytes.length) {
    const id = latin1(bytes, i, 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = dv.getUint32(i + 4, false); // big-endian (v2.3)
    frames.set(id, { size, bodyStart: i + 10 });
    i += 10 + size;
  }
  return frames;
}

describe('buildId3Tag', () => {
  it('writes a valid ID3v2.3 header with synchsafe size', () => {
    const tag = buildId3Tag({ title: 'A', artist: 'B' });
    expect(latin1(tag, 0, 3)).toBe('ID3');
    expect(tag[3]).toBe(0x03);          // версия 2.3
    expect(tag[4]).toBe(0x00);
    expect(tag[5]).toBe(0x00);          // без флагов
    expect(synchsafe(tag, 6)).toBe(tag.length - 10);
  });

  it('writes TIT2/TPE1 as UTF-16 (encoding 0x01 + BOM)', () => {
    const tag = buildId3Tag({ title: 'A', artist: 'B' });
    const frames = readFrames(tag);

    const tit2 = frames.get('TIT2');
    expect(tit2).toBeDefined();
    expect(tag[tit2!.bodyStart]).toBe(0x01);        // encoding: UTF-16
    expect(tag[tit2!.bodyStart + 1]).toBe(0xff);    // BOM
    expect(tag[tit2!.bodyStart + 2]).toBe(0xfe);
    // 'A' (0x41 0x00) + завершающий 0x00 0x00 → тело = 1+2+2+2 = 7
    expect(tit2!.size).toBe(7);

    expect(frames.has('TPE1')).toBe(true);
  });

  it('омит-ит необязательные фреймы', () => {
    const frames = readFrames(buildId3Tag({ title: 'X', artist: 'Y' }));
    expect(frames.has('APIC')).toBe(false);
    expect(frames.has('USLT')).toBe(false);
    expect(frames.has('TALB')).toBe(false);
  });

  it('embeds an APIC cover frame with the given MIME and bytes', () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const tag = buildId3Tag({ title: 'A', artist: 'B', cover: { data, mime: 'image/jpeg' } });
    const apic = readFrames(tag).get('APIC');
    expect(apic).toBeDefined();
    // encoding(1) + 'image/jpeg'(10) + null(1) + type(1) + descNull(1) + data(4) = 18
    expect(apic!.size).toBe(18);
    expect(tag[apic!.bodyStart]).toBe(0x00);                       // latin1 для MIME
    expect(latin1(tag, apic!.bodyStart + 1, 10)).toBe('image/jpeg');
    expect(tag[apic!.bodyStart + 1 + 10]).toBe(0x00);             // null-terminator MIME
    expect(tag[apic!.bodyStart + 1 + 10 + 1]).toBe(0x03);         // тип: обложка (front)
  });

  it('embeds a USLT lyrics frame', () => {
    const tag = buildId3Tag({ title: 'A', artist: 'B', lyrics: 'Hi' });
    const uslt = readFrames(tag).get('USLT');
    expect(uslt).toBeDefined();
    expect(tag[uslt!.bodyStart]).toBe(0x01);                       // UTF-16
    expect(latin1(tag, uslt!.bodyStart + 1, 3)).toBe('eng');      // язык
  });

  it('grows the tag body as more frames are added', () => {
    const base = buildId3Tag({ title: 'A', artist: 'B' });
    const withCover = buildId3Tag({ title: 'A', artist: 'B', cover: { data: new Uint8Array([1]), mime: 'image/png' } });
    expect(withCover.length).toBeGreaterThan(base.length);
  });
});
