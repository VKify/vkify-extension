/**
 * Минимальный ZIP-writer без сжатия (STORE / method 0).
 *
 * Зачем своими руками: фичу экспорта диалога нужно собирать в zip с
 * сотнями JPEG-картинок (которые УЖЕ сжаты CDN ВКонтакте) — DEFLATE поверх
 * JPEG почти ничего не даст и пришлось бы тянуть pako / fflate ради 5%
 * экономии. STORE — 80 строк кода и ноль рантайм-зависимостей.
 *
 * Формат: PKZIP APPNOTE 6.3.10 §4.3 (ZIP без extra-полей, без ZIP64).
 *
 * Ограничения:
 *   • Каждый файл < 4 ГБ и общее количество < 65 535 (ZIP64 не реализован).
 *     Реальный кейс — пара тысяч фоток по 500 КБ → ~1 ГБ архив,
 *     укладывается в эти лимиты с большим запасом.
 *   • UTF-8 имена файлов через бит 0x0800 в general purpose flag.
 */

// ─── CRC-32 (IEEE 802.3 polynomial) ───────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array, previous = 0): number {
  let c = (previous ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ─── DOS date/time helpers ────────────────────────────────────────────────

function dosTime(d: Date): number {
  return ((d.getHours() & 0x1f) << 11)
       | ((d.getMinutes() & 0x3f) << 5)
       | ((d.getSeconds() >> 1) & 0x1f);
}

function dosDate(d: Date): number {
  const y = d.getFullYear() - 1980;
  return ((y & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
}

// ─── public types ─────────────────────────────────────────────────────────

export interface ZipEntry {
  /** Имя файла в архиве (с подкаталогами через '/'). UTF-8. */
  name: string;
  /** Содержимое. Строка кодируется как UTF-8. */
  data: Uint8Array | string;
}

// ─── writer ───────────────────────────────────────────────────────────────

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  localOffset: number;
}

/** Собирает все entries в один Blob. Все вычисления — за один проход. */
export function buildZip(entries: ZipEntry[]): Blob {
  return buildStoredZip(entries.map(entry => {
    const data = typeof entry.data === 'string' ? utf8(entry.data) : entry.data;
    return { name: entry.name, data, crc: crc32(data) };
  }));
}

/** Reuse the STORE writer for streamed downloads without flattening large files. */
export function buildZipBlobs(entries: { name: string; data: Blob; crc: number }[]): Blob {
  return buildStoredZip(entries);
}

function buildStoredZip(entries: { name: string; data: Uint8Array | Blob; crc: number }[]): Blob {
  if (entries.length >= 65535) throw new Error('ZIP_LIMIT');
  const now = new Date();
  const time = dosTime(now);
  const date = dosDate(now);

  const prepared: PreparedEntry[] = [];
  const localChunks: BlobPart[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = utf8(e.name);
    const data = e.data, size = data instanceof Uint8Array ? data.length : data.size;
    const c = e.crc;
    if (nameBytes.length > 65535 || size >= 0xffffffff || offset + 30 + nameBytes.length + size >= 0xffffffff) throw new Error('ZIP_LIMIT');

    const lf = new Uint8Array(30 + nameBytes.length);
    const dv = new DataView(lf.buffer);
    dv.setUint32(0, 0x04034b50, true); // local file header signature
    dv.setUint16(4, 20, true);          // version needed: 2.0
    dv.setUint16(6, 0x0800, true);      // gpb flag: UTF-8 names
    dv.setUint16(8, 0, true);           // method: STORE
    dv.setUint16(10, time, true);
    dv.setUint16(12, date, true);
    dv.setUint32(14, c, true);          // crc
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, nameBytes.length, true);
    dv.setUint16(28, 0, true);          // extra length
    lf.set(nameBytes, 30);

    localChunks.push(lf as BlobPart, data as BlobPart);
    prepared.push({ nameBytes, crc: c, size, localOffset: offset });
    offset += lf.length + size;
  }

  // Central directory
  const centralChunks: Uint8Array[] = [];
  let centralSize = 0;
  for (const p of prepared) {
    const cd = new Uint8Array(46 + p.nameBytes.length);
    const dv = new DataView(cd.buffer);
    dv.setUint32(0, 0x02014b50, true);  // central dir signature
    dv.setUint16(4, 20, true);           // version made by
    dv.setUint16(6, 20, true);           // version needed
    dv.setUint16(8, 0x0800, true);       // gpb
    dv.setUint16(10, 0, true);           // method: STORE
    dv.setUint16(12, time, true);
    dv.setUint16(14, date, true);
    dv.setUint32(16, p.crc, true);
    dv.setUint32(20, p.size, true);
    dv.setUint32(24, p.size, true);
    dv.setUint16(28, p.nameBytes.length, true);
    dv.setUint16(30, 0, true);           // extra
    dv.setUint16(32, 0, true);           // comment
    dv.setUint16(34, 0, true);           // disk number
    dv.setUint16(36, 0, true);           // internal attrs
    dv.setUint32(38, 0, true);           // external attrs
    dv.setUint32(42, p.localOffset, true);
    cd.set(p.nameBytes, 46);
    centralChunks.push(cd);
    centralSize += cd.length;
  }

  // End of central directory record
  if (offset + centralSize + 22 >= 0xffffffff) throw new Error('ZIP_LIMIT');
  const eocd = new Uint8Array(22);
  const dv = new DataView(eocd.buffer);
  dv.setUint32(0, 0x06054b50, true);
  dv.setUint16(4, 0, true);              // disk number
  dv.setUint16(6, 0, true);              // disk where central dir starts
  dv.setUint16(8, prepared.length, true);
  dv.setUint16(10, prepared.length, true);
  dv.setUint32(12, centralSize, true);
  dv.setUint32(16, offset, true);        // central dir offset
  dv.setUint16(20, 0, true);             // comment length

  // TS5.7+ строго различает Uint8Array<ArrayBuffer> и <SharedArrayBuffer>;
  // у Blob-конструктора широкий тип BlobPart, но через .buffer compiler не
  // протаскивает связь — приводим явно. Все наши Uint8Array созданы через
  // `new Uint8Array(n)`, гарантированно поверх ArrayBuffer, не Shared.
  const parts: BlobPart[] = [...localChunks, ...centralChunks, eocd] as BlobPart[];
  return new Blob(parts, { type: 'application/zip' });
}
