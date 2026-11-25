import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('built extension starts feed features on current VK markup through real settings', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    const flags = ['post_summary','post_views','feed_post_dividers','expand_post_text','hide_post_box','hide_stories','hide_post_comments','hide_feed_right_column'];
    await worker.evaluate(flags => chrome.storage.local.set({language:'ru', onboarding_done:true, first_run:false, post_summary_providers:['chatgpt'], ...Object.fromEntries(flags.map(flag=>[flag,true]))}), flags);
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({contentType:'text/html; charset=utf-8', body:`<main id="spa_layout_content"><h1 id="feed-page-title">Лента</h1>
      <div class="vkuiInternalSplitCol--viewWidth-none" id="right"><section role="navigation"><a href="/feed">Лента</a><a id="photos"></a><a id="friends"></a><a id="search"></a><a id="likes"></a></section></div>
      <section id="create"><div role="group"><button aria-expanded="false"><svg class="vkuiIcon--add_20"></svg>Создать<svg class="vkuiIcon--dropdown_outline_16"></svg></button></div></section><div id="create-gap" style="height:20px"></div>
      <div class="StoryBlock__noIslandsContainer--hash" id="stories">Истории</div><div id="gap"></div>
      <div role="feed"><article style="width:600px"><div data-post-nesting-lvl="0" data-post-id="-1_2" id="post">
      <span data-post-id="-1_2"><div data-vkit-show-more-text><div style="max-height:20px;overflow:hidden">Полный текст записи<br>Вторая строка</div><div><span data-id="showMoreButton" role="button">Показать ещё</span></div></div></span>
      <footer><div><a href="/wall-1_2">5 мин назад</a></div></footer><div class="CommentsContainer__container--hash" id="comments">Comment</div></div></article></div></main>`}));
    await page.goto('https://vk.ru/feed');
    const button = page.getByRole('button',{name:'Краткая сводка поста',exact:true});
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('#vkify-post-summary-popup [role="menuitem"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    for (const id of ['right','create','create-gap','stories','gap','comments']) await expect(page.locator('#'+id)).toBeHidden();
    await page.locator('#create-gap').evaluate(el => el.textContent = 'Content');
    await expect(page.locator('#create-gap')).toBeVisible();
    await page.locator('#create-gap').evaluate(el => el.textContent = '');
    await expect(page.locator('#create-gap')).toBeHidden();
    await expect(page.locator('[data-vkify-post-views]')).toBeVisible();
    await expect(page.locator('[data-vkit-show-more-text] > div').first()).toHaveCSS('max-height','none');
    expect(await page.locator('#post').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
    await page.screenshot({path:resolve('test-results/feed-current-extension.png'),fullPage:true});
    await worker.evaluate(flags=>chrome.storage.local.set(Object.fromEntries(flags.map(flag=>[flag,false]))),flags);
    await expect(button).toHaveCount(0);
    for (const id of ['right','create','create-gap','stories','comments']) await expect(page.locator('#'+id)).toBeVisible();
    await expect(page.locator('[data-vkify-post-views]')).toHaveCount(0);
    await worker.evaluate(()=>chrome.storage.local.set({post_summary:true}));
    await expect(button).toBeVisible();
  } finally { await context.close(); }
});
