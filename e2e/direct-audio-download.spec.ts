import { test, expect, chromium } from '@playwright/test';
import { build } from 'esbuild';
import { resolve } from 'node:path';

// Direct files must bypass HLS and be fetched only once. AudioContext and
// the MP3 encoder are real; the background response is supplied through IPC.
test('downloads and converts direct audio with one source request', async () => {
  const samples = 7200;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 440 * 2 * Math.PI / 48000) * 12000), 44 + i * 2);

  const bundle = await build({
    stdin: { resolveDir: process.cwd(), contents: `
      import { fetchAndEncode, fetchOriginal } from './src/content/features/center/music/download/encoder-impl.ts';
      import { produceTrack } from './src/content/features/center/music/download/pipeline.ts';
      window.__vkifyAudioEncoder = { fetchAndEncode, fetchOriginal };
      window.produceTestTrack = produceTrack;
    ` },
    bundle: true, write: false, format: 'iife', alias: { '@': resolve('src') },
    define: { __VKIFY_BROWSER__: '"chrome"', __VKIFY_SITE_URL__: '"https://vkify.ru"', 'import.meta.env.DEV': 'false' },
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const url = 'https://audio.vkuseraudio.net/signed-resource';
    let sourceBytes = wav;
    let pageRequests = 0;
    await page.route(url, route => {
      pageRequests++;
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }, body: sourceBytes });
    });
    await page.setContent('<html><body></body></html>');
    await page.evaluate(dataB64 => {
      const w = window as unknown as Record<string, unknown>;
      w.testFormat = 'original';
      w.testMessages = [];
      w.testDataB64 = dataB64;
      w.chrome = {
        runtime: { sendMessage: async (message: unknown) => {
          (w.testMessages as unknown[]).push(message);
          return { success: true, status: 200, dataB64: w.testDataB64 };
        } },
        storage: { local: { get: async () => ({ audio_download_format: w.testFormat, audio_download_id3: false, audio_download_lyrics: false }) } },
      };
    }, wav.toString('base64'));
    await page.addScriptTag({ content: bundle.outputFiles[0].text });

    for (const source of ['wav', 'mp3']) {
      await page.evaluate(dataB64 => { (window as unknown as { testDataB64: string }).testDataB64 = dataB64; }, sourceBytes.toString('base64'));
      for (const format of ['original', 'mp3']) {
      const result = await page.evaluate(async ({ url, format }) => {
        const w = window as unknown as {
          testFormat: string;
          testMessages: unknown[];
          produceTestTrack: (entry: unknown, progress: (text: string) => void) => Promise<{ parts: BlobPart[]; ext: string; mime: string }>;
        };
        w.testFormat = format;
        const requestCount = w.testMessages.length;
        const file = await w.produceTestTrack({ trackId: '7_42', title: 'Test', performer: 'Test', coverUrl: '', audioData: [42, 7], cachedUrl: url }, () => {});
        const bytes = await new Blob(file.parts).arrayBuffer();
        const ctx = new AudioContext();
        try {
          const decoded = await ctx.decodeAudioData(bytes.slice(0));
          const dataB64 = btoa(Array.from(new Uint8Array(bytes), byte => String.fromCharCode(byte)).join(''));
          return { ext: file.ext, mime: file.mime, length: bytes.byteLength, duration: decoded.duration, audioNodes: document.querySelectorAll('audio').length, dataB64, requests: w.testMessages.length - requestCount };
        } finally { await ctx.close(); }
      }, { url, format });
      const isWav = source === 'wav' && format === 'original';
      expect(result.ext).toBe(isWav ? 'wav' : 'mp3');
      expect(result.mime).toBe(isWav ? 'audio/wav' : 'audio/mpeg');
      expect(result.length).toBeGreaterThan(1000);
      expect(result.duration).toBeGreaterThan(0.1);
      expect(result.duration).toBeLessThan(0.25);
      expect(result.audioNodes).toBe(0);
      expect(result.requests).toBe(1);
      expect(pageRequests).toBe(0);
      if (source === 'wav' && format === 'mp3') sourceBytes = Buffer.from(result.dataB64, 'base64');
      }
    }

    // A real HLS playlist must reuse the first response while its media
    // segment still goes through the normal Chromium loader.
    let segmentRequests = 0;
    await page.route('https://audio.vkuseraudio.net/segment.mp3', route => {
      segmentRequests++;
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: sourceBytes });
    });
    const manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:0.15,\nsegment.mp3\n#EXT-X-ENDLIST\n';
    const hlsResult = await page.evaluate(async ({ url, dataB64 }) => {
      const w = window as unknown as {
        testFormat: string; testDataB64: string; testMessages: unknown[];
        produceTestTrack: (entry: unknown, progress: (text: string) => void) => Promise<{ parts: BlobPart[] }>;
      };
      w.testFormat = 'original';
      w.testDataB64 = dataB64;
      const count = w.testMessages.length;
      const file = await w.produceTestTrack({ trackId: '7_43', title: 'HLS', performer: 'Test', coverUrl: '', audioData: [43, 7], cachedUrl: url }, () => {});
      const ctx = new AudioContext();
      try {
        const audio = await ctx.decodeAudioData(await new Blob(file.parts).arrayBuffer());
        return { duration: audio.duration, requests: w.testMessages.length - count };
      } finally { await ctx.close(); }
    }, { url, dataB64: Buffer.from(manifest).toString('base64') });
    expect(hlsResult.duration).toBeGreaterThan(0.1);
    expect(hlsResult.requests).toBe(1);
    expect(pageRequests).toBe(0);
    expect(segmentRequests).toBe(1);
  } finally { await browser.close(); }
});
