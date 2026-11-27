import { build } from './esbuild-fixture.js';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { AVATAR_ROUNDING_CSS } from '../src/content/features/appearance/theme/avatar-rounding-styles.js';

test('SVG avatars and empty accessible avatars follow shape without component selectors', async ({ page }) => {
  await page.setContent(`<style>:root{--vkify-avatar-radius:12%}</style>
    <div role="img" aria-label="User" style="width:48px;height:48px;border-radius:50%;background:#789"></div>
    <svg width="48" height="48"><defs><clipPath id="native-circle"><circle cx="24" cy="24" r="24"/></clipPath></defs>
    <g clip-path="url(#native-circle)"><image width="48" height="48" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='blue'/%3E%3C/svg%3E"/></g></svg>`);
  await page.addStyleTag({ content: AVATAR_ROUNDING_CSS });
  const bundle = await build({ stdin:{resolveDir:process.cwd(),contents: "import {observeAvatarSurfaces} from './src/content/features/appearance/theme/avatar-surfaces.ts'; window.stopAvatars=observeAvatarSurfaces();"},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')} });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await expect(page.getByRole('img', { name: 'User' })).toHaveCSS('border-radius', '12%');
  await expect(page.locator('g')).toHaveCSS('clip-path', 'inset(0px round 12%)');
  await page.evaluate(() => (window as any).stopAvatars());
  await expect(page.getByRole('img', { name: 'User' })).toHaveCSS('border-radius', '50%');
  await expect(page.locator('g')).toHaveCSS('clip-path', 'url("#native-circle")');
});

test('current VK story cutouts follow avatar shape and retain their paint', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 180 });
  await page.setContent(`<style>
    :root { --vkify-avatar-radius: 0 50% 0 50%; }
    .avatar { position:relative; width:96px; height:96px; margin:30px; }
    img { border-radius:50%; width:96px; height:96px; background:#3895df; }
    .ring { position:absolute; width:108px; height:108px; left:-6px; top:-6px;
      background:linear-gradient(45deg, #8657ff, #ff9944); }
    </style>
    <div id="avatar" class="avatar"><img><template id="story"><div>
      <div id="ring" class="ring"
        style="--vkui_internal--rich_avatar_outline_width:3px; clip-path:path(evenodd, 'M 54 0 a 54 54 0 1 0 0 108 a 54 54 0 1 0 0 -108 Z M 54 3 a 51 51 0 1 0 0 102 a 51 51 0 1 0 0 -102 Z')"></div>
    </div></template><div aria-hidden="true"></div></div>`);
  await page.addStyleTag({ content: AVATAR_ROUNDING_CSS });
  const bundle = await build({ stdin:{resolveDir:process.cwd(),contents: "import {observeAvatarSurfaces} from './src/content/features/appearance/theme/avatar-surfaces.ts'; window.stopAvatars=observeAvatarSurfaces();"},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')} });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await expect(page.locator('img')).toHaveAttribute('data-vkify-avatar-surface', '');
  // VK loads the story outline after the avatar itself has mounted.
  await page.evaluate(() => {
    const template = document.querySelector<HTMLTemplateElement>('#story')!;
    template.replaceWith(template.content.cloneNode(true));
  });
  const ring = page.locator('#ring');
  const nativePath = await ring.evaluate(el => el.style.clipPath);
  await expect(ring).toHaveCSS('clip-path', 'none');
  await expect(ring).toHaveCSS('border-radius', '0px 50%');
  await expect(page.locator('img')).toHaveCSS('border-radius', '0px 50%');
  await expect(ring).toHaveCSS('mask-composite', 'exclude, exclude');
  await expect(ring).toHaveCSS('padding', '3px');
  await expect(ring).toHaveCSS('width', '108px');
  await expect(ring).toHaveCSS('background-image', 'linear-gradient(45deg, rgb(134, 87, 255), rgb(255, 153, 68))');
  await page.locator('#avatar').evaluate(el => el.classList.add('story-loaded'));
  await expect(ring).toHaveAttribute('data-vkify-avatar-ring', '');
  await expect(ring).toHaveCSS('clip-path', 'none');
  await ring.evaluate(el => el.style.color = 'rgb(120, 80, 200)');
  await expect(ring).toHaveCSS('color', 'rgb(120, 80, 200)');
  await expect(ring).toHaveCSS('clip-path', 'none');
  await page.screenshot({ path: 'test-results/avatar-story-ring.png' });
  // Removing the feature restores VK's original circular cutout.
  await page.evaluate(() => (window as any).stopAvatars());
  await page.locator('style').last().evaluate(el => el.remove());
  expect(await ring.evaluate(el => el.style.clipPath)).toBe(nativePath);
  await expect(ring).toHaveCSS('clip-path', /^path\(/);
  await expect(ring).toHaveCSS('mask-image', 'none');
});


test('messenger shared masks follow shape while counters and icons keep native paint', async ({ page }) => {
  await page.setContent(`<style>
    :root{--vkify-avatar-radius:0 50% 0 50%}
    figure{margin:0;width:48px;height:48px;position:relative}
    .wrapper,.photo{width:48px;height:48px}
    .photo img{width:48px;height:48px}
    .counter{width:18px;height:18px;border-radius:50%;background:red}
    .icon{display:block;width:20px;height:20px;border-radius:50%}
  </style>
  <svg width="0" height="0"><defs>
    <circle id="offline" cx="24" cy="24" r="24"/>
    <path id="online" d="M44.65 36.2375C46.7781 32.6543 48 28.4699 48 24 48 10.7452 37.2548 0 24 0S0 10.7452 0 24s10.7452 24 24 24c4.4699 0 8.6543-1.2219 12.2375-3.35C35.4614 43.6388 35 42.3733 35 41c0-3.3137 2.6863-6 6-6 1.3733 0 2.6388.4614 3.65 1.2375Z"/>
  </defs></svg>
  <div role="tab">All <div id="counter" role="img" aria-label="Unread" class="counter">6</div></div>
  <i id="icon" role="img" class="icon"><svg width="20" height="20"><path d="M0 0h20v20H0z"/></svg></i>
  <figure><div id="offline-wrap" class="wrapper" style="clip-path:url(#offline-mask)"><div class="photo"><img id="offline-photo" alt="Community"></div></div><svg><clipPath id="offline-mask"><use href="#offline"/></clipPath></svg></figure>
  <figure id="placeholder"><div id="placeholder-wrap" class="wrapper" style="clip-path:url(#offline-mask)"><div style="width:48px;height:48px;border-radius:50%;background:#789"><svg width="24" height="24"><path d="M0 0h24v24H0z"/></svg></div></div></figure>
  <figure><div id="online-wrap" class="wrapper" style="clip-path:url(#online-mask)"><div class="photo"><img id="online-photo" alt="User"></div></div><span id="online-badge" style="position:absolute;right:0;bottom:0;width:8px;height:8px;border-radius:50%;background:green"></span><svg><clipPath id="online-mask"><use href="#online"/></clipPath></svg></figure>`);
  await page.addStyleTag({ content: AVATAR_ROUNDING_CSS });
  const bundle = await build({ stdin:{resolveDir:process.cwd(),contents: "import {observeAvatarSurfaces} from './src/content/features/appearance/theme/avatar-surfaces.ts'; window.stopAvatars=observeAvatarSurfaces();"},bundle:true,write:false,format:'iife' });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  for (const id of ['offline','online']) {
    await expect(page.locator('#'+id+'-wrap')).toHaveCSS('clip-path','inset(0px round 0px 50%)');
    await expect(page.locator('#'+id+'-photo')).toHaveCSS('border-radius','0px 50%');
  }
  await expect(page.locator('#placeholder-wrap')).toHaveCSS('clip-path','inset(0px round 0px 50%)');
  await expect(page.locator('#placeholder svg')).not.toHaveAttribute('data-vkify-avatar-surface');
  await expect(page.locator('#counter')).not.toHaveAttribute('data-vkify-avatar-surface');
  await expect(page.locator('#counter')).toHaveCSS('border-radius','50%');
  await expect(page.locator('#icon')).not.toHaveAttribute('data-vkify-avatar-surface');
  await expect(page.locator('#online-badge')).toHaveCSS('border-radius','50%');
  await page.evaluate(() => (window as any).stopAvatars());
  await expect(page.locator('#offline-wrap')).toHaveCSS('clip-path','url("#offline-mask")');
  await expect(page.locator('#online-wrap')).toHaveCSS('clip-path','url("#online-mask")');
});
