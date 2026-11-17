import { test, expect, chromium } from '@playwright/test';
import { build } from './esbuild-fixture.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('summary picker loads once, sends each provider the selected post, and reacts to source preferences', async ({}, info) => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 720 } });
    const css = await readFile('src/content/features/center/feed/post-summary.css', 'utf8');
    await page.setContent(`<style>body{font:13px/20px Arial;background:#19191a;color:#ddd;margin:16px;--vkui--color_text_primary:#ddd;--vkui--color_background_modal:#232324;--text_link:#71aaeb;--background_content:#232324}article,.post{padding:16px;border-radius:12px;background:#232324;margin-bottom:16px}header{font-weight:bold;margin-bottom:16px}footer{margin-top:16px;color:#818c99}[data-testid=showmoretext],.wall_post_text{max-height:80px;overflow:hidden}${css}</style><article data-testid="post" data-post-id="-1_2" data-post-nesting-lvl="0" id="first"><header>VKify</header><div data-testid="showmoretext" data-vkit-show-more-text>В субботу парк откроется после ремонта.<br>Вход бесплатный с 10:00.</div><footer>♡ 24 · 8 мин назад</footer></article><div class="post" data-post-id="-1_3" data-post-nesting-lvl="0" id="second"><div class="wall_post_text" data-vkit-show-more-text>Другая запись &amp; #хеш 😀</div></div><article data-testid="post" data-post-id="-1_2" data-post-nesting-lvl="0" id="empty"><header>Фото без подписи</header></article>`);
    const options = { bundle: true, write: false, format: 'iife' as const, define: { 'import.meta.env.DEV': 'false', __VKIFY_SITE_URL__: '"https://vkify.ru"' }, tsconfig: 'tsconfig.app.json' };
    const entry = await build({ ...options, entryPoints: ['src/content/features/center/feed/post-summary-entry.ts'] });
    await page.exposeFunction('injectSummary', async () => { await page.addScriptTag({ content: entry.outputFiles[0].text }); });
    const bundle = await build({ ...options, stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      import { postSummaryFeature } from './src/content/features/center/feed/post-summary.ts';
      const fixture = window.fixture = {opened: [],copied: '',copyWorks: true,providers:['google','yandex','perplexity','chatgpt','claude','qwen'],injections:0};
      window.chrome = {runtime:{id:'fixture',sendMessage:async message=>{if(message.type!=='INJECT_POST_SUMMARY')throw Error('Unexpected message');fixture.injections++;await window.injectSummary();return {ok:true};}}} as any;
      window.open = (...args) => { fixture.opened.push(args); return null; };
      document.execCommand = () => { fixture.copied = document.querySelector('.vkify-summary-transfer textarea').value; return fixture.copyWorks; };
      const listeners = new Set<Function>();let cleanups=[];
      fixture.disable = () => { cleanups.forEach(stop=>stop?.());cleanups=[];document.documentElement.removeAttribute('data-vkify-post_summary'); };
      fixture.enable = () => {
        document.documentElement.setAttribute('data-vkify-post_summary','');
        const ctx={ id:'post_summary',getSetting:async()=>fixture.providers,
          onSettingChange:(_key,callback)=>{listeners.add(callback);return ()=>listeners.delete(callback)},
          reapply:()=>{fixture.disable();fixture.enable()},
          registerMutationObserver: (selector, callback) => document.querySelectorAll(selector).forEach(callback),
          observeChanges: (callback, {container}) => { const observer = new MutationObserver(callback); observer.observe(container,{childList:true,subtree:true}); return () => observer.disconnect(); },
        } as any;
        cleanups=postSummaryFeature.plugins.map(p=>p.setup?.(ctx));
      };
      fixture.changeProviders = providers => {fixture.providers=providers;[...listeners].forEach(fn=>fn(providers));};
      fixture.enable();
    ` } });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const first = page.locator('#first'), second = page.locator('#second');
    const trigger = first.getByRole('button', { name: 'Краткая сводка поста', exact: true });
    const popup = page.locator('#vkify-post-summary-popup');
    await expect(trigger).toBeVisible();
    await expect(first.locator('button')).toHaveCount(1);
    await expect(second.locator('button')).toHaveCount(1);
    await expect(page.locator('#empty [data-vkify-post-summary]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).fixture.opened)).toEqual([]);
    await trigger.press('ArrowDown');
    await expect(popup.getByRole('menuitem')).toHaveCount(6);
    await expect.poll(() => popup.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(popup.getByRole('menuitem').first()).toBeFocused();
    await page.screenshot({ path: info.outputPath('summary-picker.png') });
    await page.evaluate(() => { document.body.style.setProperty('--vkui--color_text_primary','#19191a'); document.body.style.setProperty('--vkui--color_background_modal','#fff'); });
    await page.screenshot({ path: info.outputPath('summary-picker-light.png') });
    await page.evaluate(() => { document.body.style.removeProperty('--vkui--color_text_primary'); document.body.style.removeProperty('--vkui--color_background_modal'); });
    await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0); await expect(trigger).toBeFocused();
    const select = async (provider: string) => { await trigger.click(); await popup.locator('[data-summary-provider='+provider+']').click(); };
    await select('yandex');
    const alice = await page.evaluate(() => (window as any).fixture.opened[0]);
    expect(alice.slice(1)).toEqual(['_blank', 'noopener,noreferrer']);
    const prompt = JSON.parse(new URL(alice[0]).searchParams.get('alice_deeplink')!).text;
    expect(prompt).toContain('В субботу парк откроется после ремонта.\nВход бесплатный с 10:00.');
    expect(prompt).not.toContain('Другая запись'); expect(prompt).not.toContain('8 мин');
    await expect(popup).toHaveCount(0);
    for (const provider of ['perplexity','chatgpt','claude']) await select(provider);
    const links: string[] = await page.evaluate(() => (window as any).fixture.opened.slice(1).map(args=>args[0]));
    expect(links.map(url=>new URL(url).hostname)).toEqual(['www.perplexity.ai','chatgpt.com','claude.ai']);
    links.forEach(url=>expect(new URL(url).searchParams.get('q')).toBe(prompt));
    await second.getByRole('button', { name: 'Краткая сводка поста', exact: true }).click();
    await popup.locator('[data-summary-provider=google]').click();
    expect(new URL(await page.evaluate(() => (window as any).fixture.opened[4][0])).searchParams.get('q')).toContain('Другая запись & #хеш 😀');
    await first.locator('[data-testid=showmoretext]').evaluate(el=>el.textContent='Длинный текст 😀 '.repeat(350)+'КОНЕЦ_ALICE');
    await select('google');
    await expect(popup.getByRole('status')).toContainText('Выберите «Алиса AI»');
    await expect(first.locator('textarea')).toHaveCount(0);
    await popup.locator('[data-summary-provider=yandex]').click();
    expect(JSON.parse(new URL(await page.evaluate(() => (window as any).fixture.opened[5][0])).searchParams.get('alice_deeplink')!).text).toContain('КОНЕЦ_ALICE');
    await first.locator('[data-testid=showmoretext]').evaluate(el=>el.textContent='Длинный текст 😀 '.repeat(2000)+'КОНЕЦ');
    await select('yandex');
    await expect(popup.locator('textarea')).toHaveValue(/КОНЕЦ/);
    await popup.getByRole('button',{name:'Скопировать запрос',exact:true}).click();
    expect(await page.evaluate(() => (window as any).fixture.copied)).toContain('КОНЕЦ');
    await expect(popup.getByRole('status')).toContainText('Запрос скопирован целиком');
    await expect(popup.getByRole('link',{name:'Открыть чат: Алиса AI'})).toHaveAttribute('href','https://yandex.ru/alice');
    await page.screenshot({path:info.outputPath('long-summary-picker.png')});
    const bounds = await popup.boundingBox(); expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(720);
    await page.evaluate(() => { (window as any).fixture.copyWorks=false; });
    await popup.getByRole('button',{name:'Скопировать запрос',exact:true}).click();
    await expect(popup.getByRole('status')).toContainText('Ctrl/Cmd+C');
    expect(await page.evaluate(() => (window as any).fixture.opened.length)).toBe(6);
    await page.evaluate(() => (window as any).fixture.changeProviders(['perplexity','claude']));
    await expect(popup).toHaveCount(0); await trigger.click();
    await expect(popup.getByRole('menuitem')).toHaveCount(2);
    await expect(popup.locator('[data-summary-provider=google]')).toHaveCount(0);
    await page.evaluate(() => (window as any).fixture.changeProviders([]));
    await expect(popup).toHaveCount(0); await expect(page.locator('[data-vkify-post-summary]')).toHaveCount(0);
    await page.evaluate(() => (window as any).fixture.changeProviders(['google']));
    await expect(trigger).toBeVisible(); await trigger.click();
    await first.evaluate(el=>el.innerHTML='<div data-testid="showmoretext" data-vkit-show-more-text>Обновлённый текст</div>');
    await expect(popup).toHaveCount(0); await expect(trigger).toBeVisible();
    await select('google');
    expect(new URL(await page.evaluate(() => (window as any).fixture.opened[6][0])).searchParams.get('q')).toContain('Обновлённый текст');
    expect(await page.evaluate(() => (window as any).fixture.injections)).toBe(1);
    await page.evaluate(() => (window as any).fixture.changeProviders(['google','qwen']));
    await select('qwen');
    const qwen = new URL(await page.evaluate(() => (window as any).fixture.opened[7][0]));
    expect(qwen.origin).toBe('https://chat.qwen.ai');
    expect(qwen.searchParams.get('text')).toContain('Обновлённый текст');
    await expect(popup).toHaveCount(0);
    await trigger.click(); await page.evaluate(() => (window as any).fixture.disable());
    await expect(popup).toHaveCount(0); await expect(page.locator('[data-vkify-post-summary]')).toHaveCount(0);
  } finally { await browser.close(); }
});

test('built extension loads the summary module in its isolated world without new host permissions', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    await worker.evaluate(() => chrome.storage.local.set({ language: 'ru', onboarding_done: true, first_run: false, post_summary: true, post_summary_providers: ['perplexity','chatgpt'], post_summary_prompt_ru: 'Ответь одним тезисом.', post_summary_prompt_en: 'Give one key point.' }));
    await context.route('https://www.perplexity.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<p>AI service fixture</p>' }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<main><article data-testid="post" data-post-id="-1_2" data-post-nesting-lvl="0" ><div data-testid="showmoretext" data-vkit-show-more-text>Текст записи</div></article></main>' }));
    await page.goto('https://vk.ru/feed');
    const trigger = page.getByRole('button',{name:/^(Краткая сводка поста|AI post summary)$/});
    await expect(trigger).toBeVisible(); await trigger.click();
    const menu = page.locator('#vkify-post-summary-popup');
    await expect(menu.getByRole('menuitem')).toHaveCount(2);
    await expect(menu.locator('[data-summary-provider=perplexity]')).toBeVisible();
    let opened = context.waitForEvent('page'); await menu.locator('[data-summary-provider=perplexity]').click();
    let answer = await opened; await answer.waitForURL('https://www.perplexity.ai/**');
    expect(new URL(answer.url()).searchParams.get('q')).toBe('Ответь одним тезисом.\n\n<post>\nТекст записи\n</post>'); await answer.close();
    await trigger.click();
    await worker.evaluate(() => chrome.storage.local.set({ post_summary_order: ['chatgpt','perplexity'] }));
    await expect(menu).toHaveCount(0); await trigger.click();
    await expect(menu.locator('.vkify-card__title')).toHaveText(['ChatGPT','Perplexity']);
    await worker.evaluate(() => chrome.storage.local.set({ post_summary_providers: ['claude'] }));
    await expect(menu).toHaveCount(0); await trigger.click();
    await expect(menu.getByRole('menuitem')).toHaveCount(1);
    await expect(menu.locator('[data-summary-provider=claude]')).toBeVisible();
    await worker.evaluate(() => chrome.storage.local.set({ language: 'en', post_summary_providers: ['perplexity'], post_summary_prompt_en: 'Return exactly two facts.' }));
    await expect(menu).toHaveCount(0);
    await expect(trigger).toHaveAccessibleName('AI post summary'); await trigger.click();
    opened = context.waitForEvent('page'); await menu.locator('[data-summary-provider=perplexity]').click();
    answer = await opened; await answer.waitForURL('https://www.perplexity.ai/**');
    expect(new URL(answer.url()).searchParams.get('q')).toBe('Return exactly two facts.\n\n<post>\nТекст записи\n</post>'); await answer.close();
    await worker.evaluate(() => chrome.storage.local.set({ post_summary: false }));
    await expect(menu).toHaveCount(0); await expect(trigger).toHaveCount(0);
    const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.host_permissions?.some(value=>/perplexity|chatgpt|claude|google|yandex|qwen/.test(value))).toBe(false);
  } finally { await context.close(); }
});
