import { describe, expect, it, vi } from 'vitest';
import { installPdfRenderRelay } from './pdf-render-relay.js';

interface FakeEvent<T extends (...args: never[]) => void> {
  addListener: (listener: T) => void;
  emit: (...args: Parameters<T>) => void;
}

function fakeEvent<T extends (...args: never[]) => void>(): FakeEvent<T> {
  const listeners: T[] = [];
  return {
    addListener: listener => { listeners.push(listener); },
    emit: (...args) => { for (const listener of listeners) listener(...args); },
  };
}

function fakePort(
  name: string,
  sender: Partial<chrome.runtime.MessageSender>,
): chrome.runtime.Port & {
  messageEvent: FakeEvent<(message: unknown) => void>;
  disconnectEvent: FakeEvent<() => void>;
} {
  const messageEvent = fakeEvent<(message: unknown) => void>();
  const disconnectEvent = fakeEvent<() => void>();
  return {
    name,
    sender: sender as chrome.runtime.MessageSender,
    postMessage: vi.fn(),
    disconnect: vi.fn(() => disconnectEvent.emit()),
    onMessage: messageEvent,
    onDisconnect: disconnectEvent,
    messageEvent,
    disconnectEvent,
  } as unknown as chrome.runtime.Port & {
    messageEvent: FakeEvent<(message: unknown) => void>;
    disconnectEvent: FakeEvent<() => void>;
  };
}

describe('PDF render relay', () => {
  it('соединяет только VK content-script с созданным расширением renderer-контекстом', async () => {
    const jobId = '11111111-1111-4111-8111-111111111111';
    const connectEvent = fakeEvent<(port: chrome.runtime.Port) => void>();
    let renderer: ReturnType<typeof fakePort> | undefined;
    const closeDocument = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        getURL: (path: string) => `chrome-extension://extension-id/${path.replace(/^\//, '')}`,
        onConnect: connectEvent,
      },
      tabs: {
        create: vi.fn(),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      offscreen: {
        createDocument: vi.fn().mockImplementation(async () => {
          renderer = fakePort(`vkify-pdf-renderer:${jobId}`, {
            id: 'extension-id',
            url: `chrome-extension://extension-id/pdf-renderer.html#${jobId}`,
          });
          connectEvent.emit(renderer);
        }),
        closeDocument,
      },
    });

    installPdfRenderRelay();
    const client = fakePort(`vkify-pdf-client:${jobId}`, {
      id: 'extension-id',
      url: 'https://vk.ru/im',
      tab: { id: 7 } as chrome.tabs.Tab,
    });
    connectEvent.emit(client);
    await vi.waitFor(() => expect(renderer).toBeDefined());

    expect(client.postMessage).toHaveBeenCalledWith({ type: 'relay-ready' });
    expect(renderer!.postMessage).toHaveBeenCalledWith({ type: 'relay-ready' });

    client.messageEvent.emit({ type: 'init', filename: 'dialog.pdf' });
    expect(renderer!.postMessage).toHaveBeenCalledWith({ type: 'init', filename: 'dialog.pdf' });
    renderer!.messageEvent.emit({ type: 'progress', done: 1, total: 3 });
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'progress', done: 1, total: 3 });

    client.disconnectEvent.emit();
    await vi.waitFor(() => expect(closeDocument).toHaveBeenCalledOnce());

    const hostile = fakePort('vkify-pdf-client:22222222-2222-4222-8222-222222222222', {
      id: 'extension-id',
      url: 'https://evil.example/',
      tab: { id: 8 } as chrome.tabs.Tab,
    });
    connectEvent.emit(hostile);
    expect(hostile.disconnect).toHaveBeenCalledOnce();

    const fallbackJobId = '33333333-3333-4333-8333-333333333333';
    const createTab = vi.fn().mockResolvedValue({ id: 42 });
    (chrome as unknown as { offscreen?: unknown }).offscreen = undefined;
    chrome.tabs.create = createTab;
    const fallbackClient = fakePort(`vkify-pdf-client:${fallbackJobId}`, {
      id: 'extension-id',
      url: 'https://vk.ru/im',
      tab: { id: 9 } as chrome.tabs.Tab,
    });
    connectEvent.emit(fallbackClient);
    await vi.waitFor(() => expect(createTab).toHaveBeenCalledOnce());

    const fallbackRenderer = fakePort(`vkify-pdf-renderer:${fallbackJobId}`, {
      id: 'extension-id',
      url: `chrome-extension://extension-id/pdf-renderer.html#${fallbackJobId}`,
      tab: { id: 42 } as chrome.tabs.Tab,
    });
    connectEvent.emit(fallbackRenderer);
    expect(fallbackRenderer.postMessage).toHaveBeenCalledWith({ type: 'relay-ready' });
    fallbackClient.disconnectEvent.emit();
    await vi.waitFor(() => expect(chrome.tabs.remove).toHaveBeenCalledWith(42));
  });
});
