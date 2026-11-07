import { test, expect, chromium, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const cover = 'https://sun9.userapi.com/cover.svg', first = 'https://sun9.userapi.com/first.svg';
const sheet = 'https://sun9.userapi.com/sheet.png';
const video = (id = 2) => ({ id, owner_id: -1, title: 'ORIGINAL CAPS TITLE', duration: 90,
  image: [{ url: cover, width: 320, height: 180 }], first_frame: [{ url: first, width: 320, height: 180 }],
  timeline_thumbs: { count_total: 3, count_per_image: 3, count_per_row: 3, frame_width: 80, frame_height: 40, links: [sheet] } });
const markup = `<style>body{background:#171b26;color:#eef;font:16px Arial}main{display:flex;gap:20px;padding:20px}article{width:320px}img{display:block;width:320px;height:180px;object-fit:cover;border-radius:12px}h3{font-size:16px}</style><main></main><script>
  window.renderVideoCards=async function(){const r=await fetch('https://api.vkvideo.ru/method/catalog.getVideoShowcase');const data=await r.json();await window.renderVideoData(data.response.videos);return data;};
  window.renderVideoData=async function(videos){const main=document.querySelector('main');main.replaceChildren();await Promise.all(videos.map(v=>new Promise(resolve=>{const article=document.createElement('article'),a=document.createElement('a'),img=document.createElement('img'),title=document.createElement('h3');a.href='/video'+v.owner_id+'_'+v.id;a.dataset.testid='video_card_thumb';img.alt=v.title;img.crossOrigin='anonymous';title.textContent=v.title;img.onload=resolve;img.onerror=resolve;img.src=v.image[0].url;a.append(img);article.append(a,title);main.append(article);})));};
</script>`;

async function fixtures(page: Page) {
  const png = await page.evaluate(() => { const c=document.createElement('canvas');c.width=240;c.height=40;const x=c.getContext('2d')!;['#f00000','#00e000','#0000f0'].forEach((color,i)=>{x.fillStyle=color;x.fillRect(i*80,0,80,40);});return c.toDataURL('image/png').split(',')[1]; });
  let spriteRequests=0;
  await page.route('https://sun9.userapi.com/**',route=>{
    const url=route.request().url();
    if(url.includes('sheet.png')){spriteRequests++;return route.fulfill({contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:Buffer.from(png,'base64')});}
    return route.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${url.includes('first')?'#d2b13c':'#843b61'}"/></svg>`});
  });
  await page.route('https://api.vkvideo.ru/method/catalog.getVideoShowcase',route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{videos:[video()],next_from:'CURSOR'}})}));
  await page.route('https://vkvideo.ru/',route=>route.fulfill({contentType:'text/html',body:markup}));
  return ()=>spriteRequests;
}
const settings = (page: Page, enabled: boolean, position = 'start') => page.evaluate(({enabled,position})=>window.dispatchEvent(new CustomEvent('vkify:video-frames:settings',{detail:{enabled,position}})),{enabled,position});
const render = (page: Page) => page.evaluate(()=>(window as any).renderVideoCards());
const pixel = (page: Page) => page.locator('img').first().evaluate(img=>{const c=new OffscreenCanvas(1,1);c.getContext('2d')!.drawImage(img as HTMLImageElement,0,0,1,1);return [...c.getContext('2d')!.getImageData(0,0,1,1).data];});

