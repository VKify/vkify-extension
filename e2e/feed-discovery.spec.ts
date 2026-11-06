import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for(const browserBuild of ['chrome','firefox']) test(`${browserBuild}: shipped feed interceptor discovers renamed methods without parsing unrelated responses`,async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage();
    const organic={type:'post',post_id:1,text:'Обычный пост'},ad={type:'ads',ad_id:9};
    const feed={response:{items:[organic,ad],next_from:'next',groups:[]}};
    await page.route('https://vk.ru/feed',route=>route.fulfill({contentType:'text/html',body:'<html><body>Feed fixture</body></html>'}));
    await page.route('https://web.api.vk.ru/method/**',route=>{
      const method=new URL(route.request().url()).pathname.split('/').pop();
      const body=method==='newsfeed.invalid'?'broken':JSON.stringify(method==='users.get'?{response:{items:[{id:3,is_ad:1}]}}:
        method==='newsfeed.tooLarge'?{...feed,padding:'x'.repeat(1024*1024)}:feed);
      return route.fulfill({headers:{'access-control-allow-origin':'*','content-type':'application/json'},body});
    });
    await page.goto('https://vk.ru/feed');
    await page.evaluate(feed=>{(window as any).cur={apiPrefetchCache:[{method:'newsfeed.prefetchV3',...feed}]};},feed);
    await page.addScriptTag({content:await readFile(`dist/${browserBuild}/injected/feed-ad-blocker.js`,'utf8')});
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('vkify-update-settings',{detail:{block_feed_ads_api:true}})));
    expect(await page.evaluate(()=>(window as any).cur.apiPrefetchCache[0].response.items)).toEqual([organic]);
    const result=await page.evaluate(async()=>{
      let clones=0;
      const nativeClone=Response.prototype.clone;
      Response.prototype.clone=function(){clones++;return nativeClone.call(this);};
      const request=async(method:string)=>{
        const before=clones,response=await fetch(`https://web.api.vk.ru/method/${method}?access_token=secret`,{method:'POST',body:'v=5.289'});
        return {clones:clones-before,text:await response.text()};
      };
      try {
        const renamed=await request('newsfeed.loadNextV3');
        const learned=await request('newsfeed.loadNextV3');
        const timeline=await request('internal.loadTimelineV3');
        const unrelated=await request('users.get');
        const tooLarge=await request('newsfeed.tooLarge');
        const invalid=await request('newsfeed.invalid');
        const invalidAgain=await request('newsfeed.invalid');
        window.dispatchEvent(new CustomEvent('vkify-update-settings',{detail:{block_feed_ads_api:false}}));
        const disabled=await request('newsfeed.loadNextV3');
        return {renamed,learned,timeline,unrelated,tooLarge,invalid,invalidAgain,disabled};
      } finally {Response.prototype.clone=nativeClone;}
    });
    for(const item of [result.renamed,result.learned,result.timeline]) {
      expect(JSON.parse(item.text).response).toEqual({...feed.response,items:[organic]});
      expect(item.clones).toBe(1);
    }
    expect(result.unrelated.clones).toBe(0);
    expect(JSON.parse(result.unrelated.text).response.items).toEqual([{id:3,is_ad:1}]);
    expect(result.tooLarge.clones).toBe(0);
    expect(JSON.parse(result.tooLarge.text).response.items).toEqual([organic,ad]);
    expect(result.invalid.text).toBe('broken');
    expect(result.invalidAgain.clones).toBe(0);
    expect(result.disabled.clones).toBe(0);
    expect(JSON.parse(result.disabled.text)).toEqual(feed);
    const diagnostics=await page.evaluate(()=>(window as any).__vkifyFeedDiagnostics);
    expect(JSON.stringify(diagnostics)).not.toContain('secret');
    expect(diagnostics.length).toBeGreaterThan(0);
  } finally {await browser.close();}
});
