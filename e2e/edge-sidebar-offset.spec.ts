import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { resolve } from 'node:path';

for (const browserBuild of ['chrome', 'firefox']) test(`${browserBuild}: page offset moves toward either edge sidebar with a 16px minimum gutter`, async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile(`dist/${browserBuild}/styles/features.css`, 'utf8');
    await page.setContent(`<style>
      * { box-sizing:border-box } body { margin:0 }
      #page_header_cont { position:fixed; inset:0 0 auto }
      #page_header, #page_layout, #footer_wrap { position:relative; width:1108px; margin:auto }
      #page_header { height:48px; background:#334455 }
      #page_layout { height:300px; background:#ddeeff }
      #layout_sidebar { width:164px }
      #footer_wrap { height:40px; background:#aabbcc }
      ${css}
    </style><div id="layout_wrapper_root"><div id="page_header_cont"><div class="TopNavigationWrapper__outer"><header id="page_header">Header</header></div></div><main id="page_layout"><aside id="layout_sidebar">Menu</aside>Content</main><footer id="footer_wrap">Footer</footer></div>`);
    const bundle = await build({ stdin:{resolveDir:process.cwd(),contents:`
      import {pageOffsetShift} from './src/content/features/appearance/layout/page-offset.ts';
      window.setFixtureOffset = value => document.documentElement.style.setProperty('--vkify-page-shift',pageOffsetShift(value));
    `}, bundle:true, write:false, format:'iife', alias:{'@':resolve('src')}, define:{'import.meta.env.DEV':'false'} });
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.locator('html').evaluate(el => { el.setAttribute('data-vkify-edge_sidebar',''); el.setAttribute('data-vkify-page_offset',''); });
    for (const viewport of [900,1600,1920]) {
      await page.setViewportSize({width:viewport,height:800});
      for (const contentWidth of [0,900,1108]) for (const railWidth of [0,280]) for (const right of [false,true]) for (const staticHeader of [false,true]) {
        await page.locator('html').evaluate((el, config) => {
          const root=el as HTMLElement;
          if(config.contentWidth) root.style.setProperty('--vkify-cw',`${config.contentWidth}px`);
          else root.style.removeProperty('--vkify-cw');
          if(config.railWidth) root.style.setProperty('--vkify-edge-custom-width',`${config.railWidth}px`);
          else root.style.removeProperty('--vkify-edge-custom-width');
          root.toggleAttribute('data-vkify-sidebar_right',config.right);
          root.toggleAttribute('data-vkify-static_header',config.staticHeader);
        },{contentWidth,railWidth,right,staticHeader});
        const positions: number[]=[];
        for (const slider of [0,50,100]) {
          await page.evaluate(value => (window as any).setFixtureOffset(value),slider);
          const geometry=await page.evaluate(() => {
            const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect().toJSON();
            return {rail:rect('#layout_sidebar'),blocks:['#page_layout','#page_header','#footer_wrap'].map(rect)};
          });
          const start=right?0:geometry.rail.right+16;
          const end=right?geometry.rail.left-16:viewport;
          for(const box of geometry.blocks) {
            expect(box.left).toBeGreaterThanOrEqual(start-0.1);
            expect(box.right).toBeLessThanOrEqual(end+0.1);
            if(slider===0) expect(box.left).toBeCloseTo(start,1);
            if(slider===100) expect(box.right).toBeCloseTo(end,1);
            if(slider===50) expect((box.left+box.right)/2).toBeCloseTo((start+end)/2,1);
          }
          expect(right?geometry.rail.right:geometry.rail.left).toBe(right?viewport:0);
          positions.push(geometry.blocks[0].left);
        }
        expect(positions[0]).toBeLessThanOrEqual(positions[1]);
        expect(positions[1]).toBeLessThanOrEqual(positions[2]);
        if(viewport===1920) expect(positions[2]-positions[0]).toBeGreaterThan(100);
      }
    }
  } finally { await browser.close(); }
});