for(const target of ['chrome','firefox']) test(`${target}: API cards render beginning, middle and end without overlay nodes or repeated frame loads`,async({},info)=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage({viewport:{width:1050,height:700}}),count=await fixtures(page);
    await page.goto('https://vkvideo.ru/');await page.addScriptTag({content:await readFile(`dist/${target}/video-card-frames.js`,'utf8')});
    await page.evaluate(()=>{
      const create=document.createElement.bind(document);
      document.createElement=((name:string,...args:any[])=>{if(name.toLowerCase()==='canvas')throw new Error('Frame processing must not create HTML canvas nodes');return create(name,...args);}) as typeof document.createElement;
    });
    await settings(page,true);await render(page);
    await expect(page.locator('img')).toHaveAttribute('src',new RegExp('^data:image/jpeg'));expect((await pixel(page))[1]).toBeGreaterThan(200);expect(count()).toBe(1);
    await settings(page,true,'middle');const data=await render(page);
    expect(data.response.next_from).toBe('CURSOR');expect(data.response.videos[0].title).toBe('ORIGINAL CAPS TITLE');
    expect((await pixel(page))[1]).toBeGreaterThan(200);expect(count()).toBe(2);
    await render(page);expect(count()).toBe(2);await expect(page.locator('img')).toHaveCount(1);
    await expect(page.getByRole('heading',{name:'ORIGINAL CAPS TITLE',exact:true})).toBeVisible();
    await expect(page.locator('[data-vkify-video-frame]')).toHaveCount(0);
    await page.screenshot({path:info.outputPath('native-middle-frame.png')});
    await settings(page,true,'end');await render(page);expect((await pixel(page))[2]).toBeGreaterThan(200);
    await settings(page,false);await render(page);await expect(page.locator('img')).toHaveAttribute('src',cover);
    await expect(page.locator('img')).toHaveAttribute('alt','ORIGINAL CAPS TITLE');
    // The same interception covers the real feed attachment structure and batch envelope.
    for(const method of ['newsfeed.getFeed','batch.call']) {
      const response=method==='batch.call'?{responses:[{body:{response:{videos:[video()]}}}]}:{response:{items:[{attachments:[{type:'video',video:video()}]}]}};
      await page.route(`https://api.vkvideo.ru/method/${method}`,r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(response)}));
      await settings(page,true,'start');const text=await page.evaluate(async method=>(await (await fetch('https://api.vkvideo.ru/method/'+method)).json()),method);
      expect(JSON.stringify(text)).not.toContain(cover);
    }
  } finally {await browser.close();}
});

test('frame metadata is enriched once per response batch and absent or broken frames preserve the native cover',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage();await fixtures(page);await page.goto('https://vkvideo.ru/');
    const missing=video();Reflect.deleteProperty(missing,'first_frame');Reflect.deleteProperty(missing,'timeline_thumbs');
    await page.route('https://api.vkvideo.ru/method/catalog.getVideoShowcase',route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{videos:[missing,{...missing,id:3}]}})}));
    await page.evaluate(metadata=>{(window as any).calls=[];(window as any).vkApi={api:async(method:string,params:any,options:any)=>{
      (window as any).calls.push({method,params,options});
      if(method!=='video.getByIds'||options.domain!=='api.vkvideo.ru'||params.video_fields!=='image,timeline_thumbs')throw new Error('Wrong native frame API');
      return {items:[metadata]};
    }};},video());
    await page.addScriptTag({content:await readFile('dist/chrome/video-card-frames.js','utf8')});await settings(page,true,'middle');await render(page);
    await expect(page.locator('img').first()).toHaveAttribute('src',new RegExp('^data:image/jpeg'));await expect(page.locator('img').nth(1)).toHaveAttribute('src',cover);
    const calls=await page.evaluate(()=>(window as any).calls);expect(calls).toHaveLength(1);expect(calls[0].params.videos).toBe('-1_2,-1_3');
    expect(calls[0].method).toBe('video.getByIds');expect(calls[0].params.extended).toBeUndefined();
    await render(page);expect(await page.evaluate(()=>(window as any).calls.length)).toBe(1);
    await settings(page,false);await settings(page,true,'end');
    await page.route('https://sun9.userapi.com/sheet.png',r=>r.abort());await render(page);
    await expect(page.locator('img').first()).toHaveAttribute('src',cover);
  } finally {await browser.close();}
});

