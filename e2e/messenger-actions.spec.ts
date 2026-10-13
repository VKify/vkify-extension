import { test, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('messenger header actions hide together without hiding the title or unrelated buttons', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME_PATH });
  try {
    const page = await browser.newPage();
    const css = await readFile('src/content/features/hiding/messenger/hide-messenger-actions.css', 'utf8');
    // Native wrappers and stable IDs from the supplied header markup.
    const actions = `<div class="vkmListHeader__after"><div class="ConvoList__topMenu">
      <div class="DropdownReforged"><div class="DropdownReforged__trigger"><button id="call-menu-trigger" aria-controls="call-menu" aria-label="Звонки">Call</button></div></div>
      <div><button aria-label="Архив">Archive</button></div>
      <div class="DropdownReforged"><div class="DropdownReforged__trigger"><div data-onboarding-tooltip-container="true"><div><button id="chat-creation-menu-trigger" aria-controls="chat-creation-menu" aria-label="Начать общение">Compose</button></div></div></div></div>
      </div></div>`;
    await page.setContent(`<html><head><style>${css}</style></head><body><header id="messenger"><h2>Мессенджер</h2>${actions}</header>
      <div id="unrelated" class="vkmListHeader__after"><div class="ConvoList__topMenu"><button aria-label="Архив">Other archive</button></div></div>
      <div id="wrong-context">${actions}</div><div id="chats">Чаты</div></body></html>`);
    // The same IDs outside the required action wrapper must not qualify.
    await page.locator('#wrong-context .ConvoList__topMenu').evaluate(el => el.className = 'other-menu');
    const slot = page.locator('#messenger .vkmListHeader__after');
    await expect(slot).toBeVisible();
    await page.evaluate(() => document.documentElement.setAttribute('data-vkify-hide_messenger_actions', ''));
    await expect(slot).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Мессенджер' })).toBeVisible();
    await expect(page.locator('#chats')).toBeVisible();
    await expect(page.locator('#unrelated')).toBeVisible();
    await expect(page.locator('#wrong-context .vkmListHeader__after')).toBeVisible();
    await slot.evaluate(el => el.replaceWith(el.cloneNode(true)));
    await expect(slot).toBeHidden();
    await page.evaluate(() => document.documentElement.removeAttribute('data-vkify-hide_messenger_actions'));
    await expect(slot.getByRole('button', { name: 'Звонки', exact: true })).toBeVisible();
    await expect(slot.getByRole('button', { name: 'Архив', exact: true })).toBeVisible();
    await expect(slot.getByRole('button', { name: 'Начать общение', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});
