import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('full-width dividers preserve geometry and exclude nested reposts', async () => {
 const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
 try {
  const page=await browser.newPage();
  const css=await readFile('src/content/features/center/feed/feed-dividers.css','utf8');
  const post='<div data-post-id="-1_2" data-post-nesting-lvl="0"><p>Post</p><div data-post-id="-3_4" data-post-nesting-lvl="1">Repost</div></div>';
  await page.setContent('<style>main{width:600px}'+css+'</style><main><article>'+post+'</article><section>'+post+'</section></main>');
  const roots=page.locator('[data-post-nesting-lvl="0"]');
  const before=await roots.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
  await page.evaluate(()=>document.documentElement.setAttribute('data-vkify-feed_post_dividers',''));
  for(const root of await roots.all()) expect(await root.evaluate(el=>{const s=getComputedStyle(el,'::after');return [s.width,s.left,s.right,s.height]})).toEqual(['600px','0px','0px','1px']);
  for(const root of await roots.all()) expect(await root.evaluate(el=>getComputedStyle(el,'::after').bottom)).toBe('-11px');
  expect(await roots.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height))).toEqual(before);
  expect(await page.locator('[data-post-nesting-lvl="1"]').first().evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
  await page.evaluate(()=>document.documentElement.removeAttribute('data-vkify-feed_post_dividers'));
  expect(await roots.first().evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
 } finally {await browser.close()}
});

test('dividers cover legacy walls, mixed feed rows and posts without nesting metadata once', async ({ page }) => {
 const css=await readFile('src/content/features/center/feed/feed-dividers.css','utf8');
 await page.setContent(`<html data-vkify-feed_post_dividers><style>
   main{width:600px} .row{height:80px;margin-bottom:20px;background:#222;color:white}
   ${css}
 </style><main>
   <div id="feed_rows">
     <div class="feed_row row" id="legacy"><div class="post">Legacy feed</div></div>
     <div class="feed_row row" id="mixed"><div data-post-id="1_2" data-post-nesting-lvl="0" id="modern">Modern feed<div data-post-id="2_3" data-post-nesting-lvl="1" id="repost">Repost</div></div></div>
   </div>
   <div id="page_wall_posts"><div class="post row" id="profile">Profile wall</div></div>
   <div id="wall_posts"><div class="post row" id="community">Community wall</div></div>
   <div role="feed"><article class="row" id="no-level"><div data-post-id="3_4">Post without nesting metadata</div></article><article class="row" id="widget">Recommendation widget</article></div>
 </main></html>`);
 for(const id of ['legacy','modern','profile','community','no-level']) {
   expect(await page.locator('#'+id).evaluate(el=>{const s=getComputedStyle(el,'::after');return [s.content,s.bottom,s.width,s.height]})).toEqual(['""','-11px','600px','1px']);
 }
 for(const id of ['mixed','repost','widget']) expect(await page.locator('#'+id).evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
 // Recycled virtual rows can acquire modern metadata after initial rendering.
 await page.locator('#no-level > div').evaluate(el=>el.setAttribute('data-post-nesting-lvl','0'));
 expect(await page.locator('#no-level').evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
 expect(await page.locator('#no-level > div').evaluate(el=>getComputedStyle(el,'::after').bottom)).toBe('-11px');
 await page.evaluate(()=>document.documentElement.removeAttribute('data-vkify-feed_post_dividers'));
 for(const id of ['legacy','modern','profile','community','no-level']) expect(await page.locator('#'+id).evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
});
