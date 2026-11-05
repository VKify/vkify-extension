import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { MINI_PLAYER_CSS } from '../src/content/features/center/music/playback/mini-player/styles';

test('profile audio columns fill the widened music tab', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const css = await readFile('src/content/features/appearance/layout/widescreen.css', 'utf8');
    await page.setContent(`<style>
      .rows { display:flex; } .vkui-inline-size { width:var(--vkui_internal--inline-size); flex-shrink:0; }
      .row { padding:0 16px; } .track { display:grid; grid-template-columns:52px minmax(0,1fr) 0px 40px; }
      .actions { display:none; } .row:hover .actions { display:flex; } .actions button { width:30px; flex-shrink:0; }
      ${css}
      </style><section data-testid="owner_content_tab_audios"><div class="rows">
      ${[0,1].map(() => '<div class="vkui-inline-size" style="--vkui_internal--inline-size:274px"><div data-testid="audio-item"><div class="row" data-testid="MusicTrackRow"><div><div class="track"><div>Art</div><div><div data-testid="MusicTrackRow_Info">Track</div></div><div class="actions"><button>×</button><button>↓</button><button>≡</button></div><div>3:09</div></div></div></div></div></div>').join('')}
      </div></section>`);
    await page.locator('html').evaluate(el => el.setAttribute('data-vkify-content_width', ''));
    for (const width of [260, 480, 550, 700, 1000, 1300]) {
      await page.getByTestId('owner_content_tab_audios').evaluate((el, w) => el.style.width = `${w}px`, width);
      const widths = await page.getByTestId('audio-item').evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
      const column = width < 600 ? width : width / 2;
      expect(widths).toEqual([column, column]);
      for (const row of await page.getByTestId('MusicTrackRow').all()) {
        await row.hover();
        const fits = await row.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          return [...el.querySelectorAll('button')].every(btn => {
            const b = btn.getBoundingClientRect(); return b.left >= bounds.left && b.right <= bounds.right;
          });
        });
        expect(fits).toBe(true);
      }
    }
    await page.locator('html').evaluate(el => el.removeAttribute('data-vkify-content_width'));
    expect(await page.getByTestId('audio-item').first().evaluate(el => el.getBoundingClientRect().width)).toBe(274);
  } finally { await browser.close(); }
});

test('collapsed player controls fit inside the pill without overlapping', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const source = await readFile('src/content/ui/floating-widget.ts', 'utf8');
    const base = source.match(/const FW_CSS = `([\s\S]*?)`;/)![1].replace('${Z_BASE}', '1000');
    const icon = '<svg width="16" height="16"></svg>';
    await page.setContent(`<style>${base}${MINI_PLAYER_CSS}</style>
      <div class="vkify-fw vkify-mini is-collapsed is-pill" style="width:340px">
      <div class="vkify-fw__head"><span class="vkify-fw__grip">Grip</span><span class="vkify-fw__title">Player</span>
      <span class="vkify-fw__aux"><div class="mp-compact"><div class="mp-thumb-box">Art</div><div class="mp-copy">Track</div>
      <div class="mp-compact-controls">${[0,1,2].map(() => `<button>${icon}</button>`).join('')}</div></div></span>
      <button class="vkify-fw__btn">${icon}</button><button class="vkify-fw__btn">${icon}</button><button class="vkify-fw__btn" data-stack-toggle>${icon}</button></div></div>`);
    for (const pill of [true, false]) {
      await page.locator('.vkify-mini').evaluate((el, value) => el.classList.toggle('is-pill', value), pill);
      for (const zoom of [1, 1.25, 1.5]) {
        await page.locator('.vkify-mini').evaluate((el, value) => el.style.zoom = String(value), zoom);
        const boxes = await page.locator('.vkify-mini').evaluate(root => {
          const rect = (el: Element) => { const b = el.getBoundingClientRect(); return { left:b.left, right:b.right }; };
          return { root:rect(root), items:[...root.querySelectorAll('.mp-thumb-box, button')].map(rect) };
        });
        for (let i = 0; i < boxes.items.length; i++) {
          expect(boxes.items[i].left).toBeGreaterThanOrEqual(boxes.root.left);
          expect(boxes.items[i].right).toBeLessThanOrEqual(boxes.root.right);
          if (i) expect(boxes.items[i].left).toBeGreaterThanOrEqual(boxes.items[i-1].right);
        }
        for (const button of await page.locator('.vkify-fw__btn').all()) {
          await button.hover();
          const offset = await button.evaluate(el => {
            const b=el.getBoundingClientRect(), s=el.querySelector('svg')!.getBoundingClientRect();
            return { x:Math.abs((b.left+b.right-s.left-s.right)/2), y:Math.abs((b.top+b.bottom-s.top-s.bottom)/2) };
          });
          expect(offset.x).toBeLessThan(1);
          expect(offset.y).toBeLessThan(1);
        }
      }
    }
  } finally { await browser.close(); }
});

test('friend cells fill narrow sidebars and keep avatars centered', async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/appearance/layout/widescreen.css','utf8');
    await page.setContent(`<style>
      section { box-sizing:border-box;padding:8px; }
      .friends { display:flex;flex-wrap:wrap;padding:0; } .friend { width:80px;max-width:80px; }
      a { display:block;width:80px;max-width:80px; } .avatar-wrap { width:64px;padding:4px 8px; }
      .avatar { width:64px;height:64px;flex-shrink:0;background:gray; } ${css}
      </style><section data-testid="profile-friends-block"><div class="friends">
      ${Array.from({length:6},(_,i)=>`<div class="friend"><a data-testid="profile-friends-list"><div class="avatar-wrap"><div class="avatar"></div></div><span>Friend ${i}</span></a></div>`).join('')}
      </div></section>`);
    await page.locator('html').evaluate(el=>el.setAttribute('data-vkify-content_width',''));
    for (const width of [200,240,280,345]) {
      await page.getByTestId('profile-friends-block').evaluate((el,w)=>el.style.width=`${w}px`,width);
      const geometry=await page.getByTestId('profile-friends-list').evaluateAll(els=>els.map(el=>{
        const b=el.getBoundingClientRect(),a=el.querySelector('.avatar')!.getBoundingClientRect();
        return {left:b.left,right:b.right,top:b.top,center:Math.abs((b.left+b.right-a.left-a.right)/2),
          insetLeft:a.left-b.left,insetRight:b.right-a.right,ratio:Math.abs(a.width-a.height)};
      }));
      const columns=width===200?2:3;
      expect(geometry.filter(b=>b.top===geometry[0].top)).toHaveLength(columns);
      for(const b of geometry) {
        expect(b.center).toBeLessThan(1);
        expect(b.insetLeft).toBeGreaterThanOrEqual(4);
        expect(b.insetRight).toBeGreaterThanOrEqual(4);
        expect(b.ratio).toBeLessThan(1);
      }
      const block=await page.getByTestId('profile-friends-block').boundingBox();
      const leftGap=geometry[0].left-block!.x;
      const rightGap=block!.x+block!.width-geometry[columns-1].right;
      expect(leftGap).toBeGreaterThanOrEqual(16);
      expect(rightGap).toBeGreaterThanOrEqual(16);
      expect(Math.abs(leftGap-rightGap)).toBeLessThan(1);
      for(let i=1;i<columns;i++) expect(geometry[i].left).toBeGreaterThanOrEqual(geometry[i-1].right);
    }
  } finally { await browser.close(); }
});
