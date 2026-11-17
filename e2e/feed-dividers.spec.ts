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
  expect(await roots.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height))).toEqual(before);
  expect(await page.locator('[data-post-nesting-lvl="1"]').first().evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
  await page.evaluate(()=>document.documentElement.removeAttribute('data-vkify-feed_post_dividers'));
  expect(await roots.first().evaluate(el=>getComputedStyle(el,'::after').content)).toBe('none');
 } finally {await browser.close()}
});
