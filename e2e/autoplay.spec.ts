import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

// A real, short PCM tone: exercise Chromium's media pipeline and autoplay
// policy while the VK facade deliberately changes only its UI.
function tone(): Buffer {
  const samples = 8000 * 8;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(1000 * Math.sin(i * Math.PI * 440 / 4000)), 44 + i * 2);
  return wav;
}

for (const allowed of [true, false]) {
  test.describe(allowed ? 'autoplay permitted' : 'autoplay requires gesture', () => {
    test('starts real detached audio even when VK play only updates the button', async () => {
      const browser = await chromium.launch({
        executablePath: process.env.PW_CHROME_PATH || undefined,
        args: [`--autoplay-policy=${allowed ? 'no-user-gesture-required' : 'user-gesture-required'}`],
      });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const script = await readFile(resolve('dist/chrome/injected/player-control.js'), 'utf8');
        await page.route('http://autoplay.test/**', async (route) => {
          if (route.request().url().endsWith('/tone.wav')) {
            await route.fulfill({ contentType: 'audio/wav', body: tone() });
            return;
          }
          if (route.request().url().endsWith('/player-control.js')) {
            await route.fulfill({ contentType: 'application/javascript', body: script });
            return;
          }
          await route.fulfill({ contentType: 'text/html', body: `
            <button id="continue">Continue</button><span id="state">paused</span><output id="status"></output>
            <script>
              window.media = new Audio('/tone.wav');
              media.loop = true;
              window.playCalls = 0;
              window.ap = {
                _isPlaying: false,
                _impl: { __private_156__currentNode: { __private_1337__element: media } },
                getCurrentAudio: () => [42, 7],
                play() { playCalls++; this._isPlaying = true; document.querySelector('#state').textContent = 'playing'; }
              };
              window.addEventListener('vkify-script-ready', () => {
                window.dispatchEvent(new CustomEvent('vkify:player:autoplay', { detail: { enabled: true, wasPlaying: true } }));
              });
              setInterval(() => {
                const status = document.querySelector('#status');
                status.dataset.paused = String(media.paused);
                status.dataset.progress = String(media.currentTime > 0.2);
                status.dataset.saved = localStorage.getItem('vkify:audio_was_playing') || '';
              }, 50);
              setTimeout(() => document.querySelector('#status').dataset.observed = 'true', 800);
            </script>
            <script src="/player-control.js"></script>` });
        });
        await page.goto('http://autoplay.test/');
        await expect(page.locator('#state')).toHaveText('playing');
        const status = page.locator('#status');
        if (!allowed) {
          // No page.evaluate/addScriptTag before clicking: CDP evaluation can
          // itself grant user activation and invalidate this policy test.
          await expect(status).toHaveAttribute('data-observed', 'true');
          await expect(status).toHaveAttribute('data-paused', 'true');
          await expect(status).toHaveAttribute('data-progress', 'false');
          await expect(status).not.toHaveAttribute('data-saved', 'true');
          await page.locator('#continue').click();
        }
        await expect(status).toHaveAttribute('data-progress', 'true');
        await expect(status).toHaveAttribute('data-paused', 'false');
        await expect(status).toHaveAttribute('data-saved', 'true');
        expect(errors).toEqual([]);
      } finally { await browser.close(); }
    });
  });
}
