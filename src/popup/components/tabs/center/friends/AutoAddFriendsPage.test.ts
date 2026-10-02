// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AutoAddFriendsPage from './AutoAddFriendsPage.js';
import { getStorage } from '@/popup/utils/storageClient.js';
import { sendMessage } from '@/shared/messaging.js';
import en from '@/locales/en/automation.json';

vi.mock('@/popup/store/selectors.js', () => ({ useSetting: () => true }));
vi.mock('@/popup/context/ToastContext.js', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/popup/components/ui/DocsLink.js', () => ({ default: () => null }));
vi.mock('@/popup/utils/storageClient.js', () => ({ getStorage: vi.fn() }));
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => {
  let value: unknown = en;
  for (const part of key.split('.')) value = (value as Record<string, unknown>)?.[part];
  return String(value ?? key);
} }) }));
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('chrome', { storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
  vi.mocked(getStorage).mockResolvedValue({}); vi.mocked(sendMessage).mockReset().mockResolvedValue({ success: true });
  const host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.unstubAllGlobals(); });
const render = async () => { await act(async () => root.render(React.createElement(AutoAddFriendsPage))); };

it('requires a risk acknowledgement and enables configuration before starting', async () => {
  await render();
  const start = [...document.querySelectorAll('button')].find(b => b.textContent === 'Start')!;
  expect(start.disabled).toBe(true);
  expect(document.querySelector('fieldset')?.disabled).toBe(false);
  expect(document.querySelectorAll('input[type="range"]')).toHaveLength(5);
  expect(document.body.textContent).toContain('own risk');
  await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  expect(start.disabled).toBe(false);
  await act(async () => start.click());
  expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'START_AUTO_ADD_FRIENDS', acknowledged: true }));
});
it('uses the background running state, shows a stop control and freezes parameters', async () => {
  vi.mocked(getStorage).mockResolvedValue({ auto_add_stats: { isRunning: true, added: 2, attempted: 2 } });
  await render();
  expect(document.querySelector('fieldset')?.disabled).toBe(true);
  const stop = [...document.querySelectorAll('button')].find(b => b.textContent === 'Stop')!;
  expect(stop.disabled).toBe(false);
  await act(async () => stop.click());
  expect(sendMessage).toHaveBeenCalledWith({ type: 'STOP_AUTO_ADD_FRIENDS' });
});
it('shows the stored stop reason and CAPTCHA warning', async () => {
  vi.mocked(getStorage).mockResolvedValue({ auto_add_stats: { isRunning: false, added: 0, attempted: 1, reason: 'error', code: '14', error: 'Captcha needed' } });
  await render();
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('VK requires CAPTCHA');
  expect(document.querySelector('[role="alert"]')?.textContent).not.toContain('Captcha needed');
});
