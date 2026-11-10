import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('My Communities uses the page router without replacing the document or audio', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    // First-install defaults must finish before the test writes its own settings.
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, communities_my_groups_redirect: true }));
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let documents = 0;
    // A local silent WAV lets us check actual playback continuity without VK/CDN access.
    const wav = Buffer.alloc(44 + 160000);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(160000, 40);
    await page.route('https://vk.ru/**', route => {
      if (route.request().url().endsWith('/tone.wav')) return route.fulfill({ contentType: 'audio/wav', body: wav });
      documents++;
      return route.fulfill({ contentType: 'text/html', body: `
        <div id="l_gr"><a href="/groups"><span>Сообщества</span></a></div>
        <button id="play" onclick="document.querySelector('audio').play()">Play</button>
        <audio loop src="/tone.wav"></audio><div id="route"></div>
        <script>
          window.routerCalls = 0; window.nativeClicks = 0;
          window.originalAudio = document.querySelector('audio');
          window.nav = { go(href) {
            window.routerCalls++; history.pushState({}, '', href);
            document.querySelector('#route').textContent = href;
          }};
          document.querySelector('#l_gr a').addEventListener('click', e => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
            window.nativeClicks++; e.preventDefault(); window.nav.go('/groups');
          });
        </script>` });
    });
    await page.goto('https://vk.ru/feed');
    const link = page.locator('#l_gr a');
    await expect(link).toHaveAttribute('data-vkify-my-groups', '1');
    await page.locator('#play').click();
    await expect.poll(() => page.locator('audio').evaluate(a => (a as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
    await link.locator('span').click();
    await expect(page).toHaveURL('https://vk.ru/groups/my_all_groups');
    expect(await page.evaluate(() => {
      const w = window as any;
      return { sameAudio: w.originalAudio === document.querySelector('audio'), paused: w.originalAudio.paused, calls: w.routerCalls, native: w.nativeClicks };
    })).toEqual({ sameAudio: true, paused: false, calls: 1, native: 0 });
    expect(documents).toBe(1);
    await page.goBack();
    await expect(page).toHaveURL('https://vk.ru/feed');
    await page.goForward();
    await expect(page).toHaveURL('https://vk.ru/groups/my_all_groups');
    expect(documents).toBe(1);

    // Modified clicks stay with the browser, without calling either page router.
    expect(await link.evaluate(a => {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
      a.addEventListener('click', e => e.preventDefault(), { capture: true, once: true });
      a.dispatchEvent(event);
      return (window as any).routerCalls;
    })).toBe(1);

    await worker.evaluate(() => chrome.storage.local.set({ communities_my_groups_redirect: false }));
    await expect(link).not.toHaveAttribute('data-vkify-my-groups', '1');
    await expect(link).toHaveAttribute('href', '/groups');
    await link.click();
    await expect(page).toHaveURL('https://vk.ru/groups');
    expect(documents).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
