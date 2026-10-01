// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sendMessage } from '@/shared/messaging.js';
import BulkActions from './BulkActions.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const send = vi.mocked(sendMessage), success = vi.fn();
const actions = [{ key: 'unsubscribe', jobs: [1, 2].map(id => ({ id: String(id), title: `Group ${id}`, method: 'groups.leave', params: { group_id: id } })) }];
let root: Root, host: HTMLDivElement;
const render = async (ownerId = '1', scope = '') => { await act(async () => root.render(React.createElement(BulkActions, { ownerId, scope, actions, onSuccess: success }))); };
const click = async (key: string) => { const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(key)); expect(button).toBeTruthy(); await act(async () => button!.click()); };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers(); send.mockReset(); success.mockReset();
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

it('requires review and confirmation, binds writes to the owner and stops between writes', async () => {
  send.mockResolvedValue({ success: true, data: 1 });
  await render(); await click('bulk.unsubscribe');
  expect(send).not.toHaveBeenCalled();
  expect(host.querySelectorAll('.ct-bulk-targets li')).toHaveLength(2);
  await click('bulk.confirm');
  expect(send).toHaveBeenCalledWith({ type: 'VK_API_CALL', method: 'groups.leave', params: { group_id: 1 }, expectedUserId: '1' });
  await click('bulk.stop');
  await act(async () => { await vi.runAllTimersAsync(); });
  expect(send).toHaveBeenCalledTimes(1);
  expect(success).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('bulk.resume');
});

it('does not apply late results after changing account or scope', async () => {
  let resolve!: (value: { success: boolean; data: number }) => void;
  send.mockImplementation(() => new Promise(r => { resolve = r; }) as ReturnType<typeof sendMessage>);
  await render(); await click('bulk.unsubscribe'); await click('bulk.confirm');
  await render('2', 'other');
  await act(async () => { resolve({ success: true, data: 1 }); await vi.runAllTimersAsync(); });
  expect(success).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
  expect(host.querySelector('.ct-bulk-confirm')).toBeNull();
});

it('shows failures, offers only untouched jobs and never retries a failed write automatically', async () => {
  send.mockResolvedValue({ success: false, code: '14', error: 'Captcha' });
  await render(); await click('bulk.unsubscribe'); await click('bulk.confirm');
  expect(host.textContent).toContain('Captcha');
  expect(success).not.toHaveBeenCalled();
  await click('bulk.resume');
  expect(host.querySelectorAll('.ct-bulk-confirm li')).toHaveLength(1);
  expect(host.querySelector('.ct-bulk-confirm')?.textContent).toContain('Group 2');
  expect(send).toHaveBeenCalledTimes(1);
});
