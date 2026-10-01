// Capture the current built popup with deterministic demo data; never uses live credentials.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.env.DOCS_OUTPUT_DIR || '../frontend/public/docs');
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:880,height:900}});
const language='ru';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({language}) => {
  const event=()=>({listeners:[],addListener(f){this.listeners.push(f)},removeListener(f){this.listeners=this.listeners.filter(x=>x!==f)}});
  const changes=event(); const raw={schema_version:15, onboarding_done:true,first_run:false,language,vk_scheme:'light',custom_theme:'',custom_accent:'#0077ff',vk_user_id:'1',vk_access_token:'fixture',telegram_notifications_enabled:true,telegram_messages_enabled:true,telegram_spy_activity_enabled:true,telegram_spy_online_enabled:true,telegram_spy_profile_enabled:true,telegram_messages_preview:true,telegram_messages_chats:true,telegram_messages_respect_muted:true,telegram_bot_token:'123:fixture',telegram_chat_id:'456',telegram_message_relay_status:{status:'ready',checkedAt:Date.now()}};
  const area={async get(keys){return keys==null?{...raw}:typeof keys==='string'?{[keys]:raw[keys]}:Object.fromEntries((Array.isArray(keys)?keys:Object.keys(keys)).map(k=>[k,raw[k]]))},async set(data){const c={};for(const[k,v]of Object.entries(data)){c[k]={oldValue:raw[k],newValue:v};raw[k]=v}changes.listeners.forEach(f=>f(c,'local'))},async remove(keys){for(const k of(Array.isArray(keys)?keys:[keys]))delete raw[k]},async clear(){},async getBytesInUse(){return 0}};
  window.__fixture=raw; window.__requests=[];
  const clip=(id,title,duration,extra={})=>({id,owner_id:1,title,duration,date:1700000000+id,views:id*100,image:[{url:location.origin+'/assets/dashboard/center-hero.png',width:900}],...extra});
  window.chrome={storage:{local:area,sync:{...area,async get(){return {}}},onChanged:changes},runtime:{id:'fixture',getManifest:()=>({version:'1.8.6'}),getURL:p=>location.origin+'/'+p,onMessage:event(),async sendMessage(m){window.__requests.push(m);
   if(m.type==='GET_VK_TOKEN')return{token:'fixture',userId:'1',status:'valid'};
   if(m.type==='GET_SETTINGS')return{success:true,settings:{...raw}};
   if(m.type==='GET_ACCOUNT_BACKUP_STATE')return {success:true,state:{status:'idle',progress:0,completedSections:[],errors:{}}};
   if(m.type==='GET_DIALOG_STATS')return {success:true,state:{version:1,ownerId:'1',status:'completed',mode:'quick',collectedAt:Date.now(),completed:2,total:2,rows:[
    {peerId:2,title:'Команда проекта',type:'chat',lastMessageAt:Date.now()-86400000,lastDirection:'in',approxMessageCount:1200,countExact:false,unread:2},
    {peerId:3,title:'Дизайн',type:'user',lastMessageAt:Date.now()-20*86400000,lastDirection:'out',approxMessageCount:320,countExact:false,unread:0}]}};
   if(m.type==='QUERY_VK_TABS')return{count:1};if(m.type==='CHECK_VK_TABS')return{hasVKTabs:true};
   if(m.type==='VK_API_CALL'){
    if(m.method==='users.get')return{success:true,data:[{id:1,first_name:'Демо',last_name:'VKify',photo_100:location.origin+'/icons/icon128.png'}]};
    if(m.method==='video.getAlbums')return{success:true,data:{count:1,items:[{id:5,title:language==='ru'?'Работа':'Work',count:1}]}};
    if(m.method==='video.get')return{success:true,data:{count:m.params.album_id?1:4,items:m.params.album_id?[clip(2,language==='ru'?'Дизайн интерфейсов':'Interface design',1200)]:[clip(1,language==='ru'?'Короткий ролик':'Short video',120),clip(2,language==='ru'?'Дизайн интерфейсов':'Interface design',1200),clip(3,language==='ru'?'Большая лекция':'Long lecture',4200),clip(4,language==='ru'?'Удалённое видео':'Removed video',0,{content_restricted:1,content_restricted_message:language==='ru'?'Видео недоступно':'Video unavailable',image:[]})]}};
   }
   if(m.type==='VK_API_CALL')return {success:true,data:{count:0,items:[],profiles:[],groups:[]}};
   return {success:true};
  }},tabs:{onCreated:event(),onRemoved:event(),onUpdated:event(),async query(){return[]},async create(){}},permissions:{async contains(){return true},onAdded:event(),onRemoved:event()},i18n:{getUILanguage:()=>language},action:{},alarms:{},downloads:{}};
 },{language});

