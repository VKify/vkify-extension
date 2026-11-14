// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ observe: vi.fn((_selector: string, _callback: () => void) => vi.fn()) }));
vi.mock('@/content/core/dom/dom-observer.js', () => ({ domObserver: { observeMatches: mocks.observe } }));
import { startThemeMenuLoader } from './theme-menu-loader.js';

afterEach(() => { vi.unstubAllGlobals(); mocks.observe.mockClear(); });

it('does no startup injection and coalesces concurrent menu openings', async () => {
  let release!: (result: { ok: boolean }) => void;
  const send = vi.fn(() => new Promise<{ ok: boolean }>(resolve => { release = resolve; }));
  vi.stubGlobal('chrome', { runtime: { sendMessage: send } });
  startThemeMenuLoader();
  expect(send).not.toHaveBeenCalled();
  const open = mocks.observe.mock.calls[0][1];
  open(); open();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send).toHaveBeenCalledWith({ type: 'INJECT_THEME_MENU' });
  release({ ok: true });
  await Promise.resolve(); await Promise.resolve();
  open();
  expect(send).toHaveBeenCalledTimes(1);
});

it('retries a failed injection when a keep-mounted menu is reopened', async () => {
  const send = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true });
  vi.stubGlobal('chrome', { runtime: { sendMessage: send } });
  startThemeMenuLoader();
  mocks.observe.mock.calls[0][1]();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const button = document.createElement('button'); button.dataset.testid = 'header-profile-menu-button'; document.body.append(button);
  button.click();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  button.remove();
});
