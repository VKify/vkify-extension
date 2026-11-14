import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('post dividers cover feed and profile/community walls without changing post formatting', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/center/feed/feed-dividers.css', 'utf8');
    const post = '<article><div data-testid="post"><header><img width="48" height="48" alt="Avatar"><a href="#author">Author</a></header><p>Post text</p><button>Like</button><a href="#post">2 hours ago</a></div></article>';
    await page.setContent(`<style>article{margin:16px;padding:20px;border-radius:12px;background:#fff}p{font:16px/24px sans-serif}header{display:flex;gap:12px} ${css}</style><div data-testid="feed_wall"><div data-testid="feed-items">${post}${post}</div></div><section id="page-wall"><div data-testid="feed-items">${post}${post}</div></section><aside>${post}</aside><div id="feed_rows"><div class="feed_row">Classic post</div><div class="feed_row">Classic post</div></div><div id="page_wall_posts"><div class="post">Classic wall post</div><div class="post">Classic wall post</div></div>`);
    const feed = page.getByTestId('feed_wall').getByTestId('feed-items');
    const formatting = () => feed.getByTestId('post').first().evaluate(el => {
      const card = getComputedStyle(el.parentElement!), text = getComputedStyle(el.querySelector('p')!);
      return { padding: card.padding, margin: card.margin, radius: card.borderRadius,
        font: text.font, avatarWidth: el.querySelector('img')!.getBoundingClientRect().width, html: el.innerHTML };
    });
    const before = await formatting();
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-feed_post_dividers', ''));
    const separator = (el: Element) => {
      const style = getComputedStyle(el, '::after');
      return { content: style.content, height: style.height, margin: style.margin, background: style.backgroundColor };
    };
    expect(await feed.locator('article').first().evaluate(separator)).toMatchObject({ content: '""', height: '1px', margin: '10px 0px' });
    expect(await feed.locator('article').last().evaluate(separator)).toMatchObject({ content: 'none' });
    expect(await page.locator('#feed_rows .feed_row').first().evaluate(separator)).toMatchObject({ height: '1px' });
    expect(await page.locator('aside article').evaluate(separator)).toMatchObject({ content: 'none' });
    const wall = page.locator('#page-wall [data-testid="feed-items"]');
    expect(await wall.locator(':scope > article').first().evaluate(separator)).toMatchObject({ height: '1px', margin: '10px 0px' });
    expect(await wall.locator(':scope > article').last().evaluate(separator)).toMatchObject({ content: 'none' });
    expect(await page.locator('#page_wall_posts > .post').first().evaluate(separator)).toMatchObject({ height: '1px' });
    await wall.locator('[data-testid="post"]').first().evaluate(el => el.insertAdjacentHTML('beforeend', '<article data-testid="nested-repost">Repost</article>'));
    expect(await wall.getByTestId('nested-repost').evaluate(separator)).toMatchObject({ content: 'none' });
    expect(await formatting()).toEqual(before);
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-feed_post_dividers'));
    expect(await feed.locator('article').first().evaluate(separator)).toMatchObject({ content: 'none' });
    expect(await wall.locator(':scope > article').first().evaluate(separator)).toMatchObject({ content: 'none' });
  } finally { await browser.close(); }
});
