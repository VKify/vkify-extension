import { expect, it } from 'vitest';
import { blockedFeedDescription, buildBlockedFeedLog, parseBlockedFeedLog } from './blocked-feed-log.js';

it('names blocked VK Video recommendations without inventing individual advertised posts', () => {
  const snapshot = buildBlockedFeedLog({ type: 'videos_for_you' }, 'newsfeed.getFeed');
  expect(blockedFeedDescription(snapshot)).toBe('Рекомендуем в VK Видео');
  expect(snapshot.total).toBe(1);
  expect(snapshot.entries).toEqual([]);
});

it('extracts the advertised post and video from an ads wrapper with zero placeholder fields', () => {
  const snapshot=buildBlockedFeedLog({type:'ads',source_id:0,date:0,track_code:'secret',ads:[{
    link_url:'https://shop.example/product?access_token=secret',ad_data:{pixel:'secret'},
    post:{id:55,owner_id:-42,text:'Новый ролик',track_code:'secret',attachments:[{type:'video',video:{title:'Обзор игры',access_key:'secret',tracking_info:'secret'}}]},
  }]},'newsfeed.getFeed',{groups:[{id:42,name:'Игровое сообщество'}]});
  expect(snapshot.entries[0]).toMatchObject({title:'Обзор игры',owner:{id:-42,name:'Игровое сообщество'},
    post:{id:55,owner_id:-42,text:'Новый ролик',url:'https://vk.ru/wall-42_55'},destination:'shop.example'});
  expect(snapshot.api_method).toBe('newsfeed.getFeed');
  expect(blockedFeedDescription(snapshot)).toBe('Обзор игры · Игровое сообщество · Новый ролик · shop.example');
  expect(JSON.stringify(snapshot)).not.toMatch(/secret|track_code|access_key|pixel|source_id/);
});

it('caps creatives, attachments, strings and serialized size below the existing storage limit', () => {
  const snapshot=buildBlockedFeedLog({type:'ads',ads:Array.from({length:100},()=>({title:'t'.repeat(2000),
    post:{id:1,owner_id:-42,text:'"\n'.repeat(5000),attachments:Array.from({length:100},()=>({type:'link',link:{title:'x'.repeat(3000)}}))}}))},'newsfeed.next');
  expect(snapshot.total).toBe(100);
  expect(snapshot.entries.length).toBeGreaterThan(0);
  expect(snapshot.entries.length).toBeLessThanOrEqual(3);
  expect(JSON.stringify(snapshot).length).toBeLessThanOrEqual(3900);
  expect(blockedFeedDescription(snapshot).length).toBeLessThanOrEqual(480);
});

it('describes keyword-blocked posts and resolves personal authors too', () => {
  const snapshot=buildBlockedFeedLog({type:'post',post_id:7,source_id:9,text:'Пост про вебинар'},'wall.get',
    {profiles:[{id:9,first_name:'Иван',last_name:'Иванов'}]});
  expect(snapshot.entries[0].post?.url).toBe('https://vk.ru/wall9_7');
  expect(blockedFeedDescription(snapshot)).toBe('Иван Иванов · Пост про вебинар');
});

it('does not invent details or a wall link from an opaque ad identifier', () => {
  const snapshot=buildBlockedFeedLog({type:'ads',source_id:0,date:0,id:123},'newsfeed.getFeed');
  expect(snapshot.entries).toEqual([]);
  expect(parseBlockedFeedLog(JSON.stringify(snapshot))).toMatchObject({entries:[],api_method:'newsfeed.getFeed'});
  expect(parseBlockedFeedLog('{"type":"ads","source_id":0,"date":0}')).toBeNull();
});

it('validates stored JSON and reconstructs only VK post links rather than trusting hrefs', () => {
  const parsed=parseBlockedFeedLog(JSON.stringify({version:1,type:'ads',api_method:'javascript:bad',total:1,entries:[{
    title:{unexpected:true},owner:{name:{unexpected:true}},post:{id:3,owner_id:-9,url:'javascript:alert(1)',text:'Пост'},
  }]}));
  expect(parsed?.api_method).toBeUndefined();
  expect(parsed?.entries[0].title).toBeUndefined();
  expect(parsed?.entries[0].post?.url).toBe('https://vk.ru/wall-9_3');
  expect(parseBlockedFeedLog('broken')).toBeNull();
});
