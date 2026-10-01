// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDialogFiles, useGlobalDialogFiles, useSubscriptions } from './useCenterTools.js';
import { sendMessage } from '@/shared/messaging.js';
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
const send = vi.mocked(sendMessage);
let root: Root;
let files: ReturnType<typeof useDialogFiles>;
let subscriptions: ReturnType<typeof useSubscriptions>;
let library: ReturnType<typeof useGlobalDialogFiles>;
function Harness({ owner = '1' }: { owner?: string }) { files = useDialogFiles(owner); subscriptions = useSubscriptions(owner); library = useGlobalDialogFiles(owner); return null; }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); send.mockReset();
  root = createRoot(document.createElement('div'));
  await act(async () => root.render(React.createElement(Harness)));
});
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });
it('paginates dialogs by consumed rows and attachments by cursor', async () => {
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ conversation: { peer: { id: 1 } } }] } });
  await act(async () => { await files.loadDialogs(); });
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ conversation: { peer: { id: 2 } } }] } });
  await act(async () => { await files.loadDialogs(); });
  expect(send.mock.calls[1]?.[0]).toMatchObject({ method: 'messages.getConversations', params: { offset: 1 } });
  expect(files.moreDialogs).toBe(false);
  await act(async () => files.setPeer(1));
  send.mockResolvedValueOnce({ success: true, data: { items: [], next_from: 'next-page' } });
  await act(async () => { await files.loadFiles(true); });
  send.mockResolvedValueOnce({ success: true, data: { items: [], next_from: 'next-page' } });
  await act(async () => { await files.loadFiles(); });
  expect(send.mock.calls[3]?.[0]).toMatchObject({ method: 'messages.getHistoryAttachments', params: { peer_id: 1, start_from: 'next-page' } });
  expect(files.next).toBeNull();
});
it('ignores a late response after changing dialog or account', async () => {
  await act(async () => files.setPeer(1));
  let resolve!: (value: Awaited<ReturnType<typeof sendMessage>>) => void;
  send.mockImplementationOnce(() => new Promise(r => { resolve = r; }) as ReturnType<typeof sendMessage>);
  let pending!: Promise<void>;
  await act(async () => { pending = files.loadFiles(true); });
  await act(async () => files.setPeer(2));
  await act(async () => { resolve({ success: true, data: { items: [], next_from: 'old-peer' } }); await pending; });
  expect(files.next).toBeNull(); expect(files.loaded).toBe(false);
  send.mockResolvedValueOnce({ success: true, data: { count: 1, items: [{ id: 1, name: 'Group' }] } });
  await act(async () => { await subscriptions.load(); });
  expect(subscriptions.groups).toHaveLength(1);
  await act(async () => root.render(React.createElement(Harness, { owner: '2' })));
  expect(subscriptions.groups).toHaveLength(0); expect(files.peer).toBeNull();
});
it('keeps inaccessible walls separate from inactive walls and cancels the queue', async () => {
  vi.useFakeTimers();
  send.mockResolvedValueOnce({ success: true, data: { count: 3, items: [{ id: 1 }, { id: 2 }, { id: 3 }] } });
  await act(async () => { await subscriptions.load(); });
  send.mockResolvedValueOnce({ success: false, code: '15', error: 'Access denied' });
  let pending!: Promise<void>;
  await act(async () => { pending = subscriptions.analyze(90); });
  expect(subscriptions.groups[0]?.activity).toBe('unavailable');
  await act(async () => { subscriptions.cancel(); await vi.runAllTimersAsync(); await pending; });
  expect(send).toHaveBeenCalledTimes(2);
  expect(subscriptions.groups[1]?.activity).toBe('unchecked'); expect(subscriptions.busy).toBe(false);
});
it('shows permission failures instead of an empty successful result', async () => {
  send.mockResolvedValueOnce({ success: false, code: '7', error: 'Permission denied' });
  await act(async () => { await files.loadDialogs(); });
  expect(files.dialogTask.error).toBe('access_error'); expect(files.total).toBeNull();
});

it('loads the full subscriptions list and adjusts pagination after leaving a group', async () => {
  vi.useFakeTimers();
  send.mockResolvedValueOnce({ success: true, data: { count: 3, items: [{ id: 1 }, { id: 2 }] } })
    .mockResolvedValueOnce({ success: true, data: { count: 3, items: [{ id: 3 }] } });
  await act(async () => { const job = subscriptions.load(false, true); await vi.runAllTimersAsync(); await job; });
  expect(subscriptions.groups.map(g => g.id)).toEqual([1, 2, 3]);
  expect(subscriptions.more).toBe(false);
  await act(async () => subscriptions.removeGroup(2));
  expect(subscriptions.total).toBe(2);
  expect(subscriptions.groups.map(g => g.id)).toEqual([1, 3]);
  expect(subscriptions.more).toBe(false);
});

