import { test, expect, chromium } from '@playwright/test';
import { resolve } from 'node:path';

test('all five messenger hiding settings toggle independently on current markup', async () => {
  const extension = resolve('dist/chrome');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true, executablePath: process.env.PW_CHROME_PATH,
    args: ['--disable-features=DisableLoadExtensionCommandLineSwitch', '--disable-extensions-except='+extension, '--load-extension='+extension],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('schema_version')).schema_version)).toBeTruthy();
    const targets = {
      hide_messenger_actions: '#actions',
      hide_messenger_filters: '#filters',
      hide_recommended_channels: '[data-testid="channels_list_recommended"]',
      hide_channels_tab: '#channel-slot',
      hide_business_notifications: '[data-testid="convo_list_filter_businessNotify"]',
    };
    const disabled = Object.fromEntries(Object.keys(targets).map(flag => [flag, false]));
    await worker.evaluate(settings => chrome.storage.local.set({ onboarding_done:true, first_run:false, ...settings }), disabled);
    const page = await context.newPage();
    await page.route('https://vk.ru/**', route => route.fulfill({ contentType:'text/html; charset=utf-8', body:`
      <style>body{margin:0}.ConvoList__top{padding:10px}.OrganiserViewHorizontal__tabs{display:flex;gap:8px}</style>
      <main id="page_body"><div class="ConvoList">
        <header><h1>Messenger</h1><button id="burger-menu-trigger">Menu</button>
          <div id="actions" class="vkmListHeader__after"><div class="ConvoList__topMenu">
            <div><button id="call-menu-trigger" aria-controls="call-menu">Calls</button></div>
            <div><button>Archive</button></div>
            <div><button id="chat-creation-menu-trigger" aria-controls="chat-creation-menu">Compose</button></div>
          </div></div>
        </header><input aria-label="Search chats">
        <div id="filters" class="ConvoList__top">
          <nav class="ConvoList__topFiltersWrap"><div role="button" data-testid="convo_list_filter_businessNotify">Business notifications</div></nav>
          <div role="tablist" class="new-vkui-hash"><div class="OrganiserViewHorizontal">
            <div class="OrganiserViewHorizontal__tabs">
              <div><div id="filters__all_label" role="tab" aria-controls="filters__all">All</div></div>
              <div id="channel-slot" data-onboarding-tooltip-container="true"><div><div class="OrganiserViewHorizontal__itemContainer"><div id="folders__1__all_label" role="tab" aria-controls="folders__1__all">Channels</div></div></div></div>
            </div><button data-testid="me_folders_settings_gear">Folder settings</button>
          </div></div>
        </div>
        <div id="chats" role="list">Subscribed channels and chats</div>
        <div data-testid="channels_list_recommended"><div role="heading">Recommendations</div><article>Suggested channel</article></div>
        <div id="conversation"><button>Conversation actions</button></div>
      </div></main>` }));
    await page.goto('https://vk.ru/im');
    for (const [flag, selector] of Object.entries(targets)) {
      await expect(page.locator(selector)).toBeVisible();
      await worker.evaluate(flag => chrome.storage.local.set({[flag]:true}), flag);
      await expect(page.locator(selector)).toBeHidden();
      for (const [other, otherSelector] of Object.entries(targets)) {
        if (other !== flag && !(flag === 'hide_messenger_filters' && ['hide_channels_tab','hide_business_notifications'].includes(other))) await expect(page.locator(otherSelector)).toBeVisible();
      }
      for (const selector of ['h1','#burger-menu-trigger','input','#chats','#conversation']) await expect(page.locator(selector)).toBeVisible();
      // React replacements must inherit the same hiding without reloading.
      await page.locator(selector).evaluate(el => el.replaceWith(el.cloneNode(true)));
      await expect(page.locator(selector)).toBeHidden();
      await worker.evaluate(flag => chrome.storage.local.set({[flag]:false}), flag);
      await expect(page.locator(selector)).toBeVisible();
    }
    await worker.evaluate(settings => chrome.storage.local.set(settings), Object.fromEntries(Object.keys(targets).map(flag => [flag,true])));
    for (const selector of Object.values(targets)) await expect(page.locator(selector)).toBeHidden();
    await worker.evaluate(settings => chrome.storage.local.set(settings), disabled);
    for (const selector of Object.values(targets)) await expect(page.locator(selector)).toBeVisible();
  } finally { await context.close(); }
});
