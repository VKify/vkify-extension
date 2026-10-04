import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

test('built background uploads a Telegram backup without a document global', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('https://worker.test/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<html></html>' });
      const body = await readFile(resolve('dist/chrome', path.slice(1)));
      await route.fulfill({ body, contentType: extname(path) === '.js' ? 'text/javascript' : 'application/json' });
    });
    await page.goto('https://worker.test/');
    const result = await page.evaluate(async () => {
      const script = `
        const handlers=[];
        const noop={addListener(){},removeListener(){}};
        const data={onboarding_done:true,telegram_notifications_enabled:true,telegram_bot_token:'123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ',telegram_chat_id:'123',hide_stories:true};
        globalThis.chrome={runtime:{id:'fixture',getURL:p=>'https://worker.test/'+p,getManifest:()=>({version:'2.0.0'}),onMessage:{addListener:fn=>handlers.push(fn)},onInstalled:noop,onStartup:noop,onConnect:noop,setUninstallURL:async()=>{},sendMessage:async()=>({success:true})},
          storage:{local:{get:async()=>({...data}),set:async patch=>Object.assign(data,patch),remove:async()=>{}},sync:{get:async()=>({}),set:async()=>{}},onChanged:noop},
          alarms:{get:async()=>({}),create:async()=>{},clear:async()=>{},onAlarm:noop},tabs:{query:async()=>[],onUpdated:noop,onRemoved:noop,onActivated:noop},permissions:{contains:async()=>true,onAdded:noop,onRemoved:noop},notifications:{onClicked:noop,onClosed:noop,onButtonClicked:noop},action:{},i18n:{getMessage:()=>''}};
        globalThis.fetch=async(url,init)=>{
          if(String(url).endsWith('/sendDocument')) postMessage({upload:await init.body.get('document').text(),noDocument:typeof document==='undefined'});
          return new Response(JSON.stringify({ok:true,result:{message_id:42}}));
        };
        import('https://worker.test/background.js').then(()=>{
          for(const handle of handlers) handle({type:'SAVE_SETTINGS_TELEGRAM'},{id:'fixture',url:'chrome-extension://fixture/index.html'},response=>{if(!response?.success)postMessage({error:response})});
        }).catch(error=>postMessage({error:String(error),stack:error.stack}));
      `;
      return await new Promise<any>((resolve, reject) => {
        const worker = new Worker(URL.createObjectURL(new Blob([script], { type: 'text/javascript' })), { type: 'module' });
        worker.onmessage = e => { worker.terminate(); resolve(e.data); };
        worker.onerror = e => { worker.terminate(); reject(new Error(e.message)); };
      });
    });
    expect(result.error, JSON.stringify(result)).toBeUndefined();
    expect(result.noDocument).toBe(true);
    expect(JSON.parse(result.upload).settings.hide_stories).toBe(true);
    expect(JSON.parse(result.upload).settings).not.toHaveProperty('telegram_bot_token');
  } finally { await browser.close(); }
});