it('checks activity only for selected communities', async () => {
  send.mockResolvedValueOnce({ success: true, data: { count: 2, items: [{ id: 1 }, { id: 2 }] } });
  await act(async () => { await subscriptions.load(); });
  send.mockResolvedValueOnce({ success: true, data: { count: 0, items: [] } });
  await act(async () => { await subscriptions.analyze(90, [2]); });
  expect(send.mock.calls[1]?.[0]).toMatchObject({ method: 'wall.get', params: { owner_id: -2 } });
  expect(subscriptions.groups[0]?.activity).toBe('unchecked');
  expect(subscriptions.groups[1]?.activity).toBe('empty');
});

it('discovers every dialog and keeps identical message IDs in different conversations', async () => {
  vi.useFakeTimers();
  send.mockImplementation(async message => {
    if (message.type !== 'VK_API_CALL') throw new Error('Unexpected message');
    if (message.method === 'messages.getConversations') return { success: true, data: { count: 2, items: [{ conversation: { peer: { id: Number(message.params.offset) + 1 } } }] } };
    return { success: true, data: { items: message.params.media_type === 'doc' ? [{ cmid: 1, message_id: 1, attachment: { type: 'doc', doc: { id: 1, owner_id: 1, title: 'File', url: 'https://vk.ru/doc1_1' } } }] : [] } };
  });
  await act(async () => { const job = library.load(); await vi.runAllTimersAsync(); await job; });
  expect(library.dialogs).toHaveLength(2); expect(library.files).toHaveLength(2);
  expect(library.files.map(file => file.peerId)).toEqual([1, 2]);
  expect(new Set(library.files.map(file => file.key)).size).toBe(2);
  expect(library.covered).toEqual([1, 2]); expect(library.phase).toBe('ready');
  expect(send.mock.calls.filter(([m]) => m.type === 'VK_API_CALL' && m.method === 'messages.getHistoryAttachments')).toHaveLength(10);
});

it('loads one page per type before older pages and stops repeating cursors', async () => {
  vi.useFakeTimers();
  send.mockImplementation(async message => {
    if (message.type !== 'VK_API_CALL') throw new Error('Unexpected message');
    if (message.method === 'messages.getConversations') return { success: true, data: { count: 1, items: [{ conversation: { peer: { id: 1 } } }] } };
    return { success: true, data: { items: [], next_from: message.params.media_type === 'photo' ? 'older' : undefined } };
  });
  await act(async () => { const job = library.load(); await vi.runAllTimersAsync(); await job; });
  expect(library.pending).toBe(1);
  expect(send).toHaveBeenCalledTimes(6);
  await act(async () => { const job = library.load(); await vi.runAllTimersAsync(); await job; });
  expect(send.mock.lastCall?.[0]).toMatchObject({ method: 'messages.getHistoryAttachments', params: { start_from: 'older', media_type: 'photo' } });
  expect(library.pending).toBe(0);
});

it('resumes a cancelled library without losing the current cursor or existing files', async () => {
  vi.useFakeTimers();
  send.mockImplementation(async message => {
    if (message.type !== 'VK_API_CALL') throw new Error('Unexpected message');
    if (message.method === 'messages.getConversations') return { success: true, data: { count: 1, items: [{ conversation: { peer: { id: 1 } } }] } };
    return { success: true, data: { items: [] } };
  });
  let job!: Promise<void>;
  await act(async () => { job = library.load(); });
  // Conversation discovery completes, then the queue pauses before attachments.
  await act(async () => { library.cancel(); await vi.runAllTimersAsync(); await job; });
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { const resumed = library.load(); await vi.runAllTimersAsync(); await resumed; });
  expect(send).toHaveBeenCalledTimes(6); expect(library.phase).toBe('ready');
});

it('skips a restricted dialog but stops on account-wide permission failures', async () => {
  vi.useFakeTimers();
  send.mockResolvedValueOnce({ success: true, data: { count: 1, items: [{ conversation: { peer: { id: 1 } } }] } });
  send.mockResolvedValueOnce({ success: false, code: '15', error: 'Access denied' });
  await act(async () => { const job = library.load(); await vi.runAllTimersAsync(); await job; });
  expect(library.skipped).toEqual([1]); expect(send).toHaveBeenCalledTimes(2);
  send.mockResolvedValueOnce({ success: true, data: { count: 1, items: [{ conversation: { peer: { id: 1 } } }] } });
  send.mockResolvedValueOnce({ success: false, code: '7', error: 'Access denied' });
  await act(async () => { const job = library.load(true); await vi.runAllTimersAsync(); await job; });
  expect(library.error).toBe('access_error'); expect(library.pending).toBe(5);
});
