import {
  PDF_CLIENT_PORT_PREFIX,
  type PdfClientMessage,
  type PdfRendererMessage,
  type PdfSaveOptions,
} from './pdf-api.js';
import { t } from '@/content/i18n/index.js';

const SERIALIZE_BATCH_SIZE = 8;
const SERIALIZE_BATCH_MAX_CHARS = 4 * 1024 * 1024;
const RENDERER_READY_TIMEOUT_MS = 15_000;
const CHUNK_ACK_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function yieldToPage(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export async function savePdf(
  element: HTMLElement,
  filename: string,
  options?: PdfSaveOptions,
): Promise<void> {
  const jobId = crypto.randomUUID();
  const port = chrome.runtime.connect({ name: `${PDF_CLIENT_PORT_PREFIX}${jobId}` });
  const acknowledgements = new Map<number, () => void>();
  let readyResolve!: () => void;
  let terminalResolve!: () => void;
  let terminalReject!: (error: Error) => void;
  let settled = false;
  let cancelSent = false;

  const ready = new Promise<void>(resolve => { readyResolve = resolve; });
  const terminal = new Promise<void>((resolve, reject) => {
    terminalResolve = resolve;
    terminalReject = reject;
  });
  const fail = (error: Error): void => {
    if (settled) return;
    settled = true;
    terminalReject(error);
  };
  const post = (message: PdfClientMessage): void => {
    try {
      port.postMessage(message);
    } catch {
      fail(new Error(t('messages.export.pdf.load_failed')));
    }
  };

  port.onMessage.addListener((message: PdfRendererMessage) => {
    switch (message?.type) {
      case 'ready':
        readyResolve();
        break;
      case 'chunk-ack':
        acknowledgements.get(message.sequence)?.();
        acknowledgements.delete(message.sequence);
        break;
      case 'progress':
        options?.onProgress?.(message.done, message.total);
        break;
      case 'done':
        if (!settled) {
          settled = true;
          terminalResolve();
        }
        break;
      case 'error':
        fail(new Error(message.error || t('messages.export.error')));
        break;
      case 'peer-disconnected':
        fail(new Error(t('messages.export.pdf.load_failed')));
        break;
      case 'relay-ready':
        break;
    }
  });
  port.onDisconnect.addListener(() => {
    if (!settled) fail(new Error(chrome.runtime.lastError?.message || t('messages.export.pdf.load_failed')));
  });

  const cancelTimer = setInterval(() => {
    if (cancelSent || !options?.shouldCancel?.()) return;
    cancelSent = true;
    post({ type: 'cancel' });
    fail(new DOMException('PDF export cancelled', 'AbortError'));
  }, 50);

  try {
    await withTimeout(
      Promise.race([ready, terminal]),
      RENDERER_READY_TIMEOUT_MS,
      t('messages.export.pdf.load_failed'),
    );
    if (settled) await terminal;

    post({ type: 'init', filename });
    const children = Array.from(element.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName !== 'STYLE');

    let sequence = 0;
    let offset = 0;
    while (offset < children.length) {
      if (options?.shouldCancel?.()) {
        post({ type: 'cancel' });
        throw new DOMException('PDF export cancelled', 'AbortError');
      }
      const nodes: string[] = [];
      let serializedChars = 0;
      while (offset < children.length && nodes.length < SERIALIZE_BATCH_SIZE) {
        const serialized = children[offset].outerHTML;
        if (nodes.length > 0 && serializedChars + serialized.length > SERIALIZE_BATCH_MAX_CHARS) break;
        nodes.push(serialized);
        serializedChars += serialized.length;
        offset++;
      }
      const currentSequence = sequence++;
      const acknowledged = new Promise<void>(resolve => {
        acknowledgements.set(currentSequence, resolve);
      });
      post({
        type: 'chunk',
        sequence: currentSequence,
        nodes,
      });
      await withTimeout(
        Promise.race([acknowledged, terminal]),
        CHUNK_ACK_TIMEOUT_MS,
        t('messages.export.pdf.load_failed'),
      );
      if (settled) await terminal;
      await yieldToPage();
    }

    post({ type: 'finish' });
    await terminal;
  } finally {
    clearInterval(cancelTimer);
    port.disconnect();
  }
}
