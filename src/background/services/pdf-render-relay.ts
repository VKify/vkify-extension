import {
  PDF_CLIENT_PORT_PREFIX,
  PDF_RENDERER_PORT_PREFIX,
  type PdfRendererMessage,
} from '../../content/features/center/messages/dialog-export/pdf-api.js';

const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const JOB_TIMEOUT_MS = 15 * 60_000;

interface OffscreenApi {
  createDocument(options: {
    url: string;
    reasons: string[];
    justification: string;
  }): Promise<void>;
  closeDocument(): Promise<void>;
}

interface PdfRenderJob {
  client: chrome.runtime.Port;
  renderer?: chrome.runtime.Port;
  context?: { kind: 'offscreen' } | { kind: 'tab'; tabId: number };
  timeout: ReturnType<typeof setTimeout>;
  connected: boolean;
  closing: boolean;
}

const jobs = new Map<string, PdfRenderJob>();
let offscreenJobId: string | null = null;

function getOffscreenApi(): OffscreenApi | undefined {
  return (chrome as unknown as { offscreen?: OffscreenApi }).offscreen;
}

function isVkSender(port: chrome.runtime.Port): boolean {
  if (
    port.sender?.id !== chrome.runtime.id
    || !port.sender.url
    || typeof port.sender.tab?.id !== 'number'
  ) return false;
  try {
    const url = new URL(port.sender.url);
    return url.protocol === 'https:' && (url.hostname === 'vk.ru' || url.hostname.endsWith('.vk.ru'));
  } catch {
    return false;
  }
}

function isExpectedRenderer(jobId: string, job: PdfRenderJob, port: chrome.runtime.Port): boolean {
  if (port.sender?.id !== chrome.runtime.id || !port.sender.url || !job.context) return false;
  try {
    const url = new URL(port.sender.url);
    const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
    if (url.origin !== extensionOrigin || !url.pathname.endsWith('/pdf-renderer.html')) return false;
    if (url.hash.slice(1) !== jobId) return false;
    if (job.context.kind === 'tab') return port.sender.tab?.id === job.context.tabId;
    return port.sender.tab === undefined;
  } catch {
    return false;
  }
}

function post(port: chrome.runtime.Port | undefined, message: PdfRendererMessage): void {
  try {
    port?.postMessage(message);
  } catch {
    // Контекст уже закрыт.
  }
}

async function closeJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || job.closing) return;
  job.closing = true;
  jobs.delete(jobId);
  clearTimeout(job.timeout);

  if (job.context?.kind === 'offscreen' && offscreenJobId === jobId) {
    offscreenJobId = null;
    try {
      await getOffscreenApi()?.closeDocument();
    } catch {
      // Документ уже мог закрыться вместе с контекстом расширения.
    }
  } else if (job.context?.kind === 'tab') {
    try {
      await chrome.tabs.remove(job.context.tabId);
    } catch {
      // Вкладка уже закрыта пользователем или браузером.
    }
  }
}

function connectPeers(jobId: string, job: PdfRenderJob): void {
  if (!job.renderer || job.connected) return;
  job.connected = true;

  job.client.onMessage.addListener(message => {
    try {
      job.renderer?.postMessage(message);
    } catch {
      post(job.client, { type: 'peer-disconnected' });
    }
  });
  job.renderer.onMessage.addListener(message => {
    try {
      job.client.postMessage(message);
    } catch {
      post(job.renderer, { type: 'peer-disconnected' });
    }
  });
  post(job.client, { type: 'relay-ready' });
  post(job.renderer, { type: 'relay-ready' });

  job.renderer.onDisconnect.addListener(() => {
    if (!job.closing) post(job.client, { type: 'peer-disconnected' });
    void closeJob(jobId);
  });
}

async function openRenderer(jobId: string, job: PdfRenderJob): Promise<void> {
  const offscreen = getOffscreenApi();
  if (offscreen && offscreenJobId === null) {
    offscreenJobId = jobId;
    job.context = { kind: 'offscreen' };
    try {
      await offscreen.createDocument({
        url: `pdf-renderer.html#${jobId}`,
        reasons: ['BLOBS'],
        justification: 'Render an exported VK dialog to PDF outside the VK tab',
      });
      return;
    } catch {
      if (offscreenJobId === jobId) offscreenJobId = null;
      job.context = undefined;
    }
  }

  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL(`pdf-renderer.html#${jobId}`),
    active: false,
  });
  if (typeof tab.id !== 'number') throw new Error('Could not open PDF renderer');
  job.context = { kind: 'tab', tabId: tab.id };
}

function registerClient(jobId: string, port: chrome.runtime.Port): void {
  if (!isVkSender(port) || jobs.has(jobId)) {
    port.disconnect();
    return;
  }

  const job: PdfRenderJob = {
    client: port,
    timeout: setTimeout(() => {
      post(port, { type: 'error', error: 'PDF render timeout' });
      void closeJob(jobId);
    }, JOB_TIMEOUT_MS),
    connected: false,
    closing: false,
  };
  jobs.set(jobId, job);
  port.onDisconnect.addListener(() => { void closeJob(jobId); });

  void openRenderer(jobId, job).catch((error: unknown) => {
    post(port, { type: 'error', error: (error as Error).message || 'Could not open PDF renderer' });
    void closeJob(jobId);
  });
}

function registerRenderer(jobId: string, port: chrome.runtime.Port): void {
  const job = jobs.get(jobId);
  if (!job || job.renderer || !isExpectedRenderer(jobId, job, port)) {
    port.disconnect();
    return;
  }
  job.renderer = port;
  connectPeers(jobId, job);
}

export function installPdfRenderRelay(): void {
  chrome.runtime.onConnect.addListener(port => {
    if (port.name.startsWith(PDF_CLIENT_PORT_PREFIX)) {
      const jobId = port.name.slice(PDF_CLIENT_PORT_PREFIX.length);
      if (JOB_ID_PATTERN.test(jobId)) registerClient(jobId, port);
      else port.disconnect();
      return;
    }
    if (port.name.startsWith(PDF_RENDERER_PORT_PREFIX)) {
      const jobId = port.name.slice(PDF_RENDERER_PORT_PREFIX.length);
      if (JOB_ID_PATTERN.test(jobId)) registerRenderer(jobId, port);
      else port.disconnect();
    }
  });
}
