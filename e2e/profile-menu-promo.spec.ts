import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const target of ['chrome', 'firefox']) test(`${target}: profile ads never render while the native menu flags are suppressed`, async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(`<button id="open">Open profile</button><nav id="menu"></nav><script>
      window.vk={pe:{'frontend.vkconnect_profile_menu_ad_banner_enabled':true,'frontend.vkconnect_profile_menu_ya_browser_banner_enabled':true,'frontend.invite_promo_menu_item_enabled':true}};
      // The observed VK menu model captures its two banner switches on creation.
      document.querySelector('#open').onclick=()=>{
        const ad=!!vk.pe['frontend.vkconnect_profile_menu_ad_banner_enabled'];
        const browser=!!vk.pe['frontend.vkconnect_profile_menu_ya_browser_banner_enabled'];
        document.querySelector('#menu').innerHTML='<a href="#settings">Settings</a><a href="#account">Account</a>'+(ad?'<a data-ad="generic" href="#ad">Ad</a>':'')+(browser?'<a data-ad="browser" href="#browser">Browser</a>':'');
      };
    </script>`);
    await page.addScriptTag({ content: await readFile(`dist/${target}/injected/feed-ad-blocker.js`, 'utf8') });
    const update = (profile: boolean, yandex: boolean) => page.evaluate(({profile,yandex}) => window.dispatchEvent(new CustomEvent('vkify-update-settings', {
      detail: {block_recommendations_profile:profile,block_yandex_browser_promo:yandex},
    })), {profile,yandex});
    await update(true, false); await page.locator('#open').click();
    await expect(page.locator('#menu [data-ad]')).toHaveCount(0);
    await expect(page.getByRole('link', {name:'Settings',exact:true})).toBeVisible();
    expect(await page.evaluate(() => (window as any).vk.pe['frontend.invite_promo_menu_item_enabled'])).toBe(true);
    await update(false, true); await page.locator('#open').click();
    await expect(page.locator('#menu [data-ad="generic"]')).toBeVisible();
    await expect(page.locator('#menu [data-ad="browser"]')).toHaveCount(0);
    await update(false, false); await page.locator('#open').click();
    await expect(page.locator('#menu [data-ad]')).toHaveCount(2);
    await expect(page.locator('style')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new MessageEvent('message', {source:window,data:{type:'VKIFY_DESTROY'}})));
    expect(await page.evaluate(() => Object.getOwnPropertyDescriptor((window as any).vk.pe,'frontend.vkconnect_profile_menu_ad_banner_enabled')?.get)).toBeUndefined();
  } finally { await browser.close(); }
});
