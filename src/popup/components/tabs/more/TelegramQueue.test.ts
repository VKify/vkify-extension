// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import TelegramQueue from './TelegramQueue.js';
import type { TelegramQueueState } from '@/shared/telegram-notifications/queue.js';

const mocks = vi.hoisted(() => ({ get: vi.fn(), subscribe: vi.fn(), send: vi.fn() }));
vi.mock('@/popup/utils/storageClient.js', () => ({ getStorage: mocks.get, subscribeStorage: mocks.subscribe }));
vi.mock('@/shared/messaging.js', () => ({ sendMessage: mocks.send }));
vi.mock('@/popup/store/index.js', () => ({ useVKifyStore: (selector: (state: unknown) => unknown) => selector({ settings: { telegram_notifications_enabled: true, telegram_bot_token: '123:token', telegram_chat_id: '456' } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => key + (options?.count !== undefined ? ` ${options.count}` : '') }) }));

it('shows persisted queue progress, live delivery updates, and a working retry control', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let notify!: () => void;
  let state: TelegramQueueState = { version: 1, items: [{ id: '1', context: JSON.stringify(['123', '456']), payload: { type: 'spy.delete', title: 'Alice', body: 'Deleted' }, createdAt: 1000, attempts: 1, nextAttemptAt: 2000, status: 'retry', error: 'Offline' }], receipts: [], delivered: 2, recent: [], updatedAt: 1000 };
  mocks.get.mockImplementation(async () => ({ telegram_delivery_queue: state }));
  const unsubscribe = vi.fn();
  mocks.subscribe.mockImplementation((_keys, callback) => { notify = callback; return unsubscribe; });
  mocks.send.mockResolvedValue({ success: true });
  const host = document.createElement('div'); const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(TelegramQueue)));
    expect(host.textContent).toContain('Alice'); expect(host.textContent).toContain('Offline');
    expect(host.querySelector('.telegram-queue-details')?.hasAttribute('open')).toBe(false);
    expect(host.querySelector('progress')?.value).toBe(2);
    expect(host.querySelector('progress')?.max).toBe(3);
    await act(async () => host.querySelector('button')!.click());
    expect(mocks.send).toHaveBeenCalledWith({ type: 'TELEGRAM_QUEUE_RETRY' });
    state = { ...state, items: [], delivered: 3, recent: [{ id: '1', title: 'Alice', sentAt: 2000, messageId: 42 }] };
    await act(async () => notify());
    expect(host.textContent).toContain('queue.empty'); expect(host.textContent).toContain('#42');
    expect(host.querySelector('progress')).toBeNull();
    expect(host.querySelector('button')).toBeNull();
  } finally { await act(async () => root.unmount()); }
  expect(unsubscribe).toHaveBeenCalledOnce();
});