for(const target of ['chrome','firefox']) test(`${target}: search, subscriptions, playlists, profiles and feed rewrite catalog video entities before rendering`,async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage(),count=await fixtures(page);
    await page.goto('https://vkvideo.ru/');await page.addScriptTag({content:await readFile(`dist/${target}/video-card-frames.js`,'utf8')});
    await settings(page,true,'start');
    const methods=['catalog.getVideoSearchWeb2','catalog.getVideoSearch','catalog.getOwnerVideosSearch','catalog.getVideoSearchSubscriptions','catalog.getVideoAlbum','catalog.getSection','catalog.getBlockItems','catalog.getSearchAll','catalog.replaceBlocks','video.getFromAlbum','video.getCatalogBlockItems','video.feedVideosForYouBlockItems','fave.get','owners.getMainTab','newsfeed.getFeed'];
    for(const method of methods){
      const main=video(),auxiliary={...video(9),title:'Auxiliary playlist content'};
      const album={id:5,owner_id:-1,title:'Playlist cover',type:'album',first_video_id:2,image:[{url:cover}]};
      const data={response:{videos:[auxiliary],catalog_videos:[{snippet_marks:[{title:'4K'}],video:main}],albums:[album],next_from:'PAGE2'}};
      await page.route(`https://api.vkvideo.ru/method/${method}`,route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)}));
      const result=await page.evaluate(async method=>(await fetch('https://api.vkvideo.ru/method/'+method)).json(),method);
      expect(result.response.catalog_videos[0].video.image[0].url).toMatch(new RegExp('^data:image/jpeg'));
      expect(result.response.catalog_videos[0].video.title).toBe('ORIGINAL CAPS TITLE');
      expect(result.response.catalog_videos[0].snippet_marks).toEqual([{title:'4K'}]);
      expect(result.response.albums).toEqual([album]);expect(result.response.next_from).toBe('PAGE2');
      expect(result.response.videos).toEqual([auxiliary]);
      await page.evaluate(data=>(window as any).renderVideoData(data.response.catalog_videos.map((item:any)=>item.video)),result);
      expect((await pixel(page))[1]).toBeGreaterThan(200);
    }
    // VK may rotate signed CDN links without changing the video or timestamp.
    const rotated=video();rotated.timeline_thumbs.links=[sheet+'?new-signature'];
    await page.route('https://api.vkvideo.ru/method/catalog.getVideoSearchWeb2',route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{catalog_videos:[{video:rotated}]}})}));
    const reused=await page.evaluate(async()=>(await fetch('https://api.vkvideo.ru/method/catalog.getVideoSearchWeb2')).json());
    expect(reused.response.catalog_videos[0].video.image[0].url).toMatch(new RegExp('^data:image/jpeg'));
    expect(count()).toBe(1);await expect(page.locator('img')).toHaveCount(1);
    await expect(page.locator('[data-vkify-video-frame]')).toHaveCount(0);
  }finally{await browser.close();}
});

test('stale search sprites are refreshed through getByIds and cached without UI replacements',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try {
    const page=await browser.newPage();await fixtures(page);await page.goto('https://vkvideo.ru/');
    const stale=video();stale.timeline_thumbs.links=['https://sun9.userapi.com/stale.png'];
    await page.route('https://sun9.userapi.com/stale.png',r=>r.fulfill({status:404,headers:{'access-control-allow-origin':'*'},body:'not found'}));
    await page.route('https://api.vkvideo.ru/method/catalog.getVideoSearchWeb2',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({response:{catalog_videos:[{video:stale}]}})}));
    await page.evaluate(fresh=>{(window as any).calls=[];(window as any).vkApi={api:async(method:string,params:unknown)=>{(window as any).calls.push({method,params});return{items:[fresh]};}};},video());
    await page.addScriptTag({content:await readFile('dist/chrome/video-card-frames.js','utf8')});await settings(page,true,'start');
    for(let i=0;i<2;i++){
      const result=await page.evaluate(async()=>(await fetch('https://api.vkvideo.ru/method/catalog.getVideoSearchWeb2')).json());
      expect(result.response.catalog_videos[0].video.image[0].url).toMatch(new RegExp('^data:image/jpeg'));
    }
    expect(await page.evaluate(()=>(window as any).calls.length)).toBe(1);
    expect(await page.evaluate(()=>(window as any).calls[0].method)).toBe('video.getByIds');
    await expect(page.locator('img,canvas,video')).toHaveCount(0);
  }finally{await browser.close();}
});

