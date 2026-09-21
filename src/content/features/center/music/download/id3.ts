/**
 * Минимальный энкодер ID3v2.3-тегов (без внешних зависимостей).
 *
 * Поддерживает текстовые фреймы (TIT2/TPE1/TALB/TYER), обложку (APIC) и
 * текст песни (USLT). Текстовые поля пишутся в UTF-16 (encoding 0x01) — это
 * корректно отображает кириллицу в любом плеере, понимающем ID3v2.3.
 *
 * Готовый тег возвращается как Uint8Array и просто дописывается в начало
 * потока MP3-фреймов (ID3v2 всегда располагается перед аудиоданными).
 */

export interface Id3Cover {
  data: Uint8Array;
  mime: string;
}

export interface Id3Meta {
  title: string;
  artist: string;
  album?: string;
  year?: string;
  lyrics?: string;
  cover?: Id3Cover;
}

// ── Низкоуровневые помощники кодирования ───────────────────────────────────────

/** UTF-16LE с BOM и завершающим нулём — для текстовых полей (encoding 0x01). */
function utf16(s: string): Uint8Array {
  const bytes: number[] = [0xff, 0xfe];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  bytes.push(0x00, 0x00);
  return new Uint8Array(bytes);
}

/** ISO-8859-1 (latin1) — для frame ID, MIME-типа, языка. */
function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** 32-битный big-endian размер (фреймы ID3v2.3 — НЕ synchsafe). */
function size32(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

/** Synchsafe 28-битный размер — только для заголовка тега. */
function synchsafe(n: number): Uint8Array {
  return new Uint8Array([(n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function frame(id: string, body: Uint8Array): Uint8Array {
  return concat([latin1(id), size32(body.length), new Uint8Array([0x00, 0x00]), body]);
}

function textFrame(id: string, text: string): Uint8Array {
  return frame(id, concat([new Uint8Array([0x01]), utf16(text)]));
}

function apicFrame(cover: Id3Cover): Uint8Array {
  const body = concat([
    new Uint8Array([0x00]),                       // encoding: latin1 (для MIME/описания)
    latin1(cover.mime), new Uint8Array([0x00]),   // MIME-тип, null-terminated
    new Uint8Array([0x03]),                       // тип картинки: обложка (front)
    new Uint8Array([0x00]),                       // пустое описание, null-terminated
    cover.data,
  ]);
  return frame('APIC', body);
}

function usltFrame(text: string): Uint8Array {
  const body = concat([
    new Uint8Array([0x01]),                       // encoding: UTF-16
    latin1('eng'),                                // язык
    new Uint8Array([0xff, 0xfe, 0x00, 0x00]),     // пустой дескриптор (BOM + null)
    utf16(text),                                  // сам текст песни
  ]);
  return frame('USLT', body);
}

// ── Сборка тега ────────────────────────────────────────────────────────────────

/** Собирает полный ID3v2.3-тег из метаданных. */
export function buildId3Tag(meta: Id3Meta): Uint8Array {
  const frames: Uint8Array[] = [];
  if (meta.title)  frames.push(textFrame('TIT2', meta.title));
  if (meta.artist) frames.push(textFrame('TPE1', meta.artist));
  if (meta.album)  frames.push(textFrame('TALB', meta.album));
  if (meta.year)   frames.push(textFrame('TYER', meta.year));
  if (meta.lyrics) frames.push(usltFrame(meta.lyrics));
  if (meta.cover)  frames.push(apicFrame(meta.cover));

  const body   = concat(frames);
  const header = concat([
    latin1('ID3'),
    new Uint8Array([0x03, 0x00, 0x00]),  // версия 2.3.0, без флагов
    synchsafe(body.length),
  ]);
  return concat([header, body]);
}
