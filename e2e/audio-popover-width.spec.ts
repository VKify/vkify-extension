import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('base CSS widens the current music popover without appearance flags or changing other dialogs', async ({ page }) => {
  const css = await readFile('public/styles/content.css', 'utf8');
  // Current VK popover has inline 660px constraints and no test IDs.
  const controls = `<button><svg class="vkuiIcon--shuffle_outline_24"></svg>Shuffle</button><div role="slider" aria-valuemin="0" aria-valuemax="1"></div><input type="search">`;
  await page.setContent(`<style>
    body{margin:0} [role=dialog]{box-sizing:border-box;background:#252a32}
    #music{position:fixed;left:16px;top:48px}
    #controls{display:flex;align-items:center;gap:12px;padding:12px;box-sizing:border-box}
    #controls>div{flex:1;min-width:0} #controls>button{flex:none;width:28px;height:28px}
    ${css}
  </style>
  <div id="music" role="dialog" class="new-vk-hash" style="min-width:660px;max-width:660px">
    <div id="controls"><button>Play</button><div>Track title</div><button>Download</button><button>EQ</button><button>Share</button></div>${controls}
  </div>
  <div id="other" role="dialog" style="width:300px;min-width:300px;max-width:300px"><input type="search"></div>
  <section id="page-player" style="width:900px">${controls}</section>`);
  for (const width of [1600, 900, 710, 480]) {
    await page.setViewportSize({ width, height:900 });
    await expect(page.locator('#music')).toHaveCSS('width', Math.min(750, width-32)+'px');
    expect(await page.locator('#music').evaluate(el => {
      const bounds=el.getBoundingClientRect();
      return bounds.left>=0 && bounds.right<=window.innerWidth && [...el.querySelectorAll('#controls button')].every(button=>{
        const rect=button.getBoundingClientRect();return rect.left>=bounds.left && rect.right<=bounds.right;
      });
    })).toBe(true);
    await expect(page.locator('#other')).toHaveCSS('width','300px');
    await expect(page.locator('#page-player')).toHaveCSS('width','900px');
  }
  await page.locator('#music').evaluate(el=>el.replaceWith(el.cloneNode(true)));
  await expect(page.locator('#music')).toHaveCSS('width','448px');
});
