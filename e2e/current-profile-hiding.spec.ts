import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('remaining profile hiding settings remove complete regions and restore live', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', { channel:'chromium', headless:true, executablePath:process.env.PW_CHROME_PATH,
    args:['--disable-features=DisableLoadExtensionCommandLineSwitch',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    const cases = { hide_emoji_status:'#status', hide_open_profile_block:'#open', hide_profile_right_column:'#right' };
    await worker.evaluate(keys => chrome.storage.local.set({ onboarding_done:true, first_run:false, ...Object.fromEntries(keys.map(key=>[key,false])) }), Object.keys(cases));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:`<style>section{padding:12px;border:1px solid gray}.gap{height:16px}#row{display:flex}#content{width:550px}#right{width:300px}</style>
      <main id="profile_redesigned"><section id="header"><img elementtiming="HET_profile_avatar" width="64" height="64"><h1>Profile<div id="status" style="--vkui_internal--padding-inline-start: 8px; --vkui_internal--padding-block-start: 3px;"><div role="button"><div style="width:20px;height:20px"><img alt="Я ещё на ходу" src="https://example.com/random.png" width="20" height="20"></div><span aria-hidden="true"></span></div></div><svg id="verified" width="20" height="20"></svg></h1><div id="promo"><a href="/app12345">Mini app</a></div><div class="gap"></div></section>
      <section id="stories"><h2 role="heading" aria-label="Истории возможных друзей">Истории</h2><a href="/id1">Story</a></section><div class="gap"></div>
      <section id="recommend"><h2>Возможно, вы знакомы</h2><a href="/friends?act=find">All</a></section><div class="gap"></div>
      <section id="open"><div role="button"><div><svg class="vkuiIcon--lock_outline_20" width="20" height="20"></svg></div><div>Any localized offer text</div><div><svg class="vkuiIcon--chevron_compact_right_24" width="16" height="24"></svg></div></div></section><div class="gap"></div>
      <div id="row"><div id="content"><article>Post<img id="message-emoji" src="/emoji/e/123.png" width="20" height="20"></article></div><div id="right"><div><aside><section>Friends</section></aside></div></div></div></main>` }));
    await page.goto('https://vk.ru/binaryghost');
    for (const [key, selector] of Object.entries(cases)) {
      await expect(page.locator(selector)).toBeVisible();
      await worker.evaluate(key => chrome.storage.local.set({[key]:true}), key);
      await expect(page.locator(selector)).toBeHidden();
      if (!['hide_emoji_status','hide_profile_right_column'].includes(key)) await expect(page.locator(selector+' + .gap')).toBeHidden();
      await expect(page.locator('#header')).toBeVisible();
      await expect(page.locator('#verified')).toBeVisible();
      await expect(page.locator('#message-emoji')).toBeVisible();
      if (key === 'hide_profile_right_column') expect((await page.locator('#content').boundingBox())!.width).toBeGreaterThan(550);
      await worker.evaluate(key => chrome.storage.local.set({[key]:false}), key);
      await expect(page.locator(selector)).toBeVisible();
    }

  } finally { await context.close(); }
});