try {
 await page.goto((process.env.DOCS_PREVIEW_URL || 'http://127.0.0.1:4173')+'/index.html?embed=1');
 await page.locator('#root.ready').waitFor();
 const save=async(slug,file,locator=page.locator('#root'))=>{
   await page.mouse.click(878,1);await page.waitForTimeout(2300);
   if(errors.length)throw new Error(errors.join('\n'));
   if(await page.getByText('Что-то пошло не так',{exact:true}).count())throw new Error('Error boundary: '+file);
   await page.evaluate(()=>document.fonts.ready);
   await mkdir(resolve(root,slug),{recursive:true});
   await locator.screenshot({path:resolve(root,slug,file)});console.log(slug+'/'+file);
 };
 const tab=async(name)=>{
   await page.getByRole('button',{name,exact:true}).click();
   // Tabs retain their nested navigation; return to the section root first.
   for(let depth=0;depth<4;depth++){
     const back=page.getByRole('button',{name:'Назад',exact:true}).first();
     if(!await back.count())break;
     await back.click();await page.waitForTimeout(100);
   }
 };
 const feature=async(query)=>{
   await page.keyboard.press('Control+k');
   await page.getByRole('searchbox').fill(query);await page.waitForTimeout(100);
   await page.locator('[data-idx="0"]').waitFor();
   await page.keyboard.press('Enter');await page.getByRole('searchbox').waitFor({state:'hidden'});await page.waitForTimeout(300);
 };
 for(const[name,slug]of [['Вид','view'],['Скрытие','hiding'],['Центр','center'],['Приватность','privacy'],['Слежка','onlinespy'],['Скрипты','scripts'],['Реклама','ads'],['CSS','css'],['Ещё','more']]){
  if(process.env.DOCS_RESUME && existsSync(resolve(root,slug,'overview.png')))continue;
  await tab(name);await save(slug,'overview.png');
 }
 for(const[query,slug,file]of [
 ['Фон страницы','view','background.png'],['Часы','view','clock.png'],['Режим отображения','view','layout.png'],
 ['Шаблоны сообщений','center','message-templates.png'],['Сохранение треков в MP3','center','audio-download.png'],
 ['Эквалайзер','center','equalizer.png'],['Мини-плеер','center','mini-player.png'],['Текст на фоне','center','lyrics.png'],['Визуализатор музыки','center','visualizer.png'],
 ['Шифрование сообщений','privacy','crypto.png'],['Онлайн-мониторинг','onlinespy','online.png'],['Активность в чатах','onlinespy','activity.png'],['Слежка за профилем','onlinespy','profiles.png'],
 ['Полный экспорт аккаунта','center','account-backup.png'],
 ]){if(process.env.DOCS_RESUME && existsSync(resolve(root,slug,file)))continue;await feature(query);await save(slug,file);}
 await tab('Реклама');await page.getByRole('button',{name:/Статистика и журнал/}).click();await save('ads','statistics.png');
 await tab('Реклама');await page.getByRole('button',{name:/Настроить слова и исключения/}).click();await save('ads','keywords.png');
 await tab('CSS');await save('css','editor.png');
 await tab('Центр');await page.getByRole('button',{name:/^Мессенджер/}).click();await save('center','messenger.png');
 await page.getByRole('button',{name:/Файлы диалогов/}).click();await save('center','all-dialog-files.png');
 await page.getByRole('button',{name:/^Один диалог/}).click();await save('center','dialog-files.png');
 await tab('Центр');await page.getByRole('button',{name:/^Мессенджер/}).click();await page.getByRole('button',{name:/Статистика диалогов/}).click();await save('center','dialog-statistics.png');
 await tab('Центр');await page.getByRole('button',{name:/^Друзья/}).click();await page.getByRole('button',{name:/Аудит друзей/}).click();await save('center','friends-audit.png');
 await tab('Центр');await page.getByRole('button',{name:/^Сообщества/}).click();await page.getByRole('button',{name:/Обзор подписок/}).click();await save('center','subscriptions.png');
 await tab('Центр');await page.getByRole('button',{name:/^Видео/}).click();await page.getByRole('button',{name:/Каталог сохранённых видео/}).click();
 await page.getByRole('button',{name:'Загрузить видеотеку',exact:true}).click();await page.locator('.vc-video').first().waitFor();await save('center','video-catalog.png');
 await tab('Ещё');await save('more','telegram.png',page.locator('.telegram-section'));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Captured current documentation screenshots with demo data');
}finally{await browser.close();}
