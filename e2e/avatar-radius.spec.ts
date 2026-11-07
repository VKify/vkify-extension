import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('avatar rounding reaches the current VK image and overlay layers', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await worker.evaluate(() => chrome.storage.local.set({ onboarding_done: true, first_run: false, border_radius: 12, avatar_radius_shape: '' }));
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType: 'text/html', body: `
      <style>.photo-surface, img, #overlay, #outline { border-radius: 50%; }</style>
      <div data-testid="profile-avatar"><div class="photo-surface"><img><div id="overlay"></div><div id="outline" aria-hidden="true"></div></div></div>
      <a data-testid="profile-friends-list" id="friend"><div><div><img><div></div><div aria-hidden="true"></div></div></div></a>
      <div data-testid="post-header-avatar"><div><img id="author"><div></div><div aria-hidden="true"></div></div></div>
      <a data-testid="comment-avatar"><img id="clip-comment"><div></div><div aria-hidden="true"></div></a>
      <div data-testid="clips-author-avatar"><div><img id="clip-author"><div aria-hidden="true"></div></div></div>
      <div data-testid="group_item_list"><div><div><img id="group-list"><div></div><div aria-hidden="true"></div></div></div></div>
      <a data-testid="group_item_slider"><div><img id="group-slider"><div></div><div aria-hidden="true"></div></div></a>
      <div data-testid="group_item_desktop_list"><div><a><img id="group-search"><div></div><div aria-hidden="true"></div></a></div></div>
      <a data-testid="video_card_author"><div><img id="video-author"></div></a>
      <div data-testid="links-cell"><div><div data-testid="links-cell-avatar"><img id="music-links-avatar"><div></div><div id="music-links-outline" aria-hidden="true"></div></div></div></div>
      <article>
        <img id="playlist-cover" style="border-radius: 8px">
        <a data-testid="MusicPlaylistItem_AuthorLink"><div><div style="width: 16px; height: 16px"><img id="playlist-author"><div aria-hidden="true"></div></div><div>VK Музыка</div></div></a>
      </article>
      <div data-testid="calls_main_page_call_friends_item"><div><div id="call-friend" style="width:48px;height:48px"><img><div></div><div aria-hidden="true"></div></div></div></div>
      <div data-testid="calls_call_friends_page_item"><div><div id="call-friend-list" data-testid="calls_call_friends_page_item_avatar"><img><div></div><div aria-hidden="true"></div></div></div></div>
      <a data-testid="notification-avatar"><img id="notification-avatar"><div></div><div aria-hidden="true"></div></a>
      <div data-testid="calls_history_list_item"><a><div data-testid="calls_history_list_item_avatar" id="call-history" style="width:32px;height:32px"><img><div></div><div aria-hidden="true"></div></div></a></div>
      <a data-testid="post-header-avatar"><img id="story-author"><div></div><div aria-hidden="true"><div id="story-ring" data-testid="richavatar-outline-accent" style="border-radius:50%; border:2px solid rgb(0, 119, 255)"></div></div></a>
      <a data-testid="story_card_stories"><div><img id="story-cover" style="border-radius:0"></div><div><div><img id="story-card-avatar"><div></div><div aria-hidden="true"><div id="story-card-ring" data-testid="richavatar-outline-accent_gray"></div></div></div></div></a>
      <section><a href="/friends?act=find">Показать всех</a><a href="/id123"><div><img id="possible-friend"><div></div><div aria-hidden="true"></div></div></a></section>
      <ul>
        <li data-testid="leftmenuitem"><a href="/vkify"><div><img id="sidebar-avatar"><div></div><div aria-hidden="true"></div></div></a></li>
        <li data-testid="leftmenuitem"><a href="//example.com"><div><img id="sidebar-external"><div></div><div aria-hidden="true"></div></div></a></li>
      </ul>
      <button data-testid="header-profile-menu-button"><img id="header-avatar"><div></div><div aria-hidden="true"></div></button>
      <section data-testid="group-header"><div id="community_avatar_123"><img id="community-avatar"><div></div><div aria-hidden="true"></div></div></section>
      <div data-testid="header-profile-menu">
        <a><div><img id="mini-profile-avatar"><div aria-hidden="true"></div></div></a>
        <div><a style="--avatar-rich-stroke-width: 2px"><div><img id="account-avatar"><div aria-hidden="true"></div></div></a></div>
        <section><a><div><img id="menu-banner" style="border-radius:8px"></div><span aria-hidden="true"></span></a></section>
      </div>
      <div><img id="other"><div></div><div aria-hidden="true"></div></div>
      <div style="width: 80px; height: 80px;"><img id="square-cover"><div></div><div aria-hidden="true"></div></div>
      <a id="album-cover" style="width: 176px; height: 132px; border-radius: 8px"><img style="border-radius: 8px"><div></div><div aria-hidden="true"></div></a>
      <div data-testid="userrichcell-avatar"><a id="friends-page-avatar" style="width: 80px; height: 80px;"><img><div></div><div aria-hidden="true"></div></a></div>
      <div>
        <section data-testid="rightmenu"></section>
        <section><div role="button">Подписчики</div><div data-testid="group-followers"></div>
          <div data-testid="grid"><a><div><div><img id="subscriber"><div aria-hidden="true"></div></div></div></a></div>
        </section>
        <section><div role="button">Контакты</div>
          <a class="vkuiInternalTappable"><div><div><img id="contact"><div aria-hidden="true"></div></div></div></a>
        </section>
      </div>
      <div data-testid="group-friends-followers"><svg width="32" height="32"><g id="stacked-photo" clip-path="url(#UsersStackMask:test)"><image width="32" height="32"/></g></svg></div>
      <div data-testid="subscriptions-modal" role="dialog"><div data-testid="grid-item"><div><img id="subscription-modal"><div aria-hidden="true"></div></div></div></div>
      <div data-testid="modalbox" role="dialog">
        <div data-testid="followers-modal-user-cell-123"><a><img id="subscriber-modal"><div aria-hidden="true"></div></a></div>
        <a class="vkuiInternalTappable"><div><div><img id="contact-modal"><div aria-hidden="true"></div></div></div></a>
        <a class="vkuiInternalTappable"><div><img id="modal-banner" style="border-radius:8px"></div></a>
      </div>
    ` }));
    await page.goto('https://vk.ru/calls?section=friends');
    const photo = page.locator('[data-testid="profile-avatar"] img');
    await expect(photo).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#overlay')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#outline')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#friend img')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#author')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#header-avatar')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#community-avatar')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#mini-profile-avatar')).toHaveCSS('border-radius', '12%');
    await expect(page.locator('#menu-banner')).toHaveCSS('border-radius', '8px');
    await expect(page.locator('#other')).toHaveCSS('border-radius', '50%');
    await expect(page.locator('#square-cover')).toHaveCSS('border-radius', '50%');
    for (const selector of ['#friends-page-avatar', '#friends-page-avatar > img', '#friends-page-avatar > img + div', '#friends-page-avatar > [aria-hidden="true"]']) {
      await expect(page.locator(selector)).toHaveCSS('border-radius', '12%');
    }
    for (const id of ['subscriber', 'contact', 'subscription-modal', 'subscriber-modal', 'contact-modal']) {
      await expect(page.locator('#' + id)).toHaveCSS('border-radius', '12%');
    }
    await expect(page.locator('#modal-banner')).toHaveCSS('border-radius', '8px');
    await expect(page.locator('#stacked-photo')).toHaveCSS('clip-path', 'inset(0px round 12%)');

    await worker.evaluate(() => chrome.storage.local.set({ avatar_radius_shape: 'leaf' }));
    await expect(photo).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#story-author')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#playlist-author')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#music-links-avatar')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#music-links-outline')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#playlist-cover')).toHaveCSS('border-radius', '8px');
    for (const id of ['story-card-avatar', 'story-card-ring', 'possible-friend', 'sidebar-avatar']) {
      await expect(page.locator('#' + id)).toHaveCSS('border-radius', '0px 50%');
    }
    await expect(page.locator('#story-cover')).toHaveCSS('border-radius', '0px');
    await expect(page.locator('#sidebar-external')).toHaveCSS('border-radius', '50%');
    for (const id of ['clip-comment', 'clip-author', 'group-list', 'group-slider', 'group-search', 'video-author', 'account-avatar']) {
      await expect(page.locator('#' + id)).toHaveCSS('border-radius', '0px 50%');
    }
    await expect(page.locator('#notification-avatar')).toHaveCSS('border-radius', '0px 50%');
    for (const id of ['call-friend', 'call-friend-list', 'call-history']) {
      for (const selector of ['#' + id, '#' + id + ' > img', '#' + id + ' > div']) {
        for (const layer of await page.locator(selector).all()) {
          await expect(layer).toHaveCSS('border-radius', '0px 50%');
        }
      }
    }
    await expect(page.locator('#story-ring')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#story-ring')).toHaveCSS('border-top-color', 'rgb(0, 119, 255)');
    await expect(page.locator('#friends-page-avatar > img')).toHaveCSS('border-radius', '0px 50%');
    await expect(page.locator('#square-cover')).toHaveCSS('border-radius', '50%');
    await expect(page.locator('#album-cover')).toHaveCSS('border-radius', '8px');
    await expect(page.locator('#album-cover > img')).toHaveCSS('border-radius', '8px');
    await worker.evaluate(() => chrome.storage.local.set({ avatar_radius_shape: '', border_radius: 50 }));
    await expect(page.locator('#vkify-border_radius')).toHaveCount(0);
    await expect(photo).toHaveCSS('border-radius', '50%');
    await expect(page.locator('#story-ring')).toHaveCSS('border-radius', '50%');
    await expect(page.locator('#stacked-photo')).toHaveCSS('clip-path', /UsersStackMask/);
  } finally {
    await context.close();
  }
});
