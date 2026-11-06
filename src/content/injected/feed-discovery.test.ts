import { afterEach, expect, it, vi } from 'vitest';
import { createFeedDiscovery, FEED_PROBE_MAX_BYTES, hasFeedShape, isFeedCandidate, readFeedProbe, vkApiMethod } from './feed-discovery.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const feed = { response:{items:[{type:'post',post_id:1},{type:'ads'}],next_from:'next',groups:[]} };

it('restricts URL and candidate matching without retaining query parameters', () => {
  expect(vkApiMethod('https://web.api.vk.ru/method/newsfeed.getFeedV3?v=9&access_token=secret','https://vk.ru/feed')).toBe('newsfeed.getFeedV3');
  for (const url of ['https://vk.ru.evil.test/method/newsfeed.getFeed','https://evilvk.ru/method/newsfeed.getFeed','/method/newsfeed.getFeed/extra','data:text/plain,test','/method/newsfeed.'+'x'.repeat(100)])
    expect(vkApiMethod(url,'https://vk.ru/feed')).toBeNull();
  expect(isFeedCandidate('internal.loadTimelineV2')).toBe(true);
  expect(isFeedCandidate('content.fetchFeedV4')).toBe(true);
  expect(isFeedCandidate('newsfeed.replacement')).toBe(true);
  for (const method of ['messages.getHistory','users.get','wall.getComments','audio.get','internal.getSettings']) expect(isFeedCandidate(method)).toBe(false);
});

it('requires feed containers, post types and metadata, not just ad flags', () => {
  expect(hasFeedShape(feed)).toBe(true);
  expect(hasFeedShape(feed,true)).toBe(false);
  expect(hasFeedShape({response:{items:[{type:'ads'}],feed_type:'recent'}})).toBe(true);
  expect(hasFeedShape({response:{items:[],feed_type:'recent'}})).toBe(true);
  expect(hasFeedShape({response:{newsfeed_items:[{item:{type:'post',id:1}}],catalog:{sections:[]}}})).toBe(true);
  for (const response of [{items:[{is_ad:1}]},{items:[{type:'message',id:1,is_ad:1}],next_from:'next',profiles:[]},{items:[{type:'post',id:1}]},{items:[],next_from:'next',groups:[]},{newsfeed_items:[{item:{type:'ads'}}]}])
    expect(hasFeedShape({response})).toBe(false);
});

it('bounds initial probes and negatively caches rejected methods, but revalidates learned methods', () => {
  vi.useFakeTimers(); vi.setSystemTime(100_000);
  const discovery=createFeedDiscovery();
  expect(discovery.consider('users.get')).toBeNull();
  expect(discovery.consider('newsfeed.replaced')).toBe('probe');
  expect(discovery.consider('newsfeed.replaced')).toBeNull();
  expect(discovery.inspect('newsfeed.replaced',feed)).toBe(true);
  for(let i=0;i<7;i++) expect(discovery.consider(`newsfeed.probe${i}`)).toBe('probe');
  expect(discovery.consider('newsfeed.overBudget')).toBeNull();
  expect(discovery.consider('newsfeed.replaced')).toBe('learned');
  expect(discovery.inspect('newsfeed.replaced',{response:{items:[{is_ad:1}]}})).toBe(false);
  expect(discovery.consider('newsfeed.replaced')).toBeNull();
  vi.advanceTimersByTime(60_001);
  expect(discovery.consider('newsfeed.replaced')).toBe('probe');
  expect(discovery.consider('newsfeed.overBudget')).toBe('probe');
});

it('deduplicates and caps local method-only diagnostics', () => {
  const log=vi.fn(), discovery=createFeedDiscovery(log);
  for(let i=0;i<200;i++) discovery.report('newsfeed.next','unsupported-shape');
  expect(log).toHaveBeenCalledTimes(1);
  for(let i=0;i<200;i++) discovery.report(`newsfeed.next${i}`,'unsupported-shape');
  expect(log.mock.calls.length).toBeLessThanOrEqual(96);
  expect(log.mock.calls[0]).toEqual([{method:'newsfeed.next',reason:'unsupported-shape'}]);
});

it('does not let stale prefetch entries impose a network cooldown or revoke a learned method', () => {
  const discovery=createFeedDiscovery();
  for(let i=0;i<10;i++) expect(discovery.inspect('newsfeed.next',{},false)).toBe(false);
  expect(discovery.consider('newsfeed.next')).toBe('probe');
  expect(discovery.inspect('newsfeed.next',feed)).toBe(true);
  expect(discovery.inspect('newsfeed.next',{},false)).toBe(false);
  expect(discovery.consider('newsfeed.next')).toBe('learned');
});

it('reads a bounded cloned response while leaving the original available to VK', async () => {
  const response=new Response(JSON.stringify(feed));
  expect(await readFeedProbe(response)).toEqual(feed);
  expect(await response.json()).toEqual(feed);
});

it('skips declared oversize bodies before cloning and also caps bodies without a length header', async () => {
  const declared=new Response('{}',{headers:{'content-length':String(FEED_PROBE_MAX_BYTES+1)}});
  const clone=vi.spyOn(declared,'clone');
  expect(await readFeedProbe(declared)).toBeUndefined();
  expect(clone).not.toHaveBeenCalled();
  const text=JSON.stringify({payload:'x'.repeat(FEED_PROBE_MAX_BYTES)}), response=new Response(text);
  expect(await readFeedProbe(response)).toBeUndefined();
  expect(await response.text()).toBe(text);
});

it('releases a slow cloned stream at the deadline without waiting for the original consumer', async () => {
  vi.useFakeTimers();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const response=new Response(new ReadableStream<Uint8Array>({start(value){controller=value;}}));
  const pending=readFeedProbe(response);
  await vi.advanceTimersByTimeAsync(101);
  expect(await pending).toBeUndefined();
  controller.enqueue(new TextEncoder().encode(JSON.stringify(feed))); controller.close();
  expect(await response.json()).toEqual(feed);
});