for(const target of ['chrome','firefox']) test(`${target}: native legacy delivery prepares topic pages and pagination before VK renders them`,async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH});
  try{
    const page=await browser.newPage();await fixtures(page);
    for(const section of ['trends','politics','musical']){
      await page.route('https://vkvideo.ru/'+section,r=>r.fulfill({contentType:'text/html',body:markup}));
      await page.goto('https://vkvideo.ru/'+section);
      await page.addScriptTag({content:await readFile(`dist/${target}/video-card-frames.js`,'utf8')});
      await settings(page,true,'start');
      const legacyHtml=`<div class="_video_item VideoCard" id="video_item_-1_2" data-thumb="${cover}"><a href="/video-1_2"><img class="VideoCard__thumbImg" src="${cover}" data-thumb="${cover}" alt="Исходное название"></a></div>`;
      await page.evaluate(({metadata,legacyHtml,cover})=>{
        (window as any).metadataCalls=0;
        (window as any).vkApi={api:async()=>{(window as any).metadataCalls++;return{items:[metadata]};}};
        const row=Array(20).fill('');row[0]=-1;row[1]=2;row[2]=cover;row[3]='Исходное название';row[19]=90;
        const initial=[false,legacyHtml,'UNCHANGED EXECUTABLE PAYLOAD'];
        (window as any).ajax={promisifiedPost:async(_url:string,params:any)=>params.silent_loading?[JSON.stringify({videos:[row],playlists:[{cover}],nextFrom:'CURSOR'})]:initial,
          post:(_url:string,_params:unknown,options:any)=>{options.onDone(...initial);return'original request';}};
      },{metadata:video(),legacyHtml,cover});
      const initial=await page.evaluate(async section=>(window as any).ajax.promisifiedPost('al_video.php',{__query:section}),section);
      expect(initial[1]).toContain('src="data:image/jpeg');expect(initial[2]).toBe('UNCHANGED EXECUTABLE PAYLOAD');
      // Extension preparation creates no page nodes; VK consumes the prepared HTML itself.
      await expect(page.locator('img,canvas,video')).toHaveCount(0);
      await page.locator('main').evaluate((main,html)=>{main.innerHTML=html;},initial[1]);
      await expect(page.locator('img')).toHaveAttribute('alt','Исходное название');
      await expect.poll(async()=>(await pixel(page))[1]).toBeGreaterThan(200);
      const pagination=await page.evaluate(async section=>JSON.parse((await (window as any).ajax.promisifiedPost('/'+section,{silent_loading:1}))[0]),section);
      expect(pagination.videos[0][2]).toMatch(/^data:image\/jpeg/);expect(pagination.videos[0][3]).toBe('Исходное название');
      expect(pagination.playlists).toEqual([{cover}]);expect(pagination.nextFrom).toBe('CURSOR');
      expect(await page.evaluate(()=>(window as any).metadataCalls)).toBe(1);
      const callback=await page.evaluate(section=>new Promise(resolve=>{(window as any).ajax.post('al_video.php',{__query:section},{onDone:(...args:unknown[])=>resolve(args)});}),section);
      expect((callback as any[])[1]).toContain('src="data:image/jpeg');
      await settings(page,false);
      const disabled=await page.evaluate(async section=>(window as any).ajax.promisifiedPost('al_video.php',{__query:section}),section);
      expect(disabled[1]).toBe(legacyHtml);
    }
  }finally{await browser.close();}
});

test('installed extension uses MAIN-world API interception, persisted positions and initial HTML caches',async()=>{
  test.setTimeout(60000);const extension=resolve('dist/chrome');
  const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,executablePath:process.env.PW_CHROME_PATH,args:['--disable-features=DisableLoadExtensionCommandLineSwitch',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try {
    const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    await worker.evaluate(()=>chrome.storage.local.set({onboarding_done:true,first_run:false,video_card_frames:false,video_wallpaper:false}));
    const page=await context.newPage();await fixtures(page);await page.goto('https://vkvideo.ru/');
    expect(await page.evaluate(()=>Boolean((window as any).__vkifyVideoFrameInterceptor))).toBe(false);
    await worker.evaluate(()=>chrome.storage.local.set({video_card_frames:true,video_card_frame_position:'middle'}));
    await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__vkifyVideoFrameInterceptor))).toBe(true);
    await expect.poll(async()=>{const result=await render(page);return result.response.videos[0].image[0].url.startsWith('data:');},{timeout:15000}).toBe(true);
    expect((await pixel(page))[1]).toBeGreaterThan(200);
    await worker.evaluate(()=>chrome.storage.local.set({video_card_frame_position:'end'}));
    await expect.poll(async()=>{await render(page);return (await pixel(page))[2]>200;}).toBe(true);
    const prefetched=await page.evaluate(async v=>{(window as any).cur={apiPrefetchCache:[{method:'catalog.getVideoShowcase',response:{videos:[v]}}]};await (window as any).apiPrefetchReadyPromise;await (window as any).renderVideoData((window as any).cur.apiPrefetchCache[0].response.videos);return (window as any).cur.apiPrefetchCache[0].response.videos[0];},video());
    expect(prefetched.image[0].url).toMatch(new RegExp('^data:image/jpeg'));expect((await pixel(page))[2]).toBeGreaterThan(200);
    await worker.evaluate(()=>chrome.storage.local.set({video_card_frames:false}));
    await expect.poll(async()=>{const result=await render(page);return result.response.videos[0].image[0].url;}).toBe(cover);
    await expect(page.locator('[data-vkify-video-frame]')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'ORIGINAL CAPS TITLE',exact:true})).toBeVisible();
  } finally {await context.close();}
});
