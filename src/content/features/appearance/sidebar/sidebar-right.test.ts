// @vitest-environment happy-dom
import {it,expect} from 'vitest';
import {rightChatPlugin} from './sidebar-right.js';
import type {ScopedFeatureContext} from '@/content/core/features/scoped-context.js';
it('follows VK chat offsets and restores untouched native geometry',async()=>{
  document.body.innerHTML='<div class="FCApp"><div class="FCWindow" style="position:fixed;right:90px;bottom:0"></div></div>';
  let mount:(element:Element)=>void=()=>{};
  const stop=rightChatPlugin.setup!({registerMutationObserver:(_selector:string,callback:(element:Element)=>void)=>{mount=callback;mount(document.querySelector('.FCWindow')!);return ()=>{};}} as unknown as ScopedFeatureContext);
  const window=document.querySelector<HTMLElement>('.FCWindow')!;
  expect(window.style.getPropertyValue('--vkify-chat-left')).toBe('90px');
  expect(window.style.right).toBe('90px');
  window.style.right='380px';
  await new Promise(resolve=>setTimeout(resolve,0));
  expect(window.style.getPropertyValue('--vkify-chat-left')).toBe('380px');
  const second=document.createElement('div');second.className='FCWindow';second.style.right='670px';document.querySelector('.FCApp')!.append(second);mount(second);
  expect(second.style.getPropertyValue('--vkify-chat-left')).toBe('670px');
  if(typeof stop==='function')stop();
  expect(window.style.right).toBe('380px');expect(window.style.getPropertyValue('--vkify-chat-left')).toBe('');
  expect(second.style.right).toBe('670px');expect(second.style.getPropertyValue('--vkify-chat-left')).toBe('');
});
