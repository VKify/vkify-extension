import { chromium } from 'playwright';
import { resolve } from 'path';

const EXT = resolve(process.cwd(), 'dist', 'chrome');
console.log('EXT =', EXT);

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  executablePath: process.env.PW_CHROME_PATH,
  args: [
    '--no-sandbox',
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
  ],
});

ctx.on('close', () => console.log('CONTEXT CLOSED'));

console.log('launched, serviceWorkers:', ctx.serviceWorkers().length);

const page = await ctx.newPage();
console.log('newPage ok');
await page.goto('https://example.com');
console.log('navigated to example.com, title:', await page.title());

let sw = ctx.serviceWorkers()[0];
if (!sw) {
  console.log('waiting for serviceworker...');
  sw = await ctx.waitForEvent('serviceworker', { timeout: 20000 }).catch((e) => { console.log('SW wait error:', e.message); return null; });
}
console.log('SW url:', sw?.url());

await ctx.close();
console.log('done');
