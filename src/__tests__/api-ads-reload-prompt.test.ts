// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useVKifyStore } from '../popup/store/index.js';
import { reloadActiveVKTab } from '../popup/utils/tabs.js';
import ApiAdsReloadPrompt from '../popup/components/ApiAdsReloadPrompt.js';

vi.mock('../popup/store/index.js', async () => {
  const { create } = await import('zustand');
  return { useVKifyStore: create(() => ({ settings: {}, loading: true })) };
});
vi.mock('../popup/utils/tabs.js', () => ({ reloadActiveVKTab: vi.fn(async () => true) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../popup/hooks/core/useEmbedViewport.js', () => ({ useEmbedViewport: () => null }));

let root: Root;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(reloadActiveVKTab).mockReset().mockResolvedValue(true);
  useVKifyStore.setState({ settings: {}, loading: true });
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(React.createElement(ApiAdsReloadPrompt)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});
const change = async (enabled: boolean) => {
  await act(async () => useVKifyStore.setState({ settings: { block_feed_ads_api: enabled }, loading: false }));
};
const click = async (text: string) => {
  const button = [...document.querySelectorAll('button')].find(el => el.textContent?.includes(text));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
};

it('does not prompt on hydration, unrelated changes or unchanged API settings', async () => {
  await change(true);
  await act(async () => useVKifyStore.setState({ settings: { block_feed_ads_api: true, block_feed_ads_dom: true } }));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(reloadActiveVKTab).not.toHaveBeenCalled();
});

it('prompts after disabling and enabling, and Later preserves the new setting', async () => {
  await change(true);
  await change(false);
  expect(document.body.textContent).toContain('reload.disabled');
  await click('reload.later');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(useVKifyStore.getState().settings.block_feed_ads_api).toBe(false);
  await change(true);
  expect(document.body.textContent).toContain('reload.enabled');
  await click('reload.confirm');
  expect(reloadActiveVKTab).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('shows a retryable error when no VK tab can be reloaded', async () => {
  vi.mocked(reloadActiveVKTab).mockResolvedValue(false);
  await change(false);
  await change(true);
  await click('reload.confirm');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('reload.failed');
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  vi.mocked(reloadActiveVKTab).mockResolvedValue(true);
  await click('reload.confirm');
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('waits for explicit reload consent and blocks duplicate requests while busy', async () => {
  let finish!: (success: boolean) => void;
  vi.mocked(reloadActiveVKTab).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  await change(true);
  await change(false);
  expect(reloadActiveVKTab).not.toHaveBeenCalled();
  await click('reload.confirm');
  await click('reload.busy');
  expect(reloadActiveVKTab).toHaveBeenCalledTimes(1);
  await act(async () => finish(true));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
