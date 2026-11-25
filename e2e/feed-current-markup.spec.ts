import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { build } from './esbuild-fixture.js';
import { installStyleRelations } from './style-relations-fixture.js';

test('current posts support summaries, views, expansion, dividers and feed hiding', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = (await Promise.all([
      'center/feed/expand-post-text.css', 'center/feed/feed-dividers.css', 'center/feed/post-views.css',
      'hiding/feed/hide-stories.css', 'hiding/feed/hide-post-box.css', 'hiding/feed/hide-post-comments.css', 'hiding/feed/hide-right-column.css',
    ].map(path => readFile('src/content/features/' + path, 'utf8')))).join('\n');
    await page.setContent(`<style>${css}</style><div id="spa_layout_content"><h1 id="feed-page-title">Лента</h1>
      <div class="vkuiInternalSplitCol--viewWidth-none" id="right"><div><section role="navigation"><a href="/feed" aria-current="page">Лента</a><a id="photos"></a><a id="friends"></a><a id="search"></a><a id="likes"></a></section></div></div>
      <div class="StoryBlock__noIslandsContainer--hash" id="stories">Stories</div><div id="story-gap"></div>
      <section id="composer"><div role="group"><button aria-expanded="false"><svg class="vkuiIcon--add_20"></svg>Создать<svg class="vkuiIcon--dropdown_outline_16"></svg></button></div></section>
      <div role="feed"><article style="position:absolute;width:500px"><div data-post-id="-1_2" data-post-nesting-lvl="0" id="post">
      <span data-post-id="-1_2"><div data-vkit-show-more-text id="text"><div style="max-height:20px;overflow:hidden;-webkit-line-clamp:2">Own text<br>Full text<img alt="😀"></div><div><span role="button" data-id="showMoreButton">Показать ещё</span></div></div></span>
      <div data-post-id="-3_4" data-post-nesting-lvl="1"><div data-vkit-show-more-text>Nested text</div><a href="/wall-3_4">Nested date</a></div>
      <div id="meta"><a href="/wall-1_2">5 мин назад</a></div>
      <div class="CommentsContainer__container--hash" id="comments">Comment</div>
      </div></article></div></div><div role="group" id="profile-composer"><button aria-label="Создать пост">Profile action</button></div>`);
    await installStyleRelations(page);
    const script = await build({ stdin: { resolveDir: process.cwd(), contents: `
      import { startPostSummary, postSummaryText } from './src/content/features/center/feed/post-summary-runtime.ts';
      import { postViewsFeature } from './src/content/features/center/feed/post-views.ts';
      const observers=[];
      const ctx={registerMutationObserver:(sel,cb)=>document.querySelectorAll(sel).forEach(cb),
        observeChanges:(cb,{container})=>{const o=new MutationObserver(cb);o.observe(container,{childList:true,subtree:true});observers.push(o);return()=>o.disconnect()},
        vkApi:{call:async(_method,params)=>{window.postCalls??=[];window.postCalls.push(params.posts);return params.posts.split(',').map(key=>{const [owner_id,id]=key.split('_').map(Number);return {owner_id,id,views:{count:123}}})}}};
      const stopSummary=startPostSummary(ctx,['chatgpt']);
      const stopViews=postViewsFeature.plugins.find(p=>p.name==='post-views').setup(ctx);
      window.summaryText=()=>postSummaryText(document.querySelector('#post'));
      window.stopPosts=()=>{stopSummary();stopViews();observers.forEach(o=>o.disconnect())};
    ` }, bundle: true, write: false, format: 'iife', tsconfig: 'tsconfig.app.json',
    define: { __VKIFY_SITE_URL__: JSON.stringify('https://vkify.ru') } });
    await page.addScriptTag({ content: script.outputFiles[0].text });
    await expect(page.locator('[data-vkify-post-summary]')).toHaveCount(1);
    await expect(page.locator('#meta [data-vkify-post-views]')).toHaveAttribute('aria-label', /123/);
    const text = await page.evaluate(() => (window as any).summaryText());
    expect(text).toContain('Full text😀');
    expect(text).not.toMatch(/Nested|Показать/);
    const flags = ['expand_post_text','feed_post_dividers','hide_stories','hide_post_box','hide_post_comments','hide_feed_right_column'];
    await page.evaluate(flags => flags.forEach(flag=>document.documentElement.setAttribute('data-vkify-'+flag,'')), flags);
    for (const id of ['right','stories','story-gap','composer','comments']) await expect(page.locator('#'+id)).toBeHidden();
    await expect(page.locator('#profile-composer')).toBeVisible();
    await expect(page.locator('#text > div').first()).toHaveCSS('max-height', 'none');
    await expect(page.locator('[data-id="showMoreButton"]')).toBeHidden();
    expect(await page.locator('#post').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
    await page.evaluate(flags => flags.forEach(flag=>document.documentElement.removeAttribute('data-vkify-'+flag)), flags);
    for (const id of ['right','stories','composer','comments']) await expect(page.locator('#'+id)).toBeVisible();
    await page.locator('#post').evaluate(el => {
      el.setAttribute('data-post-id', '-1_5');
      el.querySelector('#meta a')!.setAttribute('href', '/wall-1_5');
    });
    await expect.poll(() => page.evaluate(()=>(window as any).postCalls)).toContain('-1_5');
    await expect(page.locator('[data-vkify-post-summary]')).toHaveCount(1);
    await page.evaluate(()=>(window as any).stopPosts());
    await expect(page.locator('[data-vkify-post-summary], [data-vkify-post-views]')).toHaveCount(0);
  } finally { await browser.close(); }
});
