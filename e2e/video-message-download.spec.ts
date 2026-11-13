import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('video message download toggle adds an independent button and reaches browser downloads', async ({}, info) => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ onboarding_done: true, first_run: false, language: 'en', voice_download: true, video_message_download: false });
      (globalThis as any).downloadRequests = [];
      chrome.downloads.download = (async options => { (globalThis as any).downloadRequests.push(options); return 1; }) as typeof chrome.downloads.download;
    });
    const vk = await context.newPage();
    await vk.route('https://vk.ru/im/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <style>body{padding:40px;background:#20242b;color:white}.AttachVideoMessage{position:relative;width:216px;height:216px;margin-bottom:24px}.AttachVideoMessage__preview{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:#34536b}.AttachVideoMessage__transcriptionToggle{position:absolute;right:0;top:0;width:34px;height:24px;padding:0 9px;border:0;border-radius:10px;background:rgba(0,0,0,.4);color:white}.ConvoMessageIconButton{border:0;background:transparent;color:inherit}.AttachVoice__player{display:flex}</style>
      <script>window.apiCalls=[];window.playbackClicks=0;window.vkApi={api:async(method,params)=>{apiCalls.push({method,params});return {items:[{id:1,conversation_message_id:92,peer_id:42,from_id:42,date:0,text:'',attachments:[{type:'video_message',video_message:{id:1,owner_id:42,files:{mp4_480:'https://vkvd724.okcdn.ru/circle.mp4'}}},{type:'audio_message',audio_message:{link_mp3:'https://cdn.test/voice.mp3'}}]}]};}};</script>
      <main><div data-itemkey="92"><article class="ConvoHistory__messageBlock">
      <div class="AttachVideoMessage" onclick="playbackClicks++"><div class="AttachVideoMessage__preview"><video class="AttachVideoMessage__video" playsinline loop></video></div><button class="AttachVideoMessage__transcriptionToggle">Aa</button></div>
      <div class="AttachVoice__player"><button data-testid="vkme_message_voice_asr_toggle">Aa</button></div>
      </article></div></main>` }));
    await vk.goto('https://vk.ru/im/convo/42');
    await expect(vk.locator('.vkify-voice-download')).toHaveCount(1);
    await expect(vk.locator('.vkify-video-message-download')).toHaveCount(0);
    const ui = await context.newPage();
    await ui.goto(`chrome-extension://${new URL(worker.url()).host}/index.html?embed=1`);
    await ui.setViewportSize({ width: 680, height: 1100 });
    await expect(ui.locator('#root.ready')).toBeVisible();
    await ui.getByRole('button', { name: 'Center', exact: true }).click();
    await ui.getByRole('button', { name: /^Messenger/ }).click();
    const toggle = ui.locator('[data-vkify-anchor="video_message_download"]').getByRole('switch');
    await expect(toggle).not.toBeChecked(); await toggle.click();
    const button = vk.getByRole('button', { name: 'Download video message', exact: true });
    await expect(button).toBeVisible();
    const appearance = await vk.evaluate(() => {
      const download = getComputedStyle(document.querySelector('.vkify-video-message-download')!);
      const native = getComputedStyle(document.querySelector('.AttachVideoMessage__transcriptionToggle:not(.vkify-video-message-download)')!);
      const keys = ['width', 'height', 'borderRadius', 'backgroundColor', 'color'] as const;
      return { download: keys.map(key => download[key]), native: keys.map(key => native[key]) };
    });
    expect(appearance.download).toEqual(appearance.native);
    await expect.poll(() => vk.evaluate(() => Boolean((window as any).__VKifyApiBridge?.isAvailable))).toBe(true);
    await vk.screenshot({ path: info.outputPath('video-message-download.png') });
    await button.click();
    await expect.poll(() => worker.evaluate(() => (globalThis as any).downloadRequests)).toEqual([{
      url: 'https://vkvd724.okcdn.ru/circle.mp4', filename: 'video_message_42_92_1.mp4', conflictAction: 'uniquify',
    }]);
    expect(await vk.evaluate(() => (window as any).playbackClicks)).toBe(0);
    await toggle.click();
    await expect(button).toHaveCount(0); await expect(vk.locator('.vkify-voice-download')).toHaveCount(1);
    await expect(vk.locator('.AttachVideoMessage__transcriptionToggle:not(.vkify-video-message-download)')).toBeVisible();
  } finally { await context.close(); }
});
