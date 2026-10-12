import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('compact top audio player keeps its inline VKUI block and active background inside the header', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/appearance/header/compact-header.css', 'utf8');
    // Structural markup supplied by the user: title block carries inline 48px,
    // playback controls are siblings of the main tappable, not TopNavBtn nodes.
    await page.setContent(`<!DOCTYPE html><html data-vkify-compact_header><head><style>
      body { margin:0; } #layout_wrapper_root { --header-height:48px; }
      #page_header_cont { height:var(--header-height); }
      #page_header { display:flex;align-items:center;margin:0;padding:0;height:48px;list-style:none; }
      .vkit-tLeOku { position:relative; }
      .vkui-block-size { block-size:var(--vkui_internal--block-size);display:flex;align-items:center;padding-left:100px; }
      .vkuiInternalTappable { position:relative; }
      .vkuiInternalTappable > [aria-hidden] { position:absolute;inset:0;pointer-events:none; }
      .vkuiInternalTappable:hover > [aria-hidden] { background:rgba(100,50,200,.2); }
      .vkit-7g1fNW { position:absolute;top:0;left:0;height:100%;display:flex;align-items:center; }
      .vkit-7g1fNW button { height:24px; }
      ${css}
    </style></head><body><div id="layout_wrapper_root"><div id="page_header_cont"><div id="page_header_wrap"><ul id="page_header"><li>
      <div data-testid="TopAudioPlayer"><div class="vkit-tLeOku">
        <div class="vkuiInternalTappable" role="button" tabindex="0" aria-expanded="false" aria-label="Аудиоплеер">
          <div class="vkui-padding-inline-start vkui-padding-inline-end-m vkui-block-size" style="--vkui_internal--row_gap: 0px; --vkui_internal--column_gap: 0px; --vkui_internal--padding-inline-start: 100px; --vkui_internal--block-size: 48px;">
            <div data-testid="TopAudioPlayer_Title">DRXSTXNE — KXLLA DXNCE</div>
          </div><span aria-hidden="true" id="active-background"></span>
        </div>
        <div class="vkui-padding-inline-start-m vkit-7g1fNW">
          <button data-testid="TopAudioPlayer_BackwardAction">Previous</button>
          <button data-testid="TopAudioPlayer_TogglePlayAction">Play</button>
          <button data-testid="TopAudioPlayer_ForwardAction">Next</button>
        </div>
      </div></div>
    </li></ul></div></div></div></body></html>`);
    await page.getByRole('button', { name: 'Аудиоплеер', exact: true }).hover();
    for (const selector of ['[data-testid="TopAudioPlayer"]', '[aria-label="Аудиоплеер"]', '.vkui-block-size', '#active-background']) {
      await expect(page.locator(selector)).toHaveCSS('height', '40px');
      expect(await page.locator(selector).evaluate(el => {
        const rect = el.getBoundingClientRect(), header = document.querySelector('#page_header_cont')!.getBoundingClientRect();
        return rect.top >= header.top && rect.bottom <= header.bottom;
      })).toBe(true);
    }
    for (const action of ['Backward', 'TogglePlay', 'Forward']) {
      await expect(page.getByTestId(`TopAudioPlayer_${action}Action`)).toHaveCSS('height', '24px');
    }
    await page.getByTestId('TopAudioPlayer_TogglePlayAction').click();
    // The override follows a new inline write and disappears when disabled.
    await page.locator('.vkui-block-size').evaluate(el => (el as HTMLElement).style.setProperty('--vkui_internal--block-size', '48px'));
    await expect(page.locator('.vkui-block-size')).toHaveCSS('height', '40px');
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-compact_header'));
    await expect(page.locator('.vkui-block-size')).toHaveCSS('height', '48px');
    await expect(page.locator('#active-background')).toHaveCSS('height', '48px');
  } finally { await browser.close(); }
});
