import { test, expect } from '@playwright/test';
import { AVATAR_ROUNDING_CSS } from '../src/content/features/appearance/theme/avatar-rounding-styles.js';

test('current VK story cutouts follow avatar shape and retain their paint', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 180 });
  await page.setContent(`<style>
    :root { --vkify-avatar-radius: 0 50% 0 50%; }
    .avatar { position:relative; width:96px; height:96px; margin:30px; }
    img { width:96px; height:96px; background:#3895df; }
    .ring { position:absolute; width:108px; height:108px; left:-6px; top:-6px;
      background:linear-gradient(45deg, #8657ff, #ff9944); }
    </style>
    <div id="community_avatar_test" class="avatar"><img><div>
      <div id="ring" class="ring" data-testid="richavatar-outline-stroke_accent"
        style="--vkui_internal--rich_avatar_outline_width:3px; clip-path:path(evenodd, 'M 54 0 a 54 54 0 1 0 0 108 a 54 54 0 1 0 0 -108 Z M 54 3 a 51 51 0 1 0 0 102 a 51 51 0 1 0 0 -102 Z')"></div>
    </div><div aria-hidden="true"></div></div>`);
  const ring = page.locator('#ring');
  const nativePath = await ring.evaluate(el => getComputedStyle(el).clipPath);
  await page.addStyleTag({ content: AVATAR_ROUNDING_CSS });
  await expect(ring).toHaveCSS('clip-path', 'none');
  await expect(ring).toHaveCSS('border-radius', '0px 50%');
  await expect(page.locator('img')).toHaveCSS('border-radius', '0px 50%');
  await expect(ring).toHaveCSS('mask-composite', 'exclude, exclude');
  await expect(ring).toHaveCSS('padding', '3px');
  await expect(ring).toHaveCSS('width', '108px');
  await expect(ring).toHaveCSS('background-image', 'linear-gradient(45deg, rgb(134, 87, 255), rgb(255, 153, 68))');
  await page.screenshot({ path: 'test-results/avatar-story-ring.png' });
  // Removing the feature restores VK's original circular cutout.
  await page.locator('style').last().evaluate(el => el.remove());
  await expect(ring).toHaveCSS('clip-path', nativePath);
  await expect(ring).toHaveCSS('mask-image', 'none');
});
