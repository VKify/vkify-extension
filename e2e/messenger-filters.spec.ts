import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('messenger top panel hides without space, survives rerender and restores individual filters', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await Promise.all(['hide-messenger-filters','hide-business-notifications','hide-channels-tab'].map(name => readFile(`src/content/features/hiding/messenger/${name}.css`, 'utf8')));
    // Structure and stable testids from the supplied ConvoList HTML.
    const top = `<div class="ConvoList__top"><nav class="ConvoList__topFiltersWrap">
      <div role="button" data-testid="convo_list_filter_businessNotify">Бизнес-уведомления</div>
      </nav><div role="tablist"><div class="OrganiserViewHorizontal">
      <div class="OrganiserViewHorizontal__tabs"><div role="tab" data-testid="me_folder_tab_filters__all">Все</div>
      <div role="tab" data-testid="me_folder_tab_folders__1__all">Каналы</div></div>
      <button data-testid="me_folders_settings_gear">Настройка папок</button></div></div></div>`;
    await page.setContent(`<html><head><style>body{margin:0}.ConvoList__top{height:80px;padding:10px} #chats{height:200px}${css.join('\n')}</style></head><body><div id="list">${top}<div id="chats">Диалоги</div></div>
      <div id="unrelated" class="ConvoList__top">Another block using the same class</div>
      <div id="partial" class="ConvoList__top"><div role="tablist"><div role="tab" data-testid="me_folder_tab_example">A tab without folder settings</div></div></div>
      <div id="wrong-parent" class="ConvoList__top"><nav><div role="tab" data-testid="me_folder_tab_example">Tab outside the tablist</div><button data-testid="me_folders_settings_gear">Settings outside the tablist</button></nav></div>
      </body></html>`);
    const panel = page.locator('#list .ConvoList__top');
    const chats = page.locator('#chats');
    expect((await chats.boundingBox())!.y).toBe(100);
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-hide_messenger_filters',''));
    await expect(panel).toBeHidden();
    for (const id of ['unrelated', 'partial', 'wrong-parent']) await expect(page.locator('#' + id)).toBeVisible();
    await expect(chats).toBeVisible();
    expect((await chats.boundingBox())!.y).toBe(0);
    await panel.evaluate(el => el.replaceWith(el.cloneNode(true)));
    await expect(panel).toBeHidden();
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-vkify-hide_channels_tab','');
      document.documentElement.setAttribute('data-vkify-hide_business_notifications','');
      document.documentElement.removeAttribute('data-vkify-hide_messenger_filters');
    });
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('convo_list_filter_businessNotify')).toBeHidden();
    await expect(page.getByTestId('me_folder_tab_folders__1__all')).toBeHidden();
    await expect(page.getByTestId('me_folder_tab_filters__all')).toBeVisible();
    await expect(panel.getByTestId('me_folders_settings_gear')).toBeVisible();
  } finally { await browser.close(); }
});
