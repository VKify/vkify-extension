import { installExtApi } from './shared/ext-api.js';
import { sanitizeFilename } from './shared/utils/filename.js';
import { renderPdfElement } from './content/features/center/messages/dialog-export/pdf-export-entry.js';
import { PDF_CSS } from './content/features/center/messages/dialog-export/pdf-template.js';
import {
  PDF_RENDERER_PORT_PREFIX,
  type PdfClientMessage,
  type PdfRendererMessage,
} from './content/features/center/messages/dialog-export/pdf-api.js';

installExtApi();

const jobId = location.hash.slice(1);
if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
  throw new Error('Invalid PDF render job');
}

const port = chrome.runtime.connect({ name: `${PDF_RENDERER_PORT_PREFIX}${jobId}` });
const root = document.createElement('section');
root.className = 'vkify-pdf-document';
const style = document.createElement('style');
style.textContent = PDF_CSS;
root.appendChild(style);

let filename = 'VKify.pdf';
let initialized = false;
let cancelled = false;
let finished = false;
let queue = Promise.resolve();

function post(message: PdfRendererMessage): void {
  try {
    port.postMessage(message);
  } catch {
    // Клиент мог закрыть вкладку или отменить экспорт.
  }
}

async function downloadPdf(blob: Blob, targetFilename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const downloads = (chrome as unknown as {
    downloads?: {
      download(options: {
        url: string;
        filename: string;
        conflictAction: 'uniquify';
      }): Promise<number>;
    };
  }).downloads;

  if (downloads?.download) {
    await downloads.download({
      url,
      filename: targetFilename,
      conflictAction: 'uniquify',
    });
  } else {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = targetFilename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  // Даём подсистеме загрузок захватить blob до закрытия offscreen-документа/служебной вкладки.
  await new Promise(resolve => setTimeout(resolve, 1_500));
  URL.revokeObjectURL(url);
}

function parsePdfNode(serialized: string): HTMLElement {
  if (serialized.length === 0 || serialized.length > 24 * 1024 * 1024) {
    throw new Error('Invalid PDF node');
  }
  const parsed = new DOMParser().parseFromString(serialized, 'text/html');
  const node = parsed.body.firstElementChild;
  if (
    !(node instanceof HTMLElement)
    || parsed.body.childElementCount !== 1
    || (node.tagName !== 'DIV' && node.tagName !== 'HEADER')
  ) {
    throw new Error('Invalid PDF markup');
  }

  for (const unsafe of node.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form')) {
    unsafe.remove();
  }
  for (const element of [node, ...Array.from(node.querySelectorAll<HTMLElement>('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || attribute.name === 'srcdoc' || attribute.name === 'style') {
        element.removeAttribute(attribute.name);
      }
    }
    if (element instanceof HTMLAnchorElement && !/^(https?:|mailto:|tel:)/i.test(element.href)) {
      element.removeAttribute('href');
    }
    if (
      element instanceof HTMLImageElement
      && !/^(https:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,)/i.test(element.src)
    ) {
      element.removeAttribute('src');
    }
  }
  return document.importNode(node, true);
}

async function handleMessage(message: PdfClientMessage | PdfRendererMessage): Promise<void> {
  switch (message.type) {
    case 'relay-ready':
      post({ type: 'ready' });
      return;

    case 'init':
      if (initialized || typeof message.filename !== 'string') throw new Error('Invalid PDF init');
      filename = sanitizeFilename(message.filename) || 'VKify.pdf';
      initialized = true;
      return;

    case 'chunk':
      if (!initialized || finished || !Number.isSafeInteger(message.sequence) || !Array.isArray(message.nodes)) {
        throw new Error('Invalid PDF chunk');
      }
      if (message.nodes.length === 0 || message.nodes.length > 16) throw new Error('Invalid PDF chunk size');
      for (const serialized of message.nodes) {
        if (typeof serialized !== 'string') throw new Error('Invalid PDF node');
        root.appendChild(parsePdfNode(serialized));
      }
      post({ type: 'chunk-ack', sequence: message.sequence });
      return;

    case 'finish':
      if (!initialized || finished) throw new Error('Invalid PDF finish');
      finished = true;
      const blob = await renderPdfElement(root, {
        shouldCancel: () => cancelled,
        onProgress: (done, total) => post({ type: 'progress', done, total }),
      });
      if (!cancelled) {
        await downloadPdf(blob, filename);
        post({ type: 'done' });
      }
      return;

    case 'cancel':
    case 'ready':
    case 'chunk-ack':
    case 'progress':
    case 'done':
    case 'error':
    case 'peer-disconnected':
      return;
  }
}

port.onMessage.addListener((message: PdfClientMessage | PdfRendererMessage) => {
  if (message?.type === 'cancel' || message?.type === 'peer-disconnected') {
    cancelled = true;
    return;
  }
  queue = queue
    .then(() => handleMessage(message))
    .catch((error: unknown) => {
      cancelled = true;
      post({ type: 'error', error: (error as Error).message || 'PDF render failed' });
    });
});
