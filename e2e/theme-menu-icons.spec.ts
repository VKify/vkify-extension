import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('theme keeps menu icons above opaque VKUI selection and hover layers', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH || undefined });
  const page = await browser.newPage();
  const theme = await readFile('src/content/features/appearance/theme/theme.css', 'utf8');
  // Relevant VK Видео rules: the menu resets before's stacking level,
  // while the text stays above the state layer. Use stable VKUI classes.
  await page.setContent(`
    <style>
      :root { --vkui_internal--z_index_tappable_state: 0; --vkui_internal--z_index_tappable_element: 1; }
      .vkuiTappable__host { display:flex; position:relative; width:240px; height:48px; }
      .vkuiSimpleCell__before, .vkuiSimpleCell__after { position:relative; z-index:1; width:48px; display:grid; place-items:center; }
      .video-menu .vkuiCell__content .vkuiSimpleCell__before { z-index:unset; }
      .vkuiSimpleCell__middle { position:relative; z-index:1; flex:1; }
      .vkuiTappable__stateLayer { position:absolute; inset:0; z-index:var(--vkui_internal--z_index_tappable_state); }
      .vkuiTappable__activatedBackground > .vkuiTappable__stateLayer { background-color:var(--vkui--color_transparent--active); }
      .vkuiTappable__hoveredBackground > .vkuiTappable__stateLayer { background-color:var(--vkui--color_transparent--hover); }
      svg { color:var(--vkui--color_icon_primary); }
    </style>
    <nav class="video-menu"><a class="vkuiCell__content vkuiTappable__host">
      <div class="vkuiSimpleCell__before"><svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor"><path d="M4 12 L14 3 L24 12 V25 H4Z"/></svg></div>
      <div class="vkuiSimpleCell__middle">Главная</div>
      <div class="vkuiSimpleCell__after"><svg width="28" height="28" fill="currentColor"><rect x="8" y="8" width="12" height="12"/></svg></div>
      <span class="vkuiTappable__stateLayer"></span>
    </a></nav>
  `);
  const style = await page.addStyleTag({ content: theme });
  try {
    for (const bg of ['#0d1d2c', '#ffffff', '#371c40']) {
      for (const state of ['activated', 'hovered']) {
        await page.evaluate(({ bg, state }) => {
          const root = document.documentElement;
          root.dataset.vkifyTheme = 'true';
          root.dataset.vkifyAccent = 'true';
          root.style.setProperty('--vkify-n15-solid', bg);
          root.style.setProperty('--vkify-n22', bg);
          root.style.setProperty('--vkify-n29', bg);
          root.style.setProperty('--vkify-accent', '#82c8e3');
          document.querySelector('a')!.className = `vkuiCell__content vkuiTappable__host vkuiTappable__${state}Background`;
        }, { bg, state });
        for (const slot of ['before', 'after']) {
          const container = page.locator(`.vkuiSimpleCell__${slot}`);
          const icon = page.locator(`.vkuiSimpleCell__${slot} svg`);
          const visible = await container.screenshot();
          await icon.evaluate(el => { (el as SVGElement).style.visibility = 'hidden'; });
          const hidden = await container.screenshot();
          expect(visible.equals(hidden), `${bg}: ${state} ${slot} icon must be painted`).toBe(false);
          await icon.evaluate(el => { (el as SVGElement).style.visibility = ''; });
        }
      }
    }
    // Reproduce the original failure by removing only the stacking fix.
    await style.evaluate(el => { el.textContent = el.textContent!.replace(/\[data-vkify-theme\] \.vkuiTappable__host > \.vkuiSimpleCell__before,[\s\S]*?\n\}/, ''); });
    const icon = page.locator('.vkuiSimpleCell__before svg');
    const container = page.locator('.vkuiSimpleCell__before');
    const covered = await container.screenshot();
    await icon.evaluate(el => { (el as SVGElement).style.visibility = 'hidden'; });
    expect(covered.equals(await container.screenshot()), 'original theme covers the icon completely').toBe(true);
  } finally {
    await browser.close();
  }
});
