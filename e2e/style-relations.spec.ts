import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installStyleRelations } from './style-relations-fixture.js';

test('hashed layout, logo and profile ancestors retain their CSS behavior across replacements', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = (await Promise.all([
      'src/content/features/appearance/sidebar/edge-sidebar.css',
      'src/content/features/appearance/sidebar/minimalistic-sidebar.css',
      'src/content/features/hiding/profile/hide-right-column.css',
    ].map(file => readFile(file, 'utf8')))).join('\n');
    await page.setContent(`<html data-vkify-minimalistic_sidebar data-vkify-hide_profile_right_column><style>${css}</style><body>
      <header id="page_header_cont"><div id="page_header"><div class="TopNavigation__logo--first"><a class="Logo__root--first"><svg class="Logo__icon--first"></svg></a></div></div></header>
      <div id="page_layout"><div class="LayoutWrapper__body--first"><main class="LayoutWrapper__content--first" style="width:123px"></main></div></div>
      <section id="profile"><header data-testid="profile-header">Profile</header><aside class="ScrollStickyWrapper">Narrow</aside></section>
      <div class="ProfileSkeleton__layout--first"><div>Wide</div><div id="skeleton-narrow">Narrow</div></div>
    </body></html>`);
    await installStyleRelations(page);
    await expect(page.locator('[class*="Logo__root"]')).toHaveCSS('display', 'grid');
    await expect(page.locator('.ScrollStickyWrapper')).toBeHidden();
    await expect(page.locator('#skeleton-narrow')).toBeHidden();
    await page.locator('[data-testid="profile-header"]').evaluate(element => element.remove());
    await expect(page.locator('.ScrollStickyWrapper')).toBeVisible();
    await page.locator('[class*="ProfileSkeleton__layout"]').evaluate(element => element.className = 'ordinary-layout');
    await expect(page.locator('#skeleton-narrow')).toBeVisible();
    await page.locator('[class*="TopNavigation__logo"]').evaluate(element => element.className = 'ordinary-logo');
    await expect(page.locator('[class*="Logo__root"]')).not.toHaveCSS('display', 'grid');
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-edge_sidebar', ''));
    const content = page.locator('main');
    await expect(content).not.toHaveCSS('width', '123px');
    await page.locator('#page_layout > div').evaluate(element => element.className = 'ordinary-body');
    await expect(content).toHaveCSS('width', '123px');
    await page.locator('#page_layout > div').evaluate(element => element.className = 'LayoutWrapper__body--second');
    await expect(content).not.toHaveCSS('width', '123px');
  } finally { await browser.close(); }
});

test('community and feed layout markers follow SPA identity changes and disable cleanly', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = (await Promise.all([
      'src/content/features/center/communities/swap-columns.css',
      'src/content/features/hiding/feed/hide-right-column.css',
    ].map(file => readFile(file, 'utf8')))).join('\n');
    await page.setContent(`<html data-vkify-communities_swap_columns data-vkify-hide_feed_right_column><style>
      .vkitInternalTwoColumnLayout{display:flex}.box{height:40px}${css}
    </style><body><main id="spa_layout_content">
      <div id="group_tabs">Tabs</div><div id="cover"></div>
      <div class="vkitInternalTwoColumnLayout"><div id="wide">Wide</div><div id="narrow">Narrow</div></div>
      <a data-testid="feed_right_menu_news" href="/feed">News</a>
      <div id="slot" class="box"><div><section data-testid="rightmenu">Menu</section></div></div>
      <div id="column" class="box vkuiSplitCol__host vkitInternalTwoColumnLayoutColumn"><section data-testid="rightmenu"><a id="photos">Photos</a><a id="friends">Friends</a><a id="search">Search</a><a id="likes">Likes</a></section></div>
      <div id="other" class="box">Unrelated card</div>
    </main></body></html>`);
    await installStyleRelations(page);
    await expect(page.locator('#wide')).toHaveCSS('order', '2');
    await expect(page.locator('#narrow')).toHaveCSS('order', '1');
    await expect(page.locator('#slot')).toBeHidden();
    await expect(page.locator('#column')).toBeHidden();
    await expect(page.locator('#other')).toBeVisible();
    await page.locator('#group_tabs').evaluate(element => element.remove());
    await expect(page.locator('#wide')).toHaveCSS('order', '0');
    await page.locator('#cover').evaluate(element => element.setAttribute('data-testid', 'communityheader_cover'));
    await expect(page.locator('#wide')).toHaveCSS('order', '2');
    await page.getByTestId('feed_right_menu_news').evaluate(element => element.setAttribute('href', '/other'));
    await expect(page.locator('#slot')).toBeVisible();
    await expect(page.locator('#column')).toBeHidden();
    await page.locator('#likes').evaluate(element => element.id = 'not-likes');
    await expect(page.locator('#column')).toBeVisible();
    await page.locator('#not-likes').evaluate(element => element.id = 'likes');
    await expect(page.locator('#column')).toBeHidden();
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-vkify-communities_swap_columns');
      document.documentElement.removeAttribute('data-vkify-hide_feed_right_column');
    });
    await expect(page.locator('#wide')).toHaveCSS('order', '0');
    await expect(page.locator('#column')).toBeVisible();
    await expect(page.locator('[data-vkify-has-community-cover]')).toHaveCount(0);
  } finally { await browser.close(); }
});
