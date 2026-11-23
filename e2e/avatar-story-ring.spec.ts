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
    <div id="avatar" class="avatar"><img><div>
      <div id="ring" class="ring"
        style="--vkui_internal--rich_avatar_outline_width:3px; clip-path:path(evenodd, 'M 54 0 a 54 54 0 1 0 0 108 a 54 54 0 1 0 0 -108 Z M 54 3 a 51 51 0 1 0 0 102 a 51 51 0 1 0 0 -102 Z')"></div>
    </div><div aria-hidden="true"></div></div>`);
  const ring = page.locator('#ring');
  const nativePath = await ring.evaluate(el => getComputedStyle(el).clipPath);
  await page.addStyleTag({ content: AVATAR_ROUNDING_CSS });
  const bundle = await build({ stdin:{resolveDir:process.cwd(),contents: "import {observeAvatarSurfaces} from './src/content/features/appearance/theme/avatar-surfaces.ts'; window.stopAvatars=observeAvatarSurfaces();"},bundle:true,write:false,format:'iife',alias:{'@':resolve('src')} });
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await expect(ring).toHaveCSS('clip-path', 'none');
  await expect(ring).toHaveCSS('border-radius', '0px 50%');
  await expect(page.locator('img')).toHaveCSS('border-radius', '0px 50%');
  await expect(ring).toHaveCSS('mask-composite', 'exclude, exclude');
  await expect(ring).toHaveCSS('padding', '3px');
  await expect(ring).toHaveCSS('width', '108px');
  await expect(ring).toHaveCSS('background-image', 'linear-gradient(45deg, rgb(134, 87, 255), rgb(255, 153, 68))');
  await page.screenshot({ path: 'test-results/avatar-story-ring.png' });
  // Removing the feature restores VK's original circular cutout.
  await page.evaluate(() => (window as any).stopAvatars());
  await page.locator('style').last().evaluate(el => el.remove());
  await expect(ring).toHaveCSS('clip-path', nativePath);
  await expect(ring).toHaveCSS('mask-image', 'none');
});
